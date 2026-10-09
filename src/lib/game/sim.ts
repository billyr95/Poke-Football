import { chemistry, withChem } from "./chemistry";
import { SLOTS } from "./ratings";
import { normal, rngFor, weightedPick, type Rng } from "./rng";
import type { Game, GameResult, League, Player, SeasonState, SlotId, StatLine, Team } from "./types";

/** Play-by-play football sim. Each team gets a fixed number of possessions starting at its own 25. */

const POSSESSIONS = 11;
const MAX_OT_ROUNDS = 3;

type Lineup = Record<SlotId, Player>;

// Empty slots (shouldn't happen after a full draft) get a weak stand-in.
function standIn(slotId: SlotId): Player {
  const r = 40;
  return {
    id: -1, name: "Stand-in", types: ["normal"], heightM: 1, weightKg: 50,
    base: { hp: 40, atk: 40, def: 40, spa: 40, spd: 40, spe: 40 }, family: -1, evolvesFrom: null, rarity: null, rarityBonus: 0, gen: 0, stage: 1, maturity: 1,
    attrs: { SPD: r, STR: r, AGI: r, AWR: r, CTH: r, THP: r, THA: r, BLK: r, TKL: r, COV: r },
    posOvr: { QB: r, RB: r, WR: r, TE: r, OL: r, DL: r, LB: r, CB: r, S: r },
    pos: SLOTS.find(s => s.id === slotId)!.pos, ovr: r,
  };
}

function lineup(team: Team, byId: Map<number, Player>): Lineup {
  const chem = chemistry(team, byId).bonus;
  return Object.fromEntries(
    SLOTS.map(s => {
      const p = team.roster[s.id] != null ? byId.get(team.roster[s.id]!) : undefined;
      return [s.id, p ? withChem(p, chem.get(p.id) ?? 0) : standIn(s.id)];
    }),
  ) as Lineup;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function unitScores(o: Lineup, d: Lineup) {
  const ol = [o.LT, o.LG, o.C, o.RG, o.RT];
  const dl = [d.DE1, d.DT1, d.DT2, d.DE2];
  const lb = [d.LB1, d.LB2, d.LB3];
  return {
    runBlock: avg(ol.map(p => p.posOvr.OL)) * 0.8 + o.TE.attrs.BLK * 0.2,
    passBlock: avg(ol.map(p => p.attrs.BLK)),
    runStop: avg(dl.map(p => p.posOvr.DL)) * 0.55 + avg(lb.map(p => p.posOvr.LB)) * 0.45,
    passRush: avg(dl.map(p => (p.attrs.STR + p.attrs.SPD) / 2)),
  };
}

type Box = Record<number, Partial<StatLine>>;

function add(box: Box, p: Player, key: keyof StatLine, n = 1) {
  if (p.id < 0) return;
  const line = (box[p.id] ??= {});
  line[key] = (line[key] ?? 0) + n;
}

function tackler(rng: Rng, d: Lineup, deep: boolean): Player {
  const pool = deep
    ? [d.LB1, d.LB2, d.LB3, d.CB1, d.CB2, d.FS, d.SS]
    : [d.DE1, d.DT1, d.DT2, d.DE2, d.LB1, d.LB2, d.LB3, d.SS];
  return weightedPick(rng, pool, p => p.attrs.TKL ** 2);
}

interface DriveOutcome {
  points: number;
  note?: string;
}

function drive(rng: Rng, o: Lineup, d: Lineup, box: Box): DriveOutcome {
  const u = unitScores(o, d);
  let yard = 25; // distance from own goal line
  let down = 1;
  let toGo = 10;

  for (let play = 0; play < 25; play++) {
    // Fourth down: kick, punt or go for it.
    if (down === 4) {
      const fgDist = 100 - yard + 17;
      const goForIt = toGo <= 1 && yard >= 45 && rng() < 0.6;
      if (!goForIt) {
        if (fgDist <= 55) {
          const make = clamp(1.02 - (fgDist - 18) * 0.017, 0.35, 0.98);
          return rng() < make ? { points: 3, note: `${fgDist}-yd field goal` } : { points: 0 };
        }
        return { points: 0 };
      }
    }

    const passBias = toGo >= 8 ? 0.68 : toGo <= 2 ? 0.35 : 0.55;
    const qbEdge = (o.QB.posOvr.QB - 70) / 200;
    let gained: number;
    let scorer: Player | null = null;
    let passer: Player | null = null;

    if (rng() < passBias + qbEdge) {
      // Pass play.
      const qb = o.QB;
      const sackP = clamp(0.07 + (u.passRush - u.passBlock) / 300, 0.03, 0.14);
      if (rng() < sackP) {
        add(box, weightedPick(rng, [d.DE1, d.DT1, d.DT2, d.DE2, d.LB1, d.LB3], p => p.attrs.STR + p.attrs.SPD), "sack");
        gained = -Math.round(4 + rng() * 5);
      } else {
        const targets: [Player, Player, number][] = [
          [o.WR1, d.CB1, 3], [o.WR2, d.CB2, 2.5], [o.WR3, d.FS, 2], [o.TE, d.SS, 1.6], [o.RB, d.LB2, 1.1],
        ];
        const [rec, cov] = weightedPick(rng, targets, ([r, , w]) => w * (r.attrs.CTH / 70) ** 2);
        add(box, qb, "passAtt");
        const intP = clamp(0.028 + (cov.attrs.COV - qb.attrs.THA) / 800, 0.01, 0.06);
        if (rng() < intP) {
          add(box, qb, "passInt");
          add(box, cov, "defInt");
          return { points: 0 };
        }
        const cmpP = clamp(0.6 + (qb.attrs.THA + rec.attrs.CTH - 2 * cov.attrs.COV) / 300 + (u.passBlock - u.passRush) / 700, 0.4, 0.76);
        if (rng() < cmpP) {
          const air = Math.max(1, normal(rng, 5 + (qb.attrs.THP - 70) / 16, 3.5));
          const yac = Math.max(0, normal(rng, 2.2 + (rec.attrs.SPD - cov.attrs.SPD) / 12, 2.5));
          const breakaway = rng() < clamp(0.025 + (rec.attrs.SPD - cov.attrs.SPD) / 1500, 0.01, 0.05) ? 12 + rng() * 35 : 0;
          gained = Math.round(air + yac + breakaway);
          gained = Math.min(gained, 100 - yard);
          add(box, qb, "passCmp");
          add(box, qb, "passYds", gained);
          add(box, rec, "rec");
          add(box, rec, "recYds", gained);
          if (yard + gained < 100) add(box, tackler(rng, d, true), "tkl");
          scorer = rec;
          passer = qb;
        } else {
          gained = 0;
        }
      }
    } else {
      // Run play.
      const carrier = rng() < 0.88 ? o.RB : o.QB;
      const skill = carrier === o.RB ? o.RB.posOvr.RB : (o.QB.attrs.SPD + o.QB.attrs.AGI) / 2;
      const mean = 3.4 + (u.runBlock - u.runStop) / 8 + (skill - 70) / 16;
      gained = Math.round(normal(rng, mean, 3.4));
      if (rng() < clamp(0.02 + (carrier.attrs.SPD - 70) / 2000, 0.008, 0.04)) gained += Math.round(10 + rng() * 40);
      gained = clamp(gained, -5, 100 - yard);
      add(box, carrier, "rushAtt");
      add(box, carrier, "rushYds", gained);
      if (yard + gained < 100) add(box, tackler(rng, d, gained > 8), "tkl");
      scorer = carrier;
    }

    // Fumbles are rare; they end the drive.
    if (gained > 0 && rng() < 0.008) return { points: 0 };

    yard += gained;
    if (yard >= 100) {
      if (passer) {
        add(box, passer, "passTd");
        add(box, scorer!, "recTd");
      } else {
        add(box, scorer!, "rushTd");
      }
      const xp = rng() < 0.94 ? 1 : 0;
      const how = passer ? `${passer.name} ${gained}-yd TD pass to ${scorer!.name}` : `${scorer!.name} ${gained}-yd TD run`;
      return { points: 6 + xp, note: xp ? how : `${how} (XP missed)` };
    }
    if (yard <= 0) return { points: 0, note: "Safety" }; // credited below
    toGo -= gained;
    if (toGo <= 0) {
      down = 1;
      toGo = Math.min(10, 100 - yard);
    } else if (++down > 4) {
      return { points: 0 }; // turnover on downs
    }
  }
  return { points: 0 };
}

export function simGame(league: League, game: Game, byId: Map<number, Player>): GameResult {
  const rng = rngFor(league.seed, `game-${game.id}`);
  const team = (id: number) => league.teams.find(t => t.id === id)!;
  const sides = [lineup(team(game.home), byId), lineup(team(game.away), byId)];
  const names = [team(game.home).name, team(game.away).name];
  const score: [number, number] = [0, 0];
  const box: Box = {};
  const plays: string[] = [];

  const possess = (i: 0 | 1, label: string) => {
    const out = drive(rng, sides[i], sides[1 - i], box);
    if (out.note === "Safety") {
      score[1 - i] += 2;
      plays.push(`${label} · ${names[1 - i]} safety`);
    } else if (out.points) {
      score[i] += out.points;
      plays.push(`${label} · ${names[i]}: ${out.note}`);
    }
  };

  const first = rng() < 0.5 ? 0 : 1;
  for (let n = 0; n < POSSESSIONS * 2; n++) {
    const i = ((n + first) % 2) as 0 | 1;
    possess(i, `Q${Math.min(4, Math.floor(n / ((POSSESSIONS * 2) / 4)) + 1)}`);
  }
  for (let r = 0; r < MAX_OT_ROUNDS && score[0] === score[1]; r++) {
    possess(0, "OT");
    possess(1, "OT");
  }
  return { score, stats: box, plays };
}

// ---- Season ----

/** Round-robin weeks (circle method), repeated so each team plays about `targetGames`. */
export function buildSchedule(teamIds: number[], targetGames = 10): Game[][] {
  const ids = teamIds.length % 2 ? [...teamIds, -1] : [...teamIds];
  const n = ids.length;
  const oneRound: [number, number][][] = [];
  const rot = [...ids];
  for (let w = 0; w < n - 1; w++) {
    const week: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      if (a !== -1 && b !== -1) week.push(w % 2 ? [a, b] : [b, a]);
    }
    oneRound.push(week);
    rot.splice(1, 0, rot.pop()!);
  }
  const gamesPerRound = teamIds.length - 1;
  const reps = Math.max(1, Math.round(targetGames / gamesPerRound));
  const weeks: Game[][] = [];
  for (let r = 0; r < reps; r++) {
    for (const week of oneRound) {
      const wk = weeks.length;
      // Flip home/away on alternate repeats.
      weeks.push(week.map(([h, a], i) => {
        const [home, away] = r % 2 ? [a, h] : [h, a];
        return { id: `w${wk}-${i}`, home, away };
      }));
    }
  }
  return weeks;
}

export interface StandingRow {
  teamId: number;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
}

export function standings(league: League): StandingRow[] {
  const rows = new Map<number, StandingRow>(
    league.teams.map(t => [t.id, { teamId: t.id, w: 0, l: 0, t: 0, pf: 0, pa: 0 }]),
  );
  for (const week of league.season?.weeks ?? []) {
    for (const g of week) {
      if (!g.result) continue;
      const [hs, as] = g.result.score;
      const h = rows.get(g.home)!;
      const a = rows.get(g.away)!;
      h.pf += hs; h.pa += as; a.pf += as; a.pa += hs;
      if (hs > as) { h.w++; a.l++; } else if (as > hs) { a.w++; h.l++; } else { h.t++; a.t++; }
    }
  }
  const pct = (r: StandingRow) => (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t);
  return [...rows.values()].sort((x, y) => pct(y) - pct(x) || (y.pf - y.pa) - (x.pf - x.pa) || y.pf - x.pf);
}

export function playoffTeamCount(n: number) {
  return n >= 4 ? 4 : 2;
}

function playGames(league: League, games: Game[], byId: Map<number, Player>) {
  return games.map(g => (g.result ? g : { ...g, result: simGame(league, g, byId) }));
}

/** Playoff games can't end tied; replay the coin-flip until someone wins. */
function decide(league: League, g: Game, byId: Map<number, Player>): Game {
  let result = simGame(league, g, byId);
  for (let k = 1; result.score[0] === result.score[1]; k++) {
    result = simGame(league, { ...g, id: `${g.id}-r${k}` }, byId);
  }
  return { ...g, result };
}

const winner = (g: Game) => (g.result!.score[0] > g.result!.score[1] ? g.home : g.away);

export function startSeason(league: League): League {
  const season: SeasonState = {
    weeks: buildSchedule(league.teams.map(t => t.id)),
    week: 0,
    playoffs: [],
    championId: null,
  };
  return { ...league, phase: "season", season };
}

export function inPlayoffs(league: League) {
  const s = league.season;
  return !!s && s.week >= s.weeks.length;
}

/** Advances one step: the next regular-season week, or the next playoff round. */
export function advance(league: League, byId: Map<number, Player>): League {
  const s = league.season;
  if (!s || s.championId != null) return league;

  if (s.week < s.weeks.length) {
    const weeks = s.weeks.map((wk, i) => (i === s.week ? playGames(league, wk, byId) : wk));
    return { ...league, season: { ...s, weeks, week: s.week + 1 } };
  }

  // Playoffs: seed by standings, 1 v 4 and 2 v 3, then a final.
  const seeds = standings(league).slice(0, playoffTeamCount(league.teams.length)).map(r => r.teamId);
  let round: Game[];
  if (s.playoffs.length === 0 && seeds.length === 4) {
    round = [
      { id: "semi-0", home: seeds[0], away: seeds[3] },
      { id: "semi-1", home: seeds[1], away: seeds[2] },
    ];
  } else {
    const prev = s.playoffs[s.playoffs.length - 1];
    const [a, b] = prev ? prev.map(winner) : seeds;
    const seedOf = (id: number) => seeds.indexOf(id);
    const [home, away] = seedOf(a) <= seedOf(b) ? [a, b] : [b, a];
    round = [{ id: "final", home, away }];
  }
  round = round.map(g => decide(league, g, byId));
  const playoffs = [...s.playoffs, round];
  const championId = round.length === 1 && round[0].id === "final" ? winner(round[0]) : null;
  return {
    ...league,
    phase: championId != null ? "done" : league.phase,
    season: { ...s, playoffs, championId },
  };
}

export function simToEnd(league: League, byId: Map<number, Player>): League {
  let l = league;
  for (let guard = 0; guard < 100 && l.season?.championId == null; guard++) l = advance(l, byId);
  return l;
}

// ---- Season stats & awards ----

export function seasonStats(league: League, includePlayoffs = false) {
  const totals = new Map<number, StatLine & { gp: number }>();
  const games = [
    ...(league.season?.weeks.flat() ?? []),
    ...(includePlayoffs ? league.season?.playoffs.flat() ?? [] : []),
  ];
  for (const g of games) {
    if (!g.result) continue;
    for (const [id, line] of Object.entries(g.result.stats)) {
      const t = totals.get(+id) ?? emptyLine();
      for (const [k, v] of Object.entries(line)) t[k as keyof StatLine] += v ?? 0;
      t.gp++;
      totals.set(+id, t);
    }
  }
  return totals;
}

function emptyLine(): StatLine & { gp: number } {
  return {
    passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0,
    rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0,
    tkl: 0, sack: 0, defInt: 0, gp: 0,
  };
}

export const offenseScore = (s: StatLine) =>
  s.passYds / 25 + s.passTd * 4 - s.passInt * 2 + s.rushYds / 10 + s.rushTd * 6 + s.recYds / 10 + s.recTd * 6;

export const defenseScore = (s: StatLine) => s.tkl + s.sack * 4 + s.defInt * 5;

export interface Awards {
  mvp: number | null;
  dpoy: number | null;
}

export function awards(league: League, ownerOf: Map<number, number>): Awards {
  const stats = seasonStats(league);
  const rows = standings(league);
  const winPct = new Map(rows.map(r => [r.teamId, (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t)]));
  const best = (score: (s: StatLine) => number) => {
    let top: [number, number] | null = null;
    for (const [id, s] of stats) {
      const v = score(s) * (0.7 + 0.6 * (winPct.get(ownerOf.get(id) ?? -1) ?? 0));
      if (!top || v > top[1]) top = [id, v];
    }
    return top?.[0] ?? null;
  };
  return { mvp: best(offenseScore), dpoy: best(defenseScore) };
}
