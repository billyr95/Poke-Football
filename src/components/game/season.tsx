"use client";

import { Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chemistry } from "@/lib/game/chemistry";
import { awards, emptyLine, inPlayoffs, playoffTeamCount, seasonStats, standings, type SeasonLine } from "@/lib/game/sim";
import { useGame } from "@/lib/game/store";
import type { Game, Player, StatLine, Team, TeamLine } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge } from "./bits";
import { Formation } from "./formation";
import { PlayerDialog } from "./player-dialog";
import { useTeamTable } from "./review";
import { DEFENSE, PASSING, PlayerName, RECEIVING, RUSHING, SeasonStats, StatTable, type Col } from "./stats-tables";

function roundName(games: number, isLast: boolean) {
  return isLast && games === 1 ? "Championship" : "Semifinals";
}

export function Season() {
  const { league, byId, ownerOf, isHost, playNext, playAll, myTeamId, leave } = useGame();
  const l = league!;
  const s = l.season!;
  const [boxGame, setBoxGame] = useState<Game | null>(null);
  const teamById = useMemo(() => new Map(l.teams.map(t => [t.id, t])), [l.teams]);
  const table = standings(l);
  const playoffs = inPlayoffs(l);
  const champion = s.championId != null ? teamById.get(s.championId)! : null;
  const seeds = playoffTeamCount(l.teams.length);

  const nextLabel = !playoffs
    ? `Play week ${s.week + 1}`
    : s.playoffs.length === 0 && seeds === 4
      ? "Play the semifinals"
      : "Play the championship";

  const lastWeek = playoffs ? s.playoffs[s.playoffs.length - 1] : s.weeks[s.week - 1];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="font-heading text-4xl">
            {champion ? "Season complete" : playoffs ? "Playoffs" : `Week ${s.week + 1} of ${s.weeks.length}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Top {seeds} make the playoffs{seeds === 4 ? ": 1 vs 4 and 2 vs 3, winners meet for the title" : " and meet in the championship"}.
          </p>
        </div>
        {isHost && !champion && (
          <div className="flex gap-2">
            <Button size="lg" onClick={playNext}>{nextLabel}</Button>
            <Button size="lg" variant="outline" onClick={playAll}>Sim to the end</Button>
          </div>
        )}
        {!isHost && !champion && <p className="text-sm text-muted-foreground">The host plays each week.</p>}
        {champion && <Button variant="outline" onClick={leave}>New league</Button>}
      </div>

      {champion && <ChampionBanner champion={champion} mine={champion.id === myTeamId} />}

      {lastWeek && (
        <section className="space-y-2">
          <h2 className="font-heading text-xl">
            {playoffs && s.playoffs.length ? roundName(lastWeek.length, true) : `Week ${s.week} results`}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lastWeek.map(g => <ScoreCard key={g.id} game={g} teamById={teamById} onOpen={() => setBoxGame(g)} myTeamId={myTeamId} />)}
          </div>
        </section>
      )}

      <Tabs defaultValue="standings">
        <TabsList>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="leaders">Leaders</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="standings">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">W</TableHead>
                    <TableHead className="text-right">L</TableHead>
                    <TableHead className="text-right">T</TableHead>
                    <TableHead className="text-right">PF</TableHead>
                    <TableHead className="text-right">PA</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.map((r, i) => {
                    const t = teamById.get(r.teamId)!;
                    return (
                      <TableRow key={r.teamId} className={cn(i === seeds - 1 && "border-b-2 border-b-amber-400", t.id === myTeamId && "bg-amber-400/10")}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                            <span className="font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground">{t.manager ?? "AI"}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.w}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.l}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.t}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.pf}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.pa}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.pf - r.pa > 0 ? "+" : ""}{r.pf - r.pa}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          {s.playoffs.map((round, i) => (
            <section key={`p${i}`} className="space-y-2">
              <h3 className="font-heading text-lg">{roundName(round.length, i === s.playoffs.length - 1 && round[0].id === "final")}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {round.map(g => <ScoreCard key={g.id} game={g} teamById={teamById} onOpen={() => setBoxGame(g)} myTeamId={myTeamId} />)}
              </div>
            </section>
          ))}
          {s.weeks.map((week, i) => (
            <section key={i} className="space-y-2">
              <h3 className="font-heading text-lg">Week {i + 1}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {week.map(g => <ScoreCard key={g.id} game={g} teamById={teamById} onOpen={() => g.result && setBoxGame(g)} myTeamId={myTeamId} />)}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="leaders">
          <Leaders byId={byId} ownerOf={ownerOf} teamById={teamById} />
        </TabsContent>

        <TabsContent value="stats">
          <SeasonStats />
        </TabsContent>

        <TabsContent value="teams">
          <TeamsTab />
        </TabsContent>
      </Tabs>

      <BoxScore game={boxGame} onClose={() => setBoxGame(null)} teamById={teamById} byId={byId} ownerOf={ownerOf} />
    </div>
  );
}

function ChampionBanner({ champion, mine }: { champion: Team; mine: boolean }) {
  const { league, byId, ownerOf } = useGame();
  const aw = awards(league!, ownerOf);
  const mvp = aw.mvp != null ? byId.get(aw.mvp) : undefined;
  const dpoy = aw.dpoy != null ? byId.get(aw.dpoy) : undefined;
  const teamName = (p?: Player) => (p ? league!.teams.find(t => t.id === ownerOf.get(p.id))?.name : "");
  return (
    <Card className="overflow-hidden border-amber-400">
      <div className="flex flex-wrap items-center gap-6 bg-gradient-to-r from-amber-400/30 to-transparent p-6">
        <Trophy className="size-14 text-amber-500" />
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">League champions</div>
          <div className="font-heading text-4xl" style={{ color: champion.color }}>{champion.name}</div>
          <div className="text-sm text-muted-foreground">{champion.manager ?? "AI"}{mine && ". That's you!"}</div>
        </div>
        {[["Most valuable player", mvp], ["Defensive player of the year", dpoy]].map(([label, p]) =>
          p ? (
            <div key={label as string} className="flex items-center gap-3">
              <MonBadge player={p as Player} size={44} />
              <div>
                <div className="text-xs text-muted-foreground">{label as string}</div>
                <div className="font-semibold">{(p as Player).name}</div>
                <div className="text-xs text-muted-foreground">{teamName(p as Player)}</div>
              </div>
            </div>
          ) : null,
        )}
      </div>
    </Card>
  );
}

function ScoreCard({ game, teamById, onOpen, myTeamId }: { game: Game; teamById: Map<number, Team>; onOpen: () => void; myTeamId: number | null }) {
  const sides = [teamById.get(game.away)!, teamById.get(game.home)!];
  const scores = game.result ? [game.result.score[1], game.result.score[0]] : null;
  const winner = scores ? (scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1) : -1;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!game.result}
      className={cn(
        "rounded-lg border bg-card px-3 py-2 text-left transition-colors enabled:hover:bg-muted/60",
        (game.home === myTeamId || game.away === myTeamId) && "border-amber-400/70",
      )}
    >
      {sides.map((t, i) => (
        <div key={t.id} className={cn("flex items-center gap-2 py-0.5", winner === i ? "font-semibold" : scores && "text-muted-foreground")}>
          <span className="size-2.5 rounded-full" style={{ background: t.color }} />
          <span className="min-w-0 flex-1 truncate text-sm">{t.name}{i === 1 && <span className="text-xs text-muted-foreground"> (home)</span>}</span>
          <span className="font-heading text-xl tabular-nums">{scores ? scores[i] : ""}</span>
        </div>
      ))}
      {!scores && <div className="text-xs text-muted-foreground">Not played yet</div>}
    </button>
  );
}

const LEADER_CATS: { key: keyof StatLine; label: string }[] = [
  { key: "passYds", label: "Passing yards" },
  { key: "passTd", label: "Passing TDs" },
  { key: "rushYds", label: "Rushing yards" },
  { key: "recYds", label: "Receiving yards" },
  { key: "rec", label: "Receptions" },
  { key: "tkl", label: "Tackles" },
  { key: "sack", label: "Sacks" },
  { key: "defInt", label: "Interceptions" },
];

function Leaders({ byId, ownerOf, teamById }: { byId: Map<number, Player>; ownerOf: Map<number, number>; teamById: Map<number, Team> }) {
  const { league } = useGame();
  const stats = useMemo(() => seasonStats(league!), [league]);
  const [open, setOpen] = useState<Player | null>(null);
  if (!stats.size) return <p className="py-6 text-center text-sm text-muted-foreground">Play a week to see leaders.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {LEADER_CATS.map(cat => {
        const top = [...stats].filter(([, s]) => s[cat.key] > 0).sort((a, b) => b[1][cat.key] - a[1][cat.key]).slice(0, 5);
        return (
          <Card key={cat.key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{cat.label}</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-1.5">
                {top.map(([id, s]) => {
                  const p = byId.get(id)!;
                  const t = teamById.get(ownerOf.get(id)!);
                  return (
                    <li key={id}>
                      <button type="button" className="flex w-full items-center gap-2 text-left text-sm" onClick={() => setOpen(p)}>
                        <MonBadge player={p} size={24} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="size-2 rounded-full" style={{ background: t?.color }} />
                        <span className="font-heading tabular-nums">{s[cat.key]}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        );
      })}
      <PlayerDialog player={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function TeamsTab() {
  const { league, byId, myTeamId } = useGame();
  const rows = useTeamTable();
  const [viewId, setViewId] = useState<number>(myTeamId ?? rows[0].team.id);
  const [open, setOpen] = useState<Player | null>(null);
  const view = league!.teams.find(t => t.id === viewId)!;
  const chem = useMemo(() => chemistry(view, byId), [view, byId]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {rows.map(({ team, r, grade }) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => setViewId(team.id)}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60", viewId === team.id && "bg-muted")}
                >
                  <span className="size-3 rounded-full" style={{ background: team.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{team.name}</span>
                  <span className="text-xs text-muted-foreground">OFF {r.off} · DEF {r.def}</span>
                  <span className="w-8 text-right font-heading text-xl">{grade}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Formation team={view} byId={byId} chem={chem.bonus} onSlot={(_, p) => p && setOpen(p)} />
      <PlayerDialog player={open} onClose={() => setOpen(null)} bonus={open ? chem.bonus.get(open.id) : 0} />
    </div>
  );
}

const TEAM_ROWS: [string, (t: TeamLine) => string][] = [
  ["First downs", t => String(t.firstDowns)],
  ["Total plays", t => String(t.plays)],
  ["Total yards", t => String(t.totalYds)],
  ["Yards per play", t => (t.plays ? t.totalYds / t.plays : 0).toFixed(1)],
  ["Passing (net)", t => String(t.passYds)],
  ["Pass attempts", t => String(t.passAtt)],
  ["Rushing", t => `${t.rushAtt}-${t.rushYds}`],
  ["Third downs", t => `${t.thirdConv}-${t.thirdAtt}`],
  ["Fourth downs", t => `${t.fourthConv}-${t.fourthAtt}`],
  ["Red zone (TD-att)", t => `${t.rzTd}-${t.rzAtt}`],
  ["Sacks allowed", t => String(t.sacksAllowed)],
  ["Turnovers", t => String(t.turnovers)],
  ["Field goals", t => `${t.fgm}-${t.fga}`],
  ["Extra points", t => `${t.xpm}-${t.xpa}`],
  ["Punts (avg)", t => `${t.punts} (${t.punts ? (t.puntYds / t.punts).toFixed(1) : "0.0"})`],
];

// The box score drops season-only columns.
const noGp = <R,>(cols: Col<R>[]) => cols.filter(c => c.key !== "gp" && c.key !== "ypg");

function BoxScore({ game, onClose, teamById, byId, ownerOf }: {
  game: Game | null; onClose: () => void; teamById: Map<number, Team>; byId: Map<number, Player>; ownerOf: Map<number, number>;
}) {
  const r = game?.result;
  const [open, setOpen] = useState<Player | null>(null);
  return (
    <Dialog open={!!r} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        {game && r && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">
                {teamById.get(game.away)!.name} {r.score[1]} at {teamById.get(game.home)!.name} {r.score[0]}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="summary" className="max-h-[75vh] overflow-y-auto pr-1">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="away">{teamById.get(game.away)!.name}</TabsTrigger>
                <TabsTrigger value="home">{teamById.get(game.home)!.name}</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 text-sm">
                {r.team ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team stats</TableHead>
                        <TableHead className="text-right">{teamById.get(game.away)!.name}</TableHead>
                        <TableHead className="text-right">{teamById.get(game.home)!.name}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {TEAM_ROWS.map(([label, get]) => (
                        <TableRow key={label}>
                          <TableCell className="py-1.5 text-muted-foreground">{label}</TableCell>
                          <TableCell className="py-1.5 text-right tabular-nums">{get(r.team![1])}</TableCell>
                          <TableCell className="py-1.5 text-right tabular-nums">{get(r.team![0])}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">Team stats weren&apos;t tracked for this game.</p>
                )}
                <section>
                  <h4 className="mb-1 font-semibold">Scoring</h4>
                  {r.plays.length ? (
                    <ul className="space-y-0.5 text-muted-foreground">{r.plays.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  ) : (
                    <p className="text-muted-foreground">No points scored.</p>
                  )}
                </section>
              </TabsContent>

              {(["away", "home"] as const).map(side => {
                const teamId = side === "home" ? game.home : game.away;
                const rows = Object.entries(r.stats)
                  .filter(([id]) => ownerOf.get(+id) === teamId)
                  .map(([id, line]) => ({ p: byId.get(+id)!, s: { ...emptyLine(), ...line, gp: 1 } as SeasonLine }));
                const table = (cols: Col<SeasonLine>[], filter: (s: SeasonLine) => boolean, sortKey: string, title: string) => {
                  const list = rows.filter(x => filter(x.s));
                  if (!list.length) return null;
                  return (
                    <section key={title}>
                      <h4 className="mb-1 font-semibold">{title}</h4>
                      <StatTable
                        dense
                        cols={noGp(cols).map(c => ({ ...c, get: (x: { s: SeasonLine }) => c.get(x.s) }))}
                        rows={list}
                        defaultSort={sortKey}
                        name={x => <PlayerName p={x.p} onOpen={setOpen} />}
                      />
                    </section>
                  );
                };
                return (
                  <TabsContent key={side} value={side} className="space-y-4">
                    {table(PASSING, s => s.passAtt + s.sacked > 0, "yds", "Passing")}
                    {table(RUSHING, s => s.rushAtt > 0, "yds", "Rushing")}
                    {table(RECEIVING, s => s.targets > 0, "yds", "Receiving")}
                    {table(DEFENSE, s => s.tkl + s.sack + s.defInt + s.passDef + s.ff + s.fr > 0, "tkl", "Defense")}
                  </TabsContent>
                );
              })}
            </Tabs>
            <PlayerDialog player={open} onClose={() => setOpen(null)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
