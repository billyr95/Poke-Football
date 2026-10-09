"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GENERATIONS, ratedPool } from "@/lib/game/dex";
import { ROLE_LIST, ROLES } from "@/lib/game/ratings";
import { COVERAGES, FRONTS, OFFENSES } from "@/lib/game/schemes";
import type { Combo, MonDetail, MonSummary, StatsSummary } from "@/lib/game/tracking";
import type { Player, Role } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge, RatingChip } from "./bits";
import { PlayerCard } from "./player-card";

type View = "over" | "under" | "most" | "schemes";
type Row = { id: number; role: Role; n: number; winPct: number; ppg: number; expected: number; diff: number; rating: number };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(1)}`;
/** Rank by how far off expectation, shrunk toward zero for small samples. */
const confidence = (r: Row) => (r.diff * r.n) / (r.n + 5);

/** All-time stats from every game played in every league. */
export function AllTimeStats() {
  const [data, setData] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("over");
  const [role, setRole] = useState<Role | "ALL">("ALL");
  const [minGames, setMinGames] = useState(3);
  const [openId, setOpenId] = useState<number | null>(null);

  // Names and sprites only, so any pool works: use the whole dex.
  const byId = useMemo(() => new Map(ratedPool({ gens: GENERATIONS.map(g => g.gen), legendaries: true }).map(p => [p.id, p])), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't load stats.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const list = data.mons.flatMap((m: MonSummary): Row[] => {
      if (role === "ALL") return [{ id: m.id, role: m.mainRole, n: m.n, winPct: m.winPct, ppg: m.ppg, expected: m.expected, diff: m.diff, rating: m.rating }];
      const r = m.roles.find(x => x.role === role);
      return r ? [{ id: m.id, role, n: r.n, winPct: r.winPct, ppg: r.ppg, expected: r.expected, diff: Math.round((r.ppg - r.expected) * 10) / 10, rating: r.rating }] : [];
    }).filter(r => r.n >= minGames && byId.has(r.id));
    if (view === "over") return list.filter(r => r.diff > 0).sort((a, b) => confidence(b) - confidence(a)).slice(0, 50);
    if (view === "under") return list.filter(r => r.diff < 0).sort((a, b) => confidence(a) - confidence(b)).slice(0, 50);
    return list.sort((a, b) => b.n - a.n).slice(0, 100);
  }, [data, role, minGames, view, byId]);

  const open = openId != null ? byId.get(openId) ?? null : null;
  const openSummary = data?.mons.find(m => m.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl">All-time stats</h2>
          <p className="text-sm text-muted-foreground">
            {data ? (
              <>
                {data.games.toLocaleString()} games tracked{data.advancedGames ? ` (${data.advancedGames.toLocaleString()} in advanced mode)` : ""} ·{" "}
                {data.mons.length.toLocaleString()} Pokémon have played
              </>
            ) : loading ? "Loading…" : " "}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {data && !data.configured && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm">
          Stats storage isn&apos;t connected yet, so these numbers are temporary and reset when the site restarts.
        </p>
      )}
      {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {([["over", "Over-performing"], ["under", "Under-performing"], ["most", "Most played"], ["schemes", "Schemes"]] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn("rounded-full border px-3 py-1 text-sm", view === v ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
          >
            {label}
          </button>
        ))}
        {view !== "schemes" && (
          <div className="ml-auto flex gap-2">
            <Select
              value={role}
              onValueChange={v => setRole((v ?? "ALL") as Role | "ALL")}
              items={[{ value: "ALL", label: "All roles" }, ...ROLE_LIST.map(r => ({ value: r, label: r }))]}
            >
              <SelectTrigger size="sm" className="w-32" aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {ROLE_LIST.map(r => <SelectItem key={r} value={r}>{r} · {ROLES[r].name.split(" (")[0]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={String(minGames)}
              onValueChange={v => setMinGames(Number(v ?? 3))}
              items={[1, 3, 5, 10, 25].map(n => ({ value: String(n), label: `${n}+ games` }))}
            >
              <SelectTrigger size="sm" className="w-28" aria-label="Minimum games"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 3, 5, 10, 25].map(n => <SelectItem key={n} value={String(n)}>{n}+ games</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {view === "schemes" ? (
        <SchemeTable data={data} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Pokémon</TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead className="text-right">Win</TableHead>
                  <TableHead className="text-right">Rtg</TableHead>
                  <TableHead className="text-right" title="Impact points per game">Pts/G</TableHead>
                  <TableHead className="text-right" title="What a Pokémon with this rating usually scores at this role">Exp</TableHead>
                  <TableHead className="text-right">+/−</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const p = byId.get(r.id)!;
                  return (
                    <TableRow key={`${r.id}-${r.role}`} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                      <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <MonBadge player={p} size={28} />
                          <span className="font-medium">{p.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold text-muted-foreground">{r.role}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.n}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.winPct)}</TableCell>
                      <TableCell className="text-right"><RatingChip value={Math.round(r.rating)} className="text-xs" /></TableCell>
                      <TableCell className="text-right tabular-nums">{r.ppg.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{r.expected.toFixed(1)}</TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", r.diff > 0 ? "text-emerald-600 dark:text-emerald-400" : r.diff < 0 ? "text-red-600 dark:text-red-400" : "")}>
                        {signed(r.diff)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data && !rows.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      {data.games ? "Nobody matches yet. Try fewer minimum games or another role." : "No games tracked yet. Play a season and check back!"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        Impact points put every position on one scale (yards, touchdowns, catches, tackles, sacks, takeaways; linemen share credit
        for the run game and protection). Expected points come from how Pokémon with the same rating usually do at that role, so
        +/− shows who plays above or below their card.
      </p>

      <Dialog open={!!open} onOpenChange={o => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogTitle className="sr-only">{open?.name}</DialogTitle>
          {open && (
            <PlayerCard player={open}>
              {openSummary && <MonHistory summary={openSummary} byId={byId} />}
            </PlayerCard>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SchemeTable({ data }: { data: StatsSummary | null }) {
  const name = (kind: string, key: string) =>
    (kind === "off" ? OFFENSES : kind === "front" ? FRONTS : COVERAGES)[key as never]?.["label"] ?? key;
  const groups = [["off", "Offenses"], ["front", "Fronts"], ["cov", "Coverages"]] as const;
  if (!data?.schemes.length) {
    return <p className="rounded-xl border p-8 text-center text-muted-foreground">No advanced-mode games yet. Scheme win rates show up here once some are played.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {groups.map(([kind, title]) => (
        <Card key={kind}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.schemes.filter(s => s.kind === kind).sort((a, b) => b.winPct - a.winPct || b.n - a.n).map(s => (
              <div key={s.scheme} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{name(kind, s.scheme)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{s.n} G</span>
                <span className="w-10 text-right font-semibold tabular-nums">{pct(s.winPct)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** One Pokémon's record by role, plus the teammates it wins with most. */
function MonHistory({ summary, byId }: { summary: MonSummary; byId: Map<number, Player> }) {
  const [detail, setDetail] = useState<MonDetail | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/stats?mon=${summary.id}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => live && setDetail(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [summary.id]);

  // Best partners at each role this Pokémon has played: smoothed win rate, so 1–0 doesn't top the list.
  const combosByRole = useMemo(() => {
    const out = new Map<Role, Combo[]>();
    for (const c of detail?.combos ?? []) {
      if (c.n < 2 || !byId.has(c.partner)) continue;
      out.set(c.role, [...(out.get(c.role) ?? []), c]);
    }
    const score = (c: Combo) => (c.winPct * c.n + 1) / (c.n + 2);
    for (const [r, list] of out) out.set(r, list.sort((a, b) => score(b) - score(a) || b.n - a.n).slice(0, 5));
    return out;
  }, [detail, byId]);

  return (
    <section className="space-y-3 rounded-xl border-2 border-primary/15 bg-muted/40 p-3">
      <h4 className="text-sm font-semibold">All-time</h4>
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        <Stat label="Games" value={summary.n} />
        <Stat label="Win" value={pct(summary.winPct)} />
        <Stat label="Pts/G" value={summary.ppg.toFixed(1)} />
        <Stat label="vs exp" value={signed(summary.diff)} tone={summary.diff} />
      </div>
      {Object.keys(summary.stats).length > 0 && (
        <p className="text-xs text-muted-foreground">
          {Object.entries(summary.stats).map(([k, v]) => `${STAT_LABEL[k] ?? k} ${v.toLocaleString()}`).join(" · ")}
        </p>
      )}
      <div className="space-y-3">
        {summary.roles.map(r => (
          <div key={r.role} className="space-y-1">
            <div className="flex items-baseline gap-2 text-sm">
              <b>{r.role}</b>
              <span className="text-xs text-muted-foreground">
                {r.n} G · {pct(r.winPct)} wins · {r.ppg.toFixed(1)} pts/g ({signed(r.ppg - r.expected)} vs exp)
              </span>
            </div>
            {(combosByRole.get(r.role) ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {combosByRole.get(r.role)!.map(c => {
                  const partner = byId.get(c.partner)!;
                  return (
                    <span key={`${c.partner}-${c.partnerRole}`} className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs" title={`${c.n} games together`}>
                      <MonBadge player={partner} size={20} />
                      {partner.name} <span className="text-muted-foreground">{c.partnerRole}</span>
                      <b className={c.lift >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{pct(c.winPct)}</b>
                      <span className="text-muted-foreground">({c.n})</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{detail ? "Not enough games with the same teammates yet." : "Loading combos…"}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const STAT_LABEL: Record<string, string> = {
  passYds: "Pass yds", passTd: "Pass TD", passInt: "INT thrown", rushYds: "Rush yds", rushTd: "Rush TD", rec: "Rec",
  recYds: "Rec yds", recTd: "Rec TD", tkl: "Tackles", sack: "Sacks", defInt: "INT", ff: "FF",
};

function Stat({ label, value, tone = 0 }: { label: string; value: string | number; tone?: number }) {
  return (
    <div className="rounded-md bg-background py-1">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</div>
      <div className={cn("font-heading text-lg tabular-nums", tone > 0 && "text-emerald-600 dark:text-emerald-400", tone < 0 && "text-red-600 dark:text-red-400")}>{value}</div>
    </div>
  );
}
