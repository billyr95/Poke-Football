"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chemistry } from "@/lib/game/chemistry";
import { bestOpenSlot, onClock, openSlots, takenIds, teamRatings } from "@/lib/game/draft";
import { POS_LIST, POSITIONS, ROSTER_SIZE, SLOT_BY_ID } from "@/lib/game/ratings";
import { useGame } from "@/lib/game/store";
import type { Player, Pos, SlotId, Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge, RatingChip, TYPE_COLOR, TypePill } from "./bits";
import { ChemistryList } from "./chemistry-list";
import { Formation } from "./formation";
import { PlayerCard } from "./player-card";
import { MINE_ROW } from "./stats-tables";
import { TeamMark } from "./team-mark";

/** How the available list is rated: natural position, a specific position, or best fit for my open spots. */
type PosFilter = Pos | "ALL" | "BEST";

/** Countdown to the pick deadline. `offset` converts this browser's clock to the host's. */
function PickClock({ deadline, offset, total }: { deadline: number; offset: number; total: number }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [offset]);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = left <= 10;
  return (
    <div className="flex items-center gap-2" role="timer" aria-label={`${left} seconds left`}>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-300", urgent ? "bg-red-500" : "bg-emerald-500")}
          style={{ width: `${Math.min(100, (left / total) * 100)}%` }}
        />
      </span>
      <span className={cn("w-12 font-heading text-xl tabular-nums", urgent && "text-red-600 dark:text-red-400")}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

export function DraftRoom() {
  const { league, pool, byId, myTeamId, isHost, pick, autoPick, clockOffset } = useGame();
  const l = league!;
  const team = onClock(l);
  const myTurn = team != null && team.id === myTeamId;
  const myTeam = l.teams.find(t => t.id === myTeamId) ?? null;

  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalId, setModalId] = useState<number | null>(null);
  const [tab, setTab] = useState<string>(myTeam ? "mine" : "feed");

  const taken = useMemo(() => takenIds(l), [l]);
  const types = useMemo(() => [...new Set(pool.flatMap(p => p.types))].sort(), [pool]);

  const myOpenPositions = useMemo(() => [...new Set((myTeam ? openSlots(myTeam) : []).map(s => s.pos))], [myTeam]);
  /** Best rating among the positions I still need, and which one it is. */
  const bestFit = (p: Player): { pos: Pos; rating: number } => {
    const options = myOpenPositions.length ? myOpenPositions : [p.pos];
    return options.reduce((best, pos) => (p.posOvr[pos] > best.rating ? { pos, rating: p.posOvr[pos] } : best), { pos: options[0], rating: p.posOvr[options[0]] });
  };
  const rateAt = (p: Player) => (posFilter === "ALL" ? p.ovr : posFilter === "BEST" ? bestFit(p).rating : p.posOvr[posFilter]);
  const shownPos = (p: Player) => (posFilter === "BEST" ? bestFit(p).pos : posFilter === "ALL" ? p.pos : posFilter);
  const available = useMemo(() => {
    const isNum = /^\d+$/.test(q);
    return pool
      .filter(p => !taken.has(p.id))
      .filter(p => (q ? (isNum ? String(p.id).startsWith(q) : p.name.toLowerCase().includes(q)) : true))
      .filter(p => typeFilter === "all" || p.types.includes(typeFilter))
      .sort((a, b) => rateAt(b) - rateAt(a) || a.id - b.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, taken, q, typeFilter, posFilter, myOpenPositions]);

  const myOpen = useMemo(() => (myTeam ? openSlots(myTeam) : []), [myTeam]);
  const myChem = useMemo(() => (myTeam ? chemistry(myTeam, byId, l.settings) : null), [myTeam, byId, l.settings]);
  const modalPlayer = modalId != null ? byId.get(modalId) ?? null : null;
  const modalTakenBy = modalPlayer && taken.has(modalPlayer.id)
    ? l.teams.find(t => t.id === l.draft.log.find(r => r.playerId === modalPlayer.id)?.teamId)
    : undefined;

  const round = Math.floor(l.draft.pick / l.teams.length) + 1;
  const pickInRound = (l.draft.pick % l.teams.length) + 1;

  // One "Draft as…" button per open position, best fit first.
  const draftOptions = useMemo(() => {
    if (!modalPlayer || !myTeam) return [];
    const seen = new Set<Pos>();
    return myOpen
      .filter(s => (seen.has(s.pos) ? false : (seen.add(s.pos), true)))
      .map(s => ({ slot: s, rating: modalPlayer.posOvr[s.pos] }))
      .sort((a, b) => b.rating - a.rating);
  }, [modalPlayer, myTeam, myOpen]);

  const quickDraft = (p: Player) => {
    const want = posFilter === "ALL" || posFilter === "BEST" ? null : posFilter;
    const slot = (want && myOpen.find(s => s.pos === want)) || bestOpenSlot(myTeam!, p);
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
            <TeamMark team={team} size="md" />
            <span className="text-sm">
              On the clock: <b>{team.name}</b>{" "}
              <span className="text-muted-foreground">({team.manager ?? "AI"})</span>
            </span>
          </div>
        )}
        {myTurn && <Badge className="bg-amber-400 text-zinc-950">Your pick</Badge>}
        {l.draft.deadline != null && <PickClock deadline={l.draft.deadline} offset={clockOffset} total={l.settings.pickSeconds ?? 60} />}
        {!myTurn && team?.managerId == null && <span className="text-sm text-muted-foreground">AI is choosing…</span>}
        <div className="ml-auto flex gap-2">
          {isHost && team?.managerId && (
            <Button variant="outline" size="sm" onClick={autoPick}>
              Auto-pick for {team.id === myTeamId ? "me" : team.manager}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
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
                items={[
                  { value: "ALL", label: "Natural position" },
                  ...(myTeam ? [{ value: "BEST", label: "Best for my team" }] : []),
                  ...POS_LIST.map(p => ({ value: p, label: `Rate as ${p}` })),
                ]}
              >
                <SelectTrigger className="w-full" aria-label="Sort players"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="start" className="w-auto min-w-(--anchor-width) max-w-[calc(100vw-2rem)]">
                  <SelectItem value="ALL">Natural position</SelectItem>
                  {myTeam && <SelectItem value="BEST">Best available for my team</SelectItem>}
                  {POS_LIST.map(p => <SelectItem key={p} value={p}>Rate as {p} · {POSITIONS[p].name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={v => setTypeFilter(v ?? "all")}
                items={[{ value: "all", label: "All types" }, ...types.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
              >
                <SelectTrigger className="w-full" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="end" className="w-auto min-w-(--anchor-width) max-w-[calc(100vw-2rem)]">
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
            <ScrollArea className="h-[60vh] lg:h-[calc(100vh-15rem)]">
              <ul className="divide-y">
                {available.slice(0, 300).map(p => (
                  <li key={p.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setModalId(p.id)}
                      onKeyDown={e => e.key === "Enter" && setModalId(p.id)}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-muted/60"
                    >
                      <MonBadge player={p} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="flex gap-1">{p.types.map(t => <TypePill key={t} type={t} />)}</div>
                      </div>
                      <span className="w-6 text-center text-xs font-semibold text-muted-foreground">{shownPos(p)}</span>
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

        {/* My team / feed / other teams */}
        <Card className="min-h-0">
          <CardContent className="pt-4">
            <Tabs value={tab} onValueChange={v => setTab(String(v))}>
              <TabsList className="w-full">
                {myTeam && <TabsTrigger value="mine">My team</TabsTrigger>}
                <TabsTrigger value="feed">Draft feed ({l.draft.log.length})</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
              </TabsList>

              {myTeam && myChem && (
                <TabsContent value="mine" className="space-y-3 pt-2">
                  <TeamHeader team={myTeam} picks={ROSTER_SIZE - myOpen.length} />
                  <Formation
                    team={myTeam}
                    byId={byId}
                    chem={myChem.bonus}
                    compact
                    onSlot={(slot: SlotId, p) => {
                      if (p) setModalId(p.id);
                      else setPosFilter(SLOT_BY_ID[slot].pos);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Tap an open spot to sort the list by that position. Tap a player for details.</p>
                  <ChemistryList chem={myChem} byId={byId} />
                </TabsContent>
              )}

              <TabsContent value="feed" className="pt-2">
                <DraftFeed onOpen={setModalId} />
              </TabsContent>

              <TabsContent value="teams" className="pt-2">
                <OtherTeams onOpen={setModalId} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Player details */}
      <Dialog open={!!modalPlayer} onOpenChange={o => !o && setModalId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogTitle className="sr-only">{modalPlayer?.name}</DialogTitle>
          {modalPlayer && (
            <PlayerCard player={modalPlayer} highlightPos={posFilter === "ALL" ? undefined : shownPos(modalPlayer)}>
              {modalTakenBy ? (
                <p className="text-sm text-muted-foreground">
                  Drafted by <b style={{ color: modalTakenBy.color }}>{modalTakenBy.name}</b>.
                </p>
              ) : myTeam ? (
                <PositionPicker
                  player={modalPlayer}
                  options={draftOptions}
                  myTurn={myTurn}
                  onDraft={slotId => {
                    pick(modalPlayer.id, slotId);
                    setModalId(null);
                  }}
                />
              ) : null}
            </PlayerCard>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Pick which open spot to put the player in, then confirm with one clear button. */
function PositionPicker({
  player, options, myTurn, onDraft,
}: {
  player: Player;
  options: { slot: { id: SlotId; pos: Pos; label: string }; rating: number }[];
  myTurn: boolean;
  onDraft: (slot: SlotId) => void;
}) {
  const best = options[0];
  const [choice, setChoice] = useState<SlotId | null>(null);
  const chosen = options.find(o => o.slot.id === choice) ?? best;
  if (!best) return <p className="text-sm text-muted-foreground">Your roster is full.</p>;
  return (
    <section className="space-y-2 rounded-xl border-2 border-primary/15 bg-muted/40 p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold">Choose a position</h4>
        <span className="text-xs text-muted-foreground">{options.length} open</span>
      </div>
      <div role="radiogroup" aria-label="Position" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map(o => {
          const on = o.slot.id === chosen.slot.id;
          return (
            <button
              key={o.slot.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(o.slot.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 bg-background px-2.5 py-2 text-left transition-colors",
                on ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-border",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg leading-tight">{o.slot.pos}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {o.slot.pos === player.pos ? "Natural" : o === best ? "Best fit" : POSITIONS[o.slot.pos].name}
                </span>
              </span>
              <RatingChip value={o.rating} />
            </button>
          );
        })}
      </div>
      <Button size="lg" className="h-12 w-full text-base" disabled={!myTurn} onClick={() => onDraft(chosen.slot.id)}>
        {myTurn ? `Draft ${player.name} at ${chosen.slot.pos} · ${chosen.rating}` : "Wait for your pick to draft"}
      </Button>
    </section>
  );
}

function TeamHeader({ team, picks }: { team: Team; picks: number }) {
  const { byId, league } = useGame();
  const r = teamRatings(team, byId, league?.settings);
  return (
    <div className="flex items-center gap-2">
      <TeamMark team={team} size="md" />
      <span className="min-w-0 flex-1 truncate font-heading text-lg">{team.name}</span>
      <span className="text-xs text-muted-foreground">
        {picks}/{ROSTER_SIZE} · OFF {r.off} · DEF {r.def}
      </span>
    </div>
  );
}

/** Every pick so far, newest first, optionally filtered to one team. */
function DraftFeed({ onOpen }: { onOpen: (id: number) => void }) {
  const { league, byId, myTeamId } = useGame();
  const l = league!;
  const [teamFilter, setTeamFilter] = useState("all");
  const picks = [...l.draft.log].reverse().filter(r => teamFilter === "all" || String(r.teamId) === teamFilter);
  const n = l.teams.length;
  return (
    <div className="space-y-2">
      <Select
        value={teamFilter}
        onValueChange={v => setTeamFilter(String(v ?? "all"))}
        items={[{ value: "all", label: "All teams" }, ...l.teams.map(t => ({ value: String(t.id), label: t.name }))]}
      >
        <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All teams</SelectItem>
          {l.teams.map(t => (
            <SelectItem key={t.id} value={String(t.id)}>
              <TeamMark team={t} size="xs" />
              {t.name}{t.id === myTeamId ? " (you)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ScrollArea className="h-[55vh] lg:h-[calc(100vh-19rem)]">
        <ol className="space-y-1 pr-3">
          {picks.map(r => {
            const p = byId.get(r.playerId)!;
            const t = l.teams.find(x => x.id === r.teamId)!;
            const slot = SLOT_BY_ID[r.slotId];
            return (
              <li key={r.pick}>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60", t.id === myTeamId && MINE_ROW)}
                >
                  <span className="w-14 shrink-0 text-[11px] leading-tight text-muted-foreground tabular-nums">
                    R{Math.floor(r.pick / n) + 1}.{(r.pick % n) + 1}
                    <br />#{r.pick + 1}
                  </span>
                  <MonBadge player={p} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TeamMark team={t} size="xs" />
                      <span className="truncate">{t.name}</span> · {slot.label}
                    </span>
                  </span>
                  <RatingChip value={p.posOvr[slot.pos]} className="text-sm" />
                </button>
              </li>
            );
          })}
          {!picks.length && <li className="py-8 text-center text-sm text-muted-foreground">No picks yet.</li>}
        </ol>
      </ScrollArea>
    </div>
  );
}

/** Browse any team's board mid-draft. */
function OtherTeams({ onOpen }: { onOpen: (id: number) => void }) {
  const { league, byId, myTeamId } = useGame();
  const l = league!;
  const others = l.teams.filter(t => t.id !== myTeamId);
  const [viewId, setViewId] = useState<number>(others[0]?.id ?? l.teams[0].id);
  const view = l.teams.find(t => t.id === viewId) ?? l.teams[0];
  const chem = useMemo(() => chemistry(view, byId, l.settings), [view, byId, l.settings]);
  const filled = Object.keys(view.roster).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {l.teams.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setViewId(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              t.id === view.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            <TeamMark team={t} size="xs" />
            {t.name}{t.id === myTeamId ? " (you)" : ""}
          </button>
        ))}
      </div>
      <TeamHeader team={view} picks={filled} />
      <p className="-mt-2 text-xs text-muted-foreground">{view.manager ?? "AI"}</p>
      <Formation team={view} byId={byId} chem={chem.bonus} compact onSlot={(_, p) => p && onOpen(p.id)} />
      <ChemistryList chem={chem} byId={byId} />
    </div>
  );
}
