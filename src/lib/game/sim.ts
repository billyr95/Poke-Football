import { chemistry, withChem } from "./chemistry";
import { SLOTS } from "./ratings";
import { fitBonus, isAdvanced, matchupTweak, ratingContext, slotFit, type SimTweak } from "./schemes";
import { normal, rngFor, weightedPick, type Rng } from "./rng";
import { LONG_KEYS, type Game, type GameResult, type League, type Player, type SeasonState, type SlotId, type StatLine, type Team, type TeamLine } from "./types";

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
    roleOvr: { QB: r, RB: r, X: r, Z: r, SLOT: r, TE: r, T: r, G: r, C: r, DE: r, DT: r, OLB: r, MLB: r, CB: r, FS: r, SS: r },
    pos: SLOTS.find(s => s.id === slotId)!.pos, ovr: r,
  };
}

// 🦫 Easter egg: Bidoof is secretly a god. His card shows his real (bad) ratings, but on the field
// he plays with divine ones, and the play-by-play below bends the rules for him wherever he lines up.
// Hosts can turn this off with the "Easter eggs" setting, and then he plays like the Bidoof he looks like.
const BIDOOF = 399;
const DIVINE = 250;
const gods = new WeakSet<Player>();

function divine(p: Player): Player {
  const attrs = Object.fromEntries(Object.keys(p.attrs).map(k => [k, DIVINE])) as Player["attrs"];
  const posOvr = Object.fromEntries(Object.keys(p.posOvr).map(k => [k, DIVINE])) as Player["posOvr"];
  const god = { ...p, attrs, posOvr };
  gods.add(god);
  return god;
}

const isGod = (p: Player | null | undefined) => !!p && gods.has(p);
const godOn = (l: Lineup, side: "off" | "def") => SLOTS.filter(s => s.side === side).map(s => l[s.id]).find(isGod) ?? null;

function lineup(team: Team, byId: Map<number, Player>, league: Pick<League, "settings" | "schemes">): Lineup {
  const chem = chemistry(team, byId, league.settings).bonus;
  const eggs = league.settings.easterEggs ?? true;
  const ctx = ratingContext(league, team);
  return Object.fromEntries(
    SLOTS.map(s => {
      const p = team.roster[s.id] != null ? byId.get(team.roster[s.id]!) : undefined;
      if (!p) return [s.id, standIn(s.id)];
      let withBonus: Player;
      if (ctx.advanced) {
        // Advanced: play at the granular role's rating, and scheme fit lifts or drags everything they do.
        const bonus = (chem.get(p.id) ?? 0) + (ctx.scheme ? fitBonus(slotFit(p.id, s.pos, s.side, ctx.scheme)) : 0);
        const adjusted = withChem(p, bonus);
        withBonus = { ...adjusted, posOvr: { ...adjusted.posOvr, [s.pos]: Math.min(99, p.roleOvr[s.role] + bonus) } };
      } else {
        withBonus = withChem(p, chem.get(p.id) ?? 0);
      }
      return [s.id, eggs && p.id === BIDOOF ? divine(withBonus) : withBonus];
    }),
  ) as Lineup;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function unitScores(o: Lineup, d: Lineup, t: Required<SimTweak>) {
  const ol = [o.LT, o.LG, o.C, o.RG, o.RT];
  const dl = [d.DE1, d.DT1, d.DT2, d.DE2];
  const lb = [d.LB1, d.LB2, d.LB3];
  return {
    runBlock: avg(ol.map(p => p.posOvr.OL)) * 0.8 + o.TE.attrs.BLK * 0.2,
    passBlock: avg(ol.map(p => p.attrs.BLK)),
    runStop: avg(dl.map(p => p.posOvr.DL)) * 0.55 + avg(lb.map(p => p.posOvr.LB)) * 0.45 + t.stop,
    passRush: avg(dl.map(p => (p.attrs.STR + p.attrs.SPD) / 2)) + t.rush,
  };
}

type Box = Record<number, Partial<StatLine>>;

function add(box: Box, p: Player, key: keyof StatLine, n = 1) {
  if (p.id < 0) return;
  const line = (box[p.id] ??= {});
  line[key] = (line[key] ?? 0) + n;
}

function setLong(box: Box, p: Player, key: (typeof LONG_KEYS)[number], n: number) {
  if (p.id < 0) return;
  const line = (box[p.id] ??= {});
  line[key] = Math.max(line[key] ?? -99, n);
}

export function emptyTeamLine(): TeamLine {
  return {
    plays: 0, firstDowns: 0, totalYds: 0, passYds: 0, rushYds: 0, rushAtt: 0, passAtt: 0,
    thirdAtt: 0, thirdConv: 0, fourthAtt: 0, fourthConv: 0, rzAtt: 0, rzTd: 0,
    turnovers: 0, sacksAllowed: 0, fga: 0, fgm: 0, fgLong: 0, xpa: 0, xpm: 0, punts: 0, puntYds: 0,
  };
}

function tackler(rng: Rng, d: Lineup, deep: boolean): Player {
  const pool = deep
    ? [d.LB1, d.LB2, d.LB3, d.CB1, d.CB2, d.FS, d.SS]
    : [d.DE1, d.DT1, d.DT2, d.DE2, d.LB1, d.LB2, d.LB3, d.SS];
  const god = godOn(d, "def");
  if (god && !pool.includes(god)) pool.push(god); // Bidoof is everywhere at once
  return weightedPick(rng, pool, p => p.attrs.TKL ** 2);
}

const anyDefender = (d: Lineup) => SLOTS.filter(s => s.side === "def").map(s => d[s.id]);

interface DriveOutcome {
  points: number;
  note?: string;
  safety?: boolean;
  /** The defense scored a touchdown (only Bidoof does this). */
  defTd?: boolean;
  /** Where the other team starts: yards from their own goal line. */
  nextStart: number;
}

/** One possession, snap by snap. `start` is yards from the offense's own goal line. */
function drive(rng: Rng, o: Lineup, d: Lineup, box: Box, team: TeamLine, start: number, t: Required<SimTweak>): DriveOutcome {
  const u = unitScores(o, d, t);
  const offGod = godOn(o, "off");
  const defGod = godOn(d, "def");
  let yard = start;
  let down = 1;
  let toGo = 10;
  let inRedZone = false;
  const flip = (spot: number) => clamp(Math.round(100 - spot), 1, 99);

  for (let play = 0; play < 30; play++) {
    if (!inRedZone && yard >= 80) {
      inRedZone = true;
      team.rzAtt++;
    }

    // Fourth down: kick, punt or go for it.
    if (down === 4) {
      const fgDist = 100 - yard + 17;
      const goForIt = (toGo <= 1 && yard >= 45 && rng() < 0.6) || (toGo <= 3 && yard >= 60 && fgDist > 52 && rng() < 0.5);
      if (!goForIt) {
        if (fgDist <= 56) {
          team.fga++;
          const make = clamp(1.04 - (fgDist - 18) * 0.011, 0.45, 0.98);
          if (rng() < make) {
            team.fgm++;
            team.fgLong = Math.max(team.fgLong, fgDist);
            return { points: 3, note: `${fgDist}-yd field goal`, nextStart: 25 };
          }
          return { points: 0, nextStart: flip(Math.max(yard - 7, 20)) };
        }
        const punt = Math.round(clamp(normal(rng, 44, 6), 28, 65));
        team.punts++;
        team.puntYds += punt;
        const landing = yard + punt;
        return { points: 0, nextStart: landing >= 100 ? 20 : flip(landing - Math.round(rng() * 9)) };
      }
    }

    const snapDown = down;
    if (snapDown === 3) team.thirdAtt++;
    if (snapDown === 4) team.fourthAtt++;
    team.plays++;

    const passBias = toGo >= 8 ? 0.64 : toGo <= 2 ? 0.3 : 0.5;
    const qbEdge = (o.QB.posOvr.QB - 70) / 200;
    let gained: number;
    let scorer: Player | null = null;
    let passer: Player | null = null;
    let ballCarrier: Player | null = null;
    let tackledBy: Player | null = null;

    if (rng() < passBias + qbEdge + t.pass) {
      // Pass play.
      const qb = o.QB;
      let sackP = clamp(0.07 + (u.passRush - u.passBlock) / 300, 0.03, 0.14) * t.sack;
      if (isGod(qb)) sackP = 0; // nobody touches him
      else if (defGod) sackP += 0.16;
      if (rng() < sackP) {
        const rusher = defGod ?? weightedPick(rng, [d.DE1, d.DT1, d.DT2, d.DE2, d.LB1, d.LB3], p => p.attrs.STR + p.attrs.SPD);
        gained = -Math.round(4 + rng() * 5);
        add(box, rusher, "sack");
        add(box, rusher, "tfl");
        add(box, rusher, "tkl");
        add(box, qb, "sacked");
        add(box, qb, "sackYdsLost", -gained);
        team.sacksAllowed++;
        team.passYds += gained;
        tackledBy = rusher;
      } else {
        const targets: [Player, Player, number][] = [
          [o.WR1, d.CB1, 3], [o.WR2, d.CB2, 2.5], [o.WR3, d.FS, 2], [o.TE, d.SS, 1.6], [o.RB, d.LB2, 1.1],
        ];
        // An offensive lineman Bidoof reports as eligible and runs routes anyway.
        if (offGod && !isGod(qb) && !targets.some(([r]) => r === offGod)) targets.push([offGod, d.LB1, 3]);
        const [rec, defender] = weightedPick(rng, targets, ([r, , w]) => w * (r.attrs.CTH / 70) ** 2);
        // A defensive Bidoof shadows whoever gets the ball.
        const cov = defGod && !isGod(rec) && !isGod(qb) && rng() < 0.6 ? defGod : defender;
        const godCatch = isGod(qb) || isGod(rec);
        add(box, qb, "passAtt");
        add(box, rec, "targets");
        team.passAtt++;
        let intP = clamp(0.028 + (cov.attrs.COV - qb.attrs.THA) / 800, 0.01, 0.06) + t.int;
        if (godCatch) intP = 0;
        else if (isGod(cov)) intP = 0.2;
        if (rng() < intP) {
          if (isGod(cov) && rng() < 0.55) {
            // Pick-six.
            const ret = yard + 12;
            add(box, qb, "passInt");
            add(box, cov, "defInt");
            add(box, cov, "passDef");
            add(box, cov, "intYds", ret);
            team.turnovers++;
            return { points: 0, defTd: true, note: `${cov.name} ${ret}-yd pick-six`, nextStart: 25 };
          }
          const ret = Math.round(clamp(normal(rng, 8, 10), 0, 60));
          add(box, qb, "passInt");
          add(box, cov, "defInt");
          add(box, cov, "passDef");
          add(box, cov, "intYds", ret);
          team.turnovers++;
          return { points: 0, nextStart: clamp(100 - yard - 12 + ret, 5, 95) };
        }
        let cmpP = clamp(0.57 + (qb.attrs.THA + rec.attrs.CTH - 2 * cov.attrs.COV) / 300 + (u.passBlock - u.passRush) / 700, 0.4, 0.76) + t.cmp;
        if (godCatch) cmpP = 0.96;
        if (rng() < cmpP) {
          const air = Math.max(1, normal(rng, 4.6 + (qb.attrs.THP - 70) / 16 + t.air, 3.5));
          const yacRaw = Math.max(0, normal(rng, 2.2 + (rec.attrs.SPD - cov.attrs.SPD) / 12, 2.5));
          const breakP = godCatch ? 0.3 : clamp(0.025 + (rec.attrs.SPD - cov.attrs.SPD) / 1500, 0.01, 0.05) * t.big;
          const breakaway = rng() < breakP ? 12 + rng() * 35 : 0;
          gained = Math.min(Math.round(air + yacRaw + breakaway), 100 - yard);
          const yac = Math.max(0, gained - Math.round(air));
          add(box, qb, "passCmp");
          add(box, qb, "passYds", gained);
          setLong(box, qb, "passLong", gained);
          add(box, rec, "rec");
          add(box, rec, "recYds", gained);
          add(box, rec, "yac", yac);
          setLong(box, rec, "recLong", gained);
          team.passYds += gained;
          scorer = rec;
          passer = qb;
          ballCarrier = rec;
          if (yard + gained < 100) {
            tackledBy = tackler(rng, d, true);
            add(box, tackledBy, "tkl");
          }
        } else {
          gained = 0;
          if (rng() < 0.2) add(box, cov, "passDef");
        }
      }
    } else {
      // Run play.
      // Wherever Bidoof lines up on offense, the coach finds a way to hand him the ball.
      const carrier = offGod && offGod !== o.RB && offGod !== o.QB && rng() < 0.6 ? offGod : rng() < 1 - t.qbRun ? o.RB : o.QB;
      const skill = isGod(carrier) ? DIVINE : carrier === o.RB ? o.RB.posOvr.RB : (o.QB.attrs.SPD + o.QB.attrs.AGI) / 2;
      const mean = 3.8 + (u.runBlock - u.runStop) / 8 + (skill - 70) / 16 + t.run;
      gained = Math.round(normal(rng, mean, 3.4));
      const breakP = isGod(carrier) ? 0.3 : clamp(0.02 + (carrier.attrs.SPD - 70) / 2000, 0.008, 0.04) * t.big;
      if (rng() < breakP) gained += Math.round(10 + rng() * 40);
      gained = clamp(gained, -5, 100 - yard);
      add(box, carrier, "rushAtt");
      add(box, carrier, "rushYds", gained);
      setLong(box, carrier, "rushLong", gained);
      team.rushAtt++;
      team.rushYds += gained;
      scorer = carrier;
      ballCarrier = carrier;
      if (yard + gained < 100) {
        tackledBy = tackler(rng, d, gained > 8);
        add(box, tackledBy, "tkl");
        if (gained < 0) add(box, tackledBy, "tfl");
      }
    }
    team.totalYds += gained;

    // Fumbles: about 1 in 90 touches; the defense recovers a little over half.
    const fumbleP = isGod(ballCarrier) ? 0 : isGod(tackledBy) ? 0.12 : 0.011;
    if (ballCarrier && tackledBy && gained > 0 && rng() < fumbleP) {
      add(box, ballCarrier, "fumbles");
      add(box, tackledBy, "ff");
      if (isGod(tackledBy) || rng() < 0.55) {
        add(box, ballCarrier, "fumblesLost");
        add(box, isGod(tackledBy) ? tackledBy! : weightedPick(rng, anyDefender(d), p => p.attrs.AWR), "fr");
        team.turnovers++;
        return { points: 0, nextStart: flip(yard + gained) };
      }
    }

    yard += gained;
    if (yard >= 100) {
      if (snapDown === 3) team.thirdConv++;
      if (snapDown === 4) team.fourthConv++;
      team.firstDowns++;
      if (inRedZone) team.rzTd++;
      if (passer) {
        add(box, passer, "passTd");
        add(box, scorer!, "recTd");
      } else {
        add(box, scorer!, "rushTd");
      }
      team.xpa++;
      const xp = rng() < 0.94 ? 1 : 0;
      team.xpm += xp;
      const how = passer ? `${passer.name} ${gained}-yd TD pass to ${scorer!.name}` : `${scorer!.name} ${gained}-yd TD run`;
      return { points: 6 + xp, note: xp ? how : `${how} (XP missed)`, nextStart: 25 };
    }
    if (yard <= 0) {
      if (tackledBy) add(box, tackledBy, "safety");
      return { points: 0, safety: true, nextStart: 35 }; // free kick after a safety
    }
    toGo -= gained;
    if (toGo <= 0) {
      if (snapDown === 3) team.thirdConv++;
      if (snapDown === 4) team.fourthConv++;
      team.firstDowns++;
      down = 1;
      toGo = Math.min(10, 100 - yard);
    } else if (++down > 4) {
      return { points: 0, nextStart: flip(yard) };
    }
  }
  return { points: 0, nextStart: flip(yard) };
}

export function simGame(league: League, game: Game, byId: Map<number, Player>): GameResult {
  const rng = rngFor(league.seed, `game-${game.id}`);
  const team = (id: number) => league.teams.find(t => t.id === id)!;
  const sides = [lineup(team(game.home), byId, league), lineup(team(game.away), byId, league)];
  const schemeOf = (id: number) => (isAdvanced(league.settings) ? league.schemes?.[id] ?? null : null);
  const schemes = [schemeOf(game.home), schemeOf(game.away)];
  const names = [team(game.home).name, team(game.away).name];
  const score: [number, number] = [0, 0];
  const box: Box = {};
  const teamStats: [TeamLine, TeamLine] = [emptyTeamLine(), emptyTeamLine()];
  const plays: string[] = [];
  let start = 25;

  const possess = (i: 0 | 1, label: string) => {
    const out = drive(rng, sides[i], sides[1 - i], box, teamStats[i], start, matchupTweak(schemes[i], schemes[1 - i]));
    start = out.nextStart;
    if (out.safety) {
      score[1 - i] += 2;
      plays.push(`${label} · ${names[1 - i]}: safety`);
    } else if (out.defTd) {
      score[1 - i] += 7;
      plays.push(`${label} · ${names[1 - i]}: ${out.note}`);
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
    start = 25;
    possess(0, "OT");
    start = 25;
    possess(1, "OT");
  }
  return { score, stats: box, team: teamStats, plays };
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

export type SeasonLine = StatLine & { gp: number };

function gamesOf(league: League, includePlayoffs: boolean) {
  return [
    ...(league.season?.weeks.flat() ?? []),
    ...(includePlayoffs ? league.season?.playoffs.flat() ?? [] : []),
  ].filter(g => g.result);
}

/** Season totals per player. GP counts every game their team played. */
export function seasonStats(league: League, includePlayoffs = false) {
  const teamOf = new Map(league.draft.log.map(p => [p.playerId, p.teamId]));
  const totals = new Map<number, SeasonLine>();
  for (const id of teamOf.keys()) totals.set(id, emptyLine());
  for (const g of gamesOf(league, includePlayoffs)) {
    for (const [id, t] of totals) {
      const team = teamOf.get(id);
      if (team === g.home || team === g.away) t.gp++;
    }
    for (const [id, line] of Object.entries(g.result!.stats)) {
      const t = totals.get(+id) ?? emptyLine();
      for (const [k, v] of Object.entries(line) as [keyof StatLine, number][]) {
        if ((LONG_KEYS as readonly string[]).includes(k)) t[k] = Math.max(t[k], v ?? 0);
        else t[k] += v ?? 0;
      }
      totals.set(+id, t);
    }
  }
  return totals;
}

export type TeamSeasonLine = TeamLine & { g: number; pf: number; pa: number; takeaways: number; oppYds: number };

/** Season totals per team, including what they allowed. */
export function teamSeasonStats(league: League, includePlayoffs = false) {
  const out = new Map<number, TeamSeasonLine>(
    league.teams.map(t => [t.id, { ...emptyTeamLine(), g: 0, pf: 0, pa: 0, takeaways: 0, oppYds: 0 }]),
  );
  for (const g of gamesOf(league, includePlayoffs)) {
    const r = g.result!;
    ([[g.home, 0], [g.away, 1]] as const).forEach(([id, i]) => {
      const t = out.get(id)!;
      t.g++;
      t.pf += r.score[i];
      t.pa += r.score[1 - i];
      if (!r.team) return;
      const mine = r.team[i];
      const theirs = r.team[1 - i];
      for (const k of Object.keys(mine) as (keyof TeamLine)[]) {
        if (k === "fgLong") t.fgLong = Math.max(t.fgLong, mine.fgLong);
        else t[k] += mine[k];
      }
      t.takeaways += theirs.turnovers;
      t.oppYds += theirs.totalYds;
    });
  }
  return out;
}

/** NFL passer rating (0–158.3). */
export function passerRating(s: Pick<StatLine, "passAtt" | "passCmp" | "passYds" | "passTd" | "passInt">) {
  if (!s.passAtt) return 0;
  const part = (x: number) => Math.max(0, Math.min(2.375, x));
  const a = part((s.passCmp / s.passAtt - 0.3) * 5);
  const b = part((s.passYds / s.passAtt - 3) * 0.25);
  const c = part((s.passTd / s.passAtt) * 20);
  const d = part(2.375 - (s.passInt / s.passAtt) * 25);
  return ((a + b + c + d) / 6) * 100;
}

export function emptyLine(): SeasonLine {
  return {
    passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, passLong: 0, sacked: 0, sackYdsLost: 0,
    rushAtt: 0, rushYds: 0, rushTd: 0, rushLong: 0, fumbles: 0, fumblesLost: 0,
    targets: 0, rec: 0, recYds: 0, recTd: 0, recLong: 0, yac: 0,
    tkl: 0, tfl: 0, sack: 0, defInt: 0, intYds: 0, passDef: 0, ff: 0, fr: 0, safety: 0,
    gp: 0,
  };
}

export const offenseScore = (s: StatLine) =>
  s.passYds / 25 + s.passTd * 4 - s.passInt * 2 + s.rushYds / 10 + s.rushTd * 6 + s.recYds / 10 + s.recTd * 6;

export const defenseScore = (s: StatLine) =>
  s.tkl + s.tfl + s.sack * 4 + s.defInt * 5 + s.passDef * 1.5 + s.ff * 3 + s.fr * 2 + s.safety * 4;

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
