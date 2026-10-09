"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { passerRating, seasonStats, teamSeasonStats, type SeasonLine, type TeamSeasonLine } from "@/lib/game/sim";
import { useGame } from "@/lib/game/store";
import type { Player, Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge } from "./bits";
import { PlayerDialog } from "./player-dialog";
import { TeamMark } from "./team-mark";

export interface Col<R> {
  key: string;
  label: string;
  title: string; // full name, shown on hover
  get: (r: R) => number;
  digits?: number;
}

const div = (a: number, b: number) => (b ? a / b : 0);

type P = SeasonLine;
const c = (key: string, label: string, title: string, get: (r: P) => number, digits = 0): Col<P> => ({ key, label, title, get, digits });

export const PASSING: Col<P>[] = [
  c("gp", "GP", "Games played", r => r.gp),
  c("cmp", "CMP", "Completions", r => r.passCmp),
  c("att", "ATT", "Attempts", r => r.passAtt),
  c("pct", "CMP%", "Completion percentage", r => div(r.passCmp, r.passAtt) * 100, 1),
  c("yds", "YDS", "Passing yards", r => r.passYds),
  c("ya", "Y/A", "Yards per attempt", r => div(r.passYds, r.passAtt), 1),
  c("ypg", "Y/G", "Yards per game", r => div(r.passYds, r.gp), 1),
  c("td", "TD", "Touchdown passes", r => r.passTd),
  c("int", "INT", "Interceptions thrown", r => r.passInt),
  c("lng", "LNG", "Longest completion", r => r.passLong),
  c("sck", "SCK", "Times sacked", r => r.sacked),
  c("sckyds", "SYL", "Sack yards lost", r => r.sackYdsLost),
  c("rtg", "RTG", "Passer rating", r => passerRating(r), 1),
];

export const RUSHING: Col<P>[] = [
  c("gp", "GP", "Games played", r => r.gp),
  c("att", "ATT", "Rushing attempts", r => r.rushAtt),
  c("yds", "YDS", "Rushing yards", r => r.rushYds),
  c("ypc", "Y/A", "Yards per carry", r => div(r.rushYds, r.rushAtt), 1),
  c("ypg", "Y/G", "Yards per game", r => div(r.rushYds, r.gp), 1),
  c("lng", "LNG", "Longest run", r => r.rushLong),
  c("td", "TD", "Rushing touchdowns", r => r.rushTd),
  c("fum", "FUM", "Fumbles", r => r.fumbles),
  c("lst", "LST", "Fumbles lost", r => r.fumblesLost),
];

export const RECEIVING: Col<P>[] = [
  c("gp", "GP", "Games played", r => r.gp),
  c("tgt", "TGT", "Targets", r => r.targets),
  c("rec", "REC", "Receptions", r => r.rec),
  c("ctch", "CTCH%", "Catch percentage", r => div(r.rec, r.targets) * 100, 1),
  c("yds", "YDS", "Receiving yards", r => r.recYds),
  c("ypr", "Y/R", "Yards per reception", r => div(r.recYds, r.rec), 1),
  c("ypg", "Y/G", "Yards per game", r => div(r.recYds, r.gp), 1),
  c("lng", "LNG", "Longest reception", r => r.recLong),
  c("yac", "YAC", "Yards after catch", r => r.yac),
  c("td", "TD", "Receiving touchdowns", r => r.recTd),
];

export const DEFENSE: Col<P>[] = [
  c("gp", "GP", "Games played", r => r.gp),
  c("tkl", "TKL", "Tackles", r => r.tkl),
  c("tfl", "TFL", "Tackles for loss", r => r.tfl),
  c("sck", "SCK", "Sacks", r => r.sack),
  c("int", "INT", "Interceptions", r => r.defInt),
  c("intyds", "IYDS", "Interception return yards", r => r.intYds),
  c("pd", "PD", "Passes defended", r => r.passDef),
  c("ff", "FF", "Forced fumbles", r => r.ff),
  c("fr", "FR", "Fumble recoveries", r => r.fr),
  c("sfty", "SFTY", "Safeties", r => r.safety),
];

type T = TeamSeasonLine;
const t = (key: string, label: string, title: string, get: (r: T) => number, digits = 0): Col<T> => ({ key, label, title, get, digits });

export const TEAM_OFFENSE: Col<T>[] = [
  t("g", "G", "Games", r => r.g),
  t("ppg", "PTS/G", "Points per game", r => div(r.pf, r.g), 1),
  t("ypg", "YDS/G", "Total yards per game", r => div(r.totalYds, r.g), 1),
  t("pypg", "PASS/G", "Net passing yards per game", r => div(r.passYds, r.g), 1),
  t("rypg", "RUSH/G", "Rushing yards per game", r => div(r.rushYds, r.g), 1),
  t("ypp", "Y/P", "Yards per play", r => div(r.totalYds, r.plays), 2),
  t("fd", "1ST/G", "First downs per game", r => div(r.firstDowns, r.g), 1),
  t("3rd", "3RD%", "Third-down conversion rate", r => div(r.thirdConv, r.thirdAtt) * 100, 1),
  t("4th", "4TH%", "Fourth-down conversion rate", r => div(r.fourthConv, r.fourthAtt) * 100, 1),
  t("rz", "RZ%", "Red zone touchdown rate", r => div(r.rzTd, r.rzAtt) * 100, 1),
  t("to", "TO", "Giveaways", r => r.turnovers),
  t("sa", "SA", "Sacks allowed", r => r.sacksAllowed),
];

export const TEAM_DEFENSE_ST: Col<T>[] = [
  t("g", "G", "Games", r => r.g),
  t("papg", "PA/G", "Points allowed per game", r => div(r.pa, r.g), 1),
  t("oypg", "YDS/G", "Yards allowed per game", r => div(r.oppYds, r.g), 1),
  t("tk", "TK", "Takeaways", r => r.takeaways),
  t("diff", "+/-", "Turnover differential", r => r.takeaways - r.turnovers),
  t("fg", "FGM", "Field goals made", r => r.fgm),
  t("fga", "FGA", "Field goals attempted", r => r.fga),
  t("fgp", "FG%", "Field goal percentage", r => div(r.fgm, r.fga) * 100, 1),
  t("fgl", "LNG", "Longest field goal", r => r.fgLong),
  t("xp", "XP%", "Extra point percentage", r => div(r.xpm, r.xpa) * 100, 1),
  t("pnt", "PUNTS", "Punts", r => r.punts),
  t("pavg", "AVG", "Yards per punt", r => div(r.puntYds, r.punts), 1),
];

/** Row style for your own players and team: gold tint plus a gold edge on the left. */
export const MINE_ROW = "bg-amber-400/15 shadow-[inset_4px_0_0_#f59e0b] hover:bg-amber-400/25";
/** Sticky name cells need an opaque version of the same tint. */
const MINE_STICKY = "bg-amber-50 dark:bg-amber-950";

const fmt = (v: number, digits = 0) => (digits ? v.toFixed(digits) : String(Math.round(v)));

/** Sortable stat table; click a column header to sort by it. */
export function StatTable<R>({
  cols, rows, name, defaultSort, dense = false, isMine,
}: {
  cols: Col<R>[];
  rows: R[];
  name: (r: R) => React.ReactNode;
  defaultSort: string;
  dense?: boolean;
  /** Highlights rows that belong to you. */
  isMine?: (r: R) => boolean;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: defaultSort, desc: true });
  const col = cols.find(x => x.key === sort.key) ?? cols[0];
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (sort.desc ? col.get(b) - col.get(a) : col.get(a) - col.get(b))),
    [rows, col, sort.desc],
  );
  return (
    <div className="overflow-x-auto">
      <Table className={cn(dense && "text-xs")}>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-40 bg-card">Name</TableHead>
            {cols.map(x => (
              <TableHead key={x.key} className="px-2 text-right" title={x.title}>
                <button
                  type="button"
                  onClick={() => setSort(s => ({ key: x.key, desc: s.key === x.key ? !s.desc : true }))}
                  className={cn("font-semibold", sort.key === x.key && "text-foreground underline underline-offset-4")}
                >
                  {x.label}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r, i) => {
            const mine = isMine?.(r) ?? false;
            return (
            <TableRow key={i} className={cn(mine && MINE_ROW)}>
              <TableCell className={cn("sticky left-0 z-10 py-1.5", mine ? MINE_STICKY : "bg-card")}>{name(r)}</TableCell>
              {cols.map(x => (
                <TableCell key={x.key} className={cn("px-2 py-1.5 text-right tabular-nums", sort.key === x.key && "font-semibold")}>
                  {fmt(x.get(r), x.digits)}
                </TableCell>
              ))}
            </TableRow>
            );
          })}
          {!sorted.length && (
            <TableRow>
              <TableCell colSpan={cols.length + 1} className="py-6 text-center text-muted-foreground">No stats yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function PlayerName({ p, team, mine, onOpen }: { p: Player; team?: Team; mine?: boolean; onOpen?: (p: Player) => void }) {
  return (
    <button type="button" className="flex items-center gap-2 text-left" onClick={() => onOpen?.(p)}>
      <MonBadge player={p} size={24} />
      <span className="max-w-32 truncate font-medium">{p.name}</span>
      {team && <TeamMark team={team} size="xs" />}
      {mine && <YouTag />}
    </button>
  );
}

export function YouTag() {
  return <span className="rounded bg-amber-400 px-1 text-[9px] font-bold tracking-wide text-zinc-950">YOU</span>;
}

/** The season stats screen: player categories plus team offense and defense. */
export function SeasonStats() {
  const { league, byId, ownerOf, myTeamId } = useGame();
  const [withPlayoffs, setWithPlayoffs] = useState(false);
  const [open, setOpen] = useState<Player | null>(null);
  const players = useMemo(() => [...seasonStats(league!, withPlayoffs)].map(([id, s]) => ({ id, s })), [league, withPlayoffs]);
  const teams = useMemo(() => [...teamSeasonStats(league!, withPlayoffs)].map(([id, s]) => ({ id, s })), [league, withPlayoffs]);
  const teamById = new Map(league!.teams.map(x => [x.id, x]));

  const playerTable = (cols: Col<P>[], filter: (s: P) => boolean, defaultSort: string) => (
    <StatTable
      cols={cols.map(x => ({ ...x, get: (r: { s: P }) => x.get(r.s) }))}
      rows={players.filter(r => filter(r.s))}
      defaultSort={defaultSort}
      isMine={r => ownerOf.get(r.id) === myTeamId}
      name={r => (
        <PlayerName p={byId.get(r.id)!} team={teamById.get(ownerOf.get(r.id)!)} mine={ownerOf.get(r.id) === myTeamId} onOpen={setOpen} />
      )}
    />
  );
  const teamTable = (cols: Col<T>[], defaultSort: string) => (
    <StatTable
      cols={cols.map(x => ({ ...x, get: (r: { s: T }) => x.get(r.s) }))}
      rows={teams}
      defaultSort={defaultSort}
      isMine={r => r.id === myTeamId}
      name={r => {
        const tm = teamById.get(r.id)!;
        return (
          <span className="flex items-center gap-2">
            <TeamMark team={tm} />
            <span className="max-w-40 truncate font-medium">{tm.name}</span>
            {r.id === myTeamId && <YouTag />}
          </span>
        );
      }}
    />
  );

  return (
    <div className="space-y-3">
      <Tabs defaultValue="passing">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="passing">Passing</TabsTrigger>
            <TabsTrigger value="rushing">Rushing</TabsTrigger>
            <TabsTrigger value="receiving">Receiving</TabsTrigger>
            <TabsTrigger value="defense">Defense</TabsTrigger>
            <TabsTrigger value="team-off">Team offense</TabsTrigger>
            <TabsTrigger value="team-def">Team defense &amp; kicking</TabsTrigger>
          </TabsList>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={withPlayoffs} onChange={e => setWithPlayoffs(e.target.checked)} />
            Include playoffs
          </label>
        </div>
        <TabsContent value="passing">{playerTable(PASSING, s => s.passAtt > 0, "yds")}</TabsContent>
        <TabsContent value="rushing">{playerTable(RUSHING, s => s.rushAtt > 0, "yds")}</TabsContent>
        <TabsContent value="receiving">{playerTable(RECEIVING, s => s.targets > 0, "yds")}</TabsContent>
        <TabsContent value="defense">
          {playerTable(DEFENSE, s => s.tkl + s.sack + s.defInt + s.passDef + s.ff + s.fr > 0, "tkl")}
        </TabsContent>
        <TabsContent value="team-off">{teamTable(TEAM_OFFENSE, "ppg")}</TabsContent>
        <TabsContent value="team-def">{teamTable(TEAM_DEFENSE_ST, "tk")}</TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">Hover a column for its full name, and click it to sort.</p>
      <PlayerDialog player={open} onClose={() => setOpen(null)} />
    </div>
  );
}
