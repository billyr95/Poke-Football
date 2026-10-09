"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chemistry } from "@/lib/game/chemistry";
import { bestOpenSlot, onClock, openSlots, takenIds } from "@/lib/game/draft";
import { POS_LIST, POSITIONS, ROSTER_SIZE, SLOT_BY_ID } from "@/lib/game/ratings";
import { useGame } from "@/lib/game/store";
import type { Player, Pos, SlotId } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge, RatingChip, TYPE_COLOR, TypePill } from "./bits";
import { ChemistryList } from "./chemistry-list";
import { Formation } from "./formation";
import { PlayerCard } from "./player-card";

type PosFilter = Pos | "ALL";

export function DraftRoom() {
  const { league, pool, byId, myTeamId, isHost, pick, autoPick } = useGame();
  const l = league!;
  const team = onClock(l);
  const myTurn = team != null && team.id === myTeamId;
  const myTeam = l.teams.find(t => t.id === myTeamId) ?? null;

  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewTeamId, setViewTeamId] = useState<number | null>(myTeamId ?? l.teams[0]?.id ?? null);

  const taken = useMemo(() => takenIds(l), [l]);
  const types = useMemo(() => [...new Set(pool.flatMap(p => p.types))].sort(), [pool]);

  const rateAt = (p: Player) => (posFilter === "ALL" ? p.ovr : p.posOvr[posFilter]);
  const available = useMemo(() => {
    const isNum = /^\d+$/.test(q);
    return pool
      .filter(p => !taken.has(p.id))
      .filter(p => (q ? (isNum ? String(p.id).startsWith(q) : p.name.toLowerCase().includes(q)) : true))
      .filter(p => typeFilter === "all" || p.types.includes(typeFilter))
      .sort((a, b) => rateAt(b) - rateAt(a) || a.id - b.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, taken, q, typeFilter, posFilter]);

  // Falls back to the best available player once the selected one gets drafted.
  const selected = (selectedId != null && !taken.has(selectedId) ? byId.get(selectedId) : undefined) ?? available[0] ?? null;
  const myOpen = useMemo(() => (myTeam ? openSlots(myTeam) : []), [myTeam]);
  const viewTeam = l.teams.find(t => t.id === viewTeamId) ?? l.teams[0];
  const viewChem = useMemo(() => chemistry(viewTeam, byId), [viewTeam, byId]);

  const round = Math.floor(l.draft.pick / l.teams.length) + 1;
  const pickInRound = (l.draft.pick % l.teams.length) + 1;
  const recent = [...l.draft.log].reverse().slice(0, 12);

  // Where would the selected player go? One button per open position, best spot first.
  const draftOptions = useMemo(() => {
    if (!selected || !myTeam) return [];
    const seen = new Set<Pos>();
    return myOpen
      .filter(s => (seen.has(s.pos) ? false : (seen.add(s.pos), true)))
      .map(s => ({ slot: s, rating: selected.posOvr[s.pos] }))
      .sort((a, b) => b.rating - a.rating);
  }, [selected, myTeam, myOpen]);

  const quickDraft = (p: Player) => {
    const slot = posFilter !== "ALL" ? myOpen.find(s => s.pos === posFilter) ?? bestOpenSlot(myTeam!, p) : bestOpenSlot(myTeam!, p);
    if (slot) pick(p.id, slot.id);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
      {/* On the clock */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3",
          myTurn ? "border-amber-400 bg-amber-400/15" : "bg-card",
        )}
      >
        <div className="font-heading text-lg">
          Round {round} of {ROSTER_SIZE} · Pick {pickInRound}
        </div>
        {team && (
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: team.color }} />
            <span className="text-sm">
              On the clock: <b>{team.name}</b>{" "}
              <span className="text-muted-foreground">({team.manager ?? "AI"})</span>
            </span>
          </div>
        )}
        {myTurn && <Badge className="bg-amber-400 text-zinc-950">Your pick</Badge>}
        {!myTurn && team?.managerId == null && <span className="text-sm text-muted-foreground">AI is choosing…</span>}
        <div className="ml-auto flex gap-2">
          {isHost && team?.managerId && (
            <Button variant="outline" size="sm" onClick={autoPick}>
              Auto-pick for {team.id === myTeamId ? "me" : team.manager}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Available players */}
        <Card className="min-h-0">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="font-heading text-xl">Available ({pool.length - taken.size})</CardTitle>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or dex number" className="pl-8" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={posFilter}
                onValueChange={v => setPosFilter((v ?? "ALL") as PosFilter)}
                items={[{ value: "ALL", label: "Natural position" }, ...POS_LIST.map(p => ({ value: p, label: `Rate as ${p}` }))]}
              >
                <SelectTrigger className="w-full" aria-label="Rate players at position"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Natural position</SelectItem>
                  {POS_LIST.map(p => <SelectItem key={p} value={p}>Rate as {p} · {POSITIONS[p].name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={v => setTypeFilter(v ?? "all")}
                items={[{ value: "all", label: "All types" }, ...types.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
              >
                <SelectTrigger className="w-full" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map(t => (
                    <SelectItem key={t} value={t}>
                      <span className="size-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                      {t[0].toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[60vh] lg:h-[calc(100vh-16rem)]">
              <ul className="divide-y">
                {available.slice(0, 300).map(p => (
                  <li key={p.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(p.id)}
                      onKeyDown={e => e.key === "Enter" && setSelectedId(p.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-muted/60",
                        selected?.id === p.id && "bg-muted",
                      )}
                    >
                      <MonBadge player={p} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="flex gap-1">{p.types.map(t => <TypePill key={t} type={t} />)}</div>
                      </div>
                      <span className="w-6 text-center text-xs font-semibold text-muted-foreground">{p.pos}</span>
                      <RatingChip value={rateAt(p)} />
                      {myTurn && (
                        <Button size="xs" onClick={e => { e.stopPropagation(); quickDraft(p); }}>Draft</Button>
                      )}
                    </div>
                  </li>
                ))}
                {!available.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No Pokémon match.</li>}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Selected player */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selected player</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <PlayerCard player={selected} highlightPos={posFilter === "ALL" ? undefined : posFilter}>
                {myTeam && (
                  <div className="space-y-2">
                    {!myTurn && <p className="text-xs text-muted-foreground">You can draft when you&apos;re on the clock.</p>}
                    <div className="flex flex-wrap gap-2">
                      {draftOptions.map(({ slot, rating }) => (
                        <Button
                          key={slot.pos}
                          size="sm"
                          variant={slot.pos === selected.pos ? "default" : "outline"}
                          disabled={!myTurn}
                          onClick={() => pick(selected.id, slot.id)}
                        >
                          Draft as {slot.pos} · {rating}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </PlayerCard>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a player from the list.</p>
            )}
          </CardContent>
        </Card>

        {/* Teams */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="font-heading text-xl">Rosters</CardTitle>
              <Select
                value={String(viewTeam.id)}
                onValueChange={v => setViewTeamId(Number(v))}
                items={l.teams.map(t => ({ value: String(t.id), label: t.id === myTeamId ? `${t.name} (you)` : t.name }))}
              >
                <SelectTrigger size="sm" className="max-w-[60%]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {l.teams.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                      {t.name}{t.id === myTeamId ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-3">
              <Formation
                team={viewTeam}
                byId={byId}
                chem={viewChem.bonus}
                compact
                highlight={viewTeam.id === myTeamId && selected ? new Set(myOpen.filter(s => s.pos === selected.pos).map(s => s.id)) : undefined}
                onSlot={(slot: SlotId, p) => {
                  if (p) setSelectedId(null);
                  if (!p && viewTeam.id === myTeamId) setPosFilter(SLOT_BY_ID[slot].pos);
                }}
              />
              {viewTeam.id === myTeamId && (
                <p className="text-xs text-muted-foreground">Tap an open spot to see the best available players for it.</p>
              )}
              <ChemistryList chem={viewChem} byId={byId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-xl">Latest picks</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1.5 text-sm">
                {recent.map(r => {
                  const p = byId.get(r.playerId)!;
                  const t = l.teams.find(x => x.id === r.teamId)!;
                  return (
                    <li key={r.pick} className="flex items-center gap-2">
                      <span className="w-8 text-xs text-muted-foreground tabular-nums">#{r.pick + 1}</span>
                      <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                      <span className="min-w-0 flex-1 truncate">
                        <b>{p.name}</b> <span className="text-muted-foreground">→ {SLOT_BY_ID[r.slotId].label}, {t.name}</span>
                      </span>
                      <RatingChip value={p.posOvr[SLOT_BY_ID[r.slotId].pos]} className="text-sm" />
                    </li>
                  );
                })}
                {!recent.length && <li className="text-muted-foreground">No picks yet.</li>}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
