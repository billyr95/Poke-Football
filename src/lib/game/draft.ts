import { chemistry } from "./chemistry";
import { POSITIONS, POS_LIST, SLOTS, SLOT_BY_ID } from "./ratings";
import { rngFor } from "./rng";
import { ratingContext, slotRating, type RatingContext } from "./schemes";
import type { League, Player, Pos, Slot, SlotId, Team } from "./types";

export function buildOrder(teamIds: number[], rounds: number, snake: boolean) {
  const order: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const row = snake && r % 2 === 1 ? [...teamIds].reverse() : teamIds;
    order.push(...row);
  }
  return order;
}

export function openSlots(team: Team): Slot[] {
  return SLOTS.filter(s => team.roster[s.id] == null);
}

export function takenIds(league: League) {
  return new Set(league.draft.log.map(p => p.playerId));
}

export function onClock(league: League): Team | null {
  const id = league.draft.order[league.draft.pick];
  return id == null ? null : league.teams.find(t => t.id === id) ?? null;
}

const STANDARD: RatingContext = { advanced: false, scheme: null };

/** Best open slot for a player on this team, by their rating at that spot. */
export function bestOpenSlot(team: Team, p: Player, ctx: RatingContext = STANDARD): Slot | null {
  const open = openSlots(team);
  if (!open.length) return null;
  return open.reduce((best, s) => (slotRating(p, s, ctx) > slotRating(p, best, ctx) ? s : best));
}

// The QB touches every play, so it's worth more than one lineman.
const POS_VALUE: Record<Pos, number> = { QB: 1.6, RB: 1.1, WR: 1.05, TE: 0.95, OL: 0.85, DL: 1, LB: 0.95, CB: 1, S: 0.9 };

/**
 * AI pick: value over replacement. For each position, "replacement" is the rating of the
 * player you'd still get if every remaining slot at that position across the league were filled first.
 */
export function aiChoose(league: League, players: Player[]): { playerId: number; slotId: SlotId } | null {
  const team = onClock(league);
  if (!team) return null;
  const taken = takenIds(league);
  const available = players.filter(p => !taken.has(p.id));
  const open = openSlots(team);
  if (!available.length || !open.length) return null;

  const leagueOpen: Record<Pos, number> = Object.fromEntries(POS_LIST.map(p => [p, 0])) as Record<Pos, number>;
  for (const t of league.teams) for (const s of openSlots(t)) leagueOpen[s.pos]++;

  const replacement = {} as Record<Pos, number>;
  for (const pos of POS_LIST) {
    const sorted = available.map(p => p.posOvr[pos]).sort((a, b) => b - a);
    replacement[pos] = sorted[Math.min(sorted.length - 1, Math.max(0, leagueOpen[pos]))] ?? 40;
  }

  const rng = rngFor(league.seed, `ai-${league.draft.pick}`);
  const ctx = ratingContext(league, team);
  let best: { playerId: number; slotId: SlotId; v: number } | null = null;
  // One candidate spot per open position (standard) or per open role (advanced, where roles rate differently).
  const seen = new Set<string>();
  const candidates = open.filter(s => {
    const key = ctx.advanced ? s.role : s.pos;
    return seen.has(key) ? false : (seen.add(key), true);
  });
  for (const p of available) {
    for (const s of candidates) {
      const r = slotRating(p, s, ctx);
      const v = (r - replacement[s.pos]) * POS_VALUE[s.pos] + r * 0.15 + (rng() - 0.5) * 3;
      if (!best || v > best.v) best = { playerId: p.id, slotId: s.id, v };
    }
  }
  return best && { playerId: best.playerId, slotId: best.slotId };
}

/** Starts the pick timer for whoever is on the clock now (friends only; AI teams pick on their own). */
export function startClock(league: League, now = Date.now()): League {
  const team = league.phase === "draft" ? onClock(league) : null;
  const secs = league.settings.pickSeconds;
  const deadline = team?.managerId && secs ? now + secs * 1000 : null;
  return { ...league, draft: { ...league.draft, deadline } };
}

export function makePick(league: League, playerId: number, slotId: SlotId): League {
  const team = onClock(league);
  if (!team) throw new Error("The draft is over.");
  if (takenIds(league).has(playerId)) throw new Error("That Pokémon has already been drafted.");
  if (team.roster[slotId] != null) throw new Error(`${SLOT_BY_ID[slotId].label} is already filled.`);

  const teams = league.teams.map(t => (t.id === team.id ? { ...t, roster: { ...t.roster, [slotId]: playerId } } : t));
  const log = [...league.draft.log, { pick: league.draft.pick, teamId: team.id, playerId, slotId }];
  const pick = league.draft.pick + 1;
  return startClock({
    ...league,
    teams,
    draft: { ...league.draft, log, pick },
    phase: pick >= league.draft.order.length ? "review" : league.phase,
  });
}

// ---- Team strength ----

export interface TeamRatings {
  off: number;
  def: number;
  ovr: number;
}

// How much each spot matters: the QB touches every snap; skill players, corners and pass
// rushers swing games a bit more than linebackers, safeties and blockers.
export const SLOT_WEIGHT: Record<Pos, number> = { QB: 3, RB: 1.2, WR: 1.2, CB: 1.2, DL: 1.2, TE: 1, OL: 1, LB: 1, S: 1 };
const STAR_LINE = 85;
const STAR_MULT = 1.6;
/** Stars count extra: each point above 85 is worth 1.6. */
const starValue = (r: number) => (r > STAR_LINE ? STAR_LINE + (r - STAR_LINE) * STAR_MULT : r);

export function teamRatings(team: Team, byId: Map<number, Player>, league?: Pick<League, "settings" | "schemes">): TeamRatings {
  const chem = chemistry(team, byId, league?.settings).bonus;
  const ctx = ratingContext(league, team);
  const unit = (side: "off" | "def") => {
    let sum = 0;
    let w = 0;
    for (const s of SLOTS.filter(s => s.side === side)) {
      const p = team.roster[s.id] != null ? byId.get(team.roster[s.id]!) : undefined;
      const weight = SLOT_WEIGHT[s.pos];
      sum += starValue(p ? Math.min(99, slotRating(p, s, ctx) + (chem.get(p.id) ?? 0)) : 40) * weight;
      w += weight;
    }
    return Math.round((sum / w) * 10) / 10;
  };
  const off = unit("off");
  const def = unit("def");
  return { off, def, ovr: Math.round(((off + def) / 2) * 10) / 10 };
}

/** Draft grade: how a team's overall compares with the league average (ratings are pool-relative, so grades are too). */
export function grade(ovr: number, leagueAvg: number) {
  const diff = ovr - leagueAvg;
  const scale: [number, string][] = [
    [3, "A+"], [2, "A"], [1.2, "A-"], [0.5, "B+"], [-0.2, "B"], [-0.9, "B-"], [-1.6, "C+"], [-2.3, "C"], [-3, "C-"], [-4, "D"],
  ];
  return scale.find(([min]) => diff >= min)?.[1] ?? "F";
}

export const posName = (pos: Pos) => POSITIONS[pos].name;
