import { chemistry } from "./chemistry";
import { SLOTS } from "./ratings";
import { isAdvanced, ratingContext, slotRating, type TeamScheme } from "./schemes";
import type { Game, League, Player, Role, SlotId, StatLine, TeamLine } from "./types";

/**
 * All-time tracking: after the host plays games, each finished game is sent to /api/stats as a
 * GameReport. The server adds it to running totals across every league ever played.
 */

/** Season stats kept in the all-time totals. */
export const TRACKED_STATS = [
  "passYds", "passTd", "passInt", "rushYds", "rushTd", "rec", "recYds", "recTd",
  "tkl", "sack", "defInt", "ff",
] as const satisfies readonly (keyof StatLine)[];
export type TrackedStat = (typeof TRACKED_STATS)[number];

export interface PlayerReport {
  id: number;
  slot: SlotId;
  role: Role;
  /** Rating at that spot going into the game (chemistry and scheme fit included). */
  rating: number;
  /** Impact points: one number for a game's production at any position (see impactPoints). */
  pts: number;
  line: Partial<Record<TrackedStat, number>>;
}

export interface TeamReport {
  result: 0 | 0.5 | 1;
  scheme: TeamScheme | null;
  players: PlayerReport[];
}

export interface GameReport {
  /** Unique per game: league code, seed and game id, so the same game is never counted twice. */
  key: string;
  mode: "standard" | "advanced";
  teams: [TeamReport, TeamReport];
}

/**
 * Fantasy-style impact points so every position is on one scale. Linemen don't record stats,
 * so offensive linemen share credit for the run game and for keeping the QB clean.
 */
export function impactPoints(s: Partial<StatLine>, slot: SlotId, team?: TeamLine): number {
  const n = (k: keyof StatLine) => s[k] ?? 0;
  let pts =
    n("passYds") / 25 + n("passTd") * 4 - n("passInt") * 2 +
    n("rushYds") / 10 + n("rushTd") * 6 +
    n("rec") * 0.5 + n("recYds") / 10 + n("recTd") * 6 - n("fumblesLost") * 2 +
    n("tkl") + n("tfl") + n("sack") * 3 + n("defInt") * 4 + n("passDef") + n("ff") * 2 + n("fr") * 2 + n("safety") * 2;
  if (team && ["LT", "LG", "C", "RG", "RT"].includes(slot)) {
    pts += team.rushYds / 40 + Math.max(0, 4 - team.sacksAllowed) * 0.75;
  }
  return Math.round(pts * 10) / 10;
}

function teamReport(league: League, game: Game, side: 0 | 1, byId: Map<number, Player>): TeamReport {
  const r = game.result!;
  const teamId = side === 0 ? game.home : game.away;
  const team = league.teams.find(t => t.id === teamId)!;
  const chem = chemistry(team, byId, league.settings).bonus;
  const ctx = ratingContext(league, team);
  const mine = r.score[side];
  const theirs = r.score[1 - side];
  const players: PlayerReport[] = [];
  for (const s of SLOTS) {
    const id = team.roster[s.id];
    const p = id != null ? byId.get(id) : undefined;
    if (!p) continue;
    const box = r.stats[p.id] ?? {};
    const line: PlayerReport["line"] = {};
    for (const k of TRACKED_STATS) if (box[k]) line[k] = box[k];
    players.push({
      id: p.id,
      slot: s.id,
      role: s.role,
      rating: Math.min(99, slotRating(p, s, ctx) + (chem.get(p.id) ?? 0)),
      pts: impactPoints(box, s.id, r.team?.[side]),
      line,
    });
  }
  return { result: mine > theirs ? 1 : mine < theirs ? 0 : 0.5, scheme: ctx.scheme, players };
}

/** Reports for every game that has a result in `after` but not in `before`. */
export function newGameReports(before: League, after: League, byId: Map<number, Player>): GameReport[] {
  const played = (l: League) => new Set([...(l.season?.weeks.flat() ?? []), ...(l.season?.playoffs.flat() ?? [])].filter(g => g.result).map(g => g.id));
  const already = played(before);
  const games = [...(after.season?.weeks.flat() ?? []), ...(after.season?.playoffs.flat() ?? [])].filter(g => g.result && !already.has(g.id));
  return games.map(g => ({
    key: `${after.code}:${after.seed}:${g.id}`,
    mode: isAdvanced(after.settings) ? "advanced" : "standard",
    teams: [teamReport(after, g, 0, byId), teamReport(after, g, 1, byId)],
  }));
}

/** Fire-and-forget upload. Stats are a bonus: a failure never interrupts the game. */
export function sendReports(reports: GameReport[]) {
  if (!reports.length) return;
  fetch("/api/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ games: reports }), keepalive: reports.length < 20 })
    .catch(() => {});
}

// ---- All-time summary (computed on the server, shown on the stats page) ----

export interface RoleLine {
  role: Role;
  n: number;
  winPct: number;
  ppg: number;
  expected: number;
  rating: number;
}

export interface MonSummary {
  id: number;
  n: number;
  winPct: number;
  ppg: number;
  /** Points per game a Pokémon rated like this, at these roles, usually produces. */
  expected: number;
  /** ppg − expected: positive = over-performing its rating. */
  diff: number;
  rating: number;
  mainRole: Role;
  roles: RoleLine[];
  stats: Partial<Record<TrackedStat, number>>;
}

export interface SchemeLine {
  kind: "off" | "front" | "cov";
  scheme: string;
  n: number;
  winPct: number;
}

export interface StatsSummary {
  configured: boolean;
  games: number;
  advancedGames: number;
  mons: MonSummary[];
  schemes: SchemeLine[];
}

export interface Combo {
  role: Role;
  partner: number;
  partnerRole: Role;
  n: number;
  winPct: number;
  /** Win rate together minus this Pokémon's win rate at that role overall. */
  lift: number;
}

export interface MonDetail {
  id: number;
  combos: Combo[];
}
