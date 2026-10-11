import data from "@/data/schemes.json";
import type { League, LeagueSettings, Player, Pos, Slot, Team } from "./types";

/**
 * Advanced mode: every team picks an offensive scheme, a defensive front and a coverage.
 *
 * Each Pokémon has a scouting fit (1–5) for every scheme (scripts/data/scheme-scouting.csv).
 * Fit moves their rating at every spot on that side of the ball, and the schemes themselves
 * change how games play out (pass/run mix, depth of throws, pressure, big plays allowed).
 */

export type OffScheme =
  | "West_Coast" | "Air_Coryell" | "Erhardt_Perkins" | "Air_Raid" | "Run_Shoot" | "Spread_Option" | "RPO"
  | "Zone_Read" | "Shanahan_Outside_Zone" | "Power_GAP" | "Pistol" | "Option" | "I_Formation" | "Modern_Hybrid";
export type Front = "4_3" | "3_4" | "4_2_5_Nickel" | "3_3_5" | "3_4_Under" | "Bear" | "Wide_9" | "NASCAR_Pass_Rush";
export type Coverage =
  | "Tampa_2" | "Cover_2" | "Cover_3" | "Cover_4_Quarters" | "Cover_6" | "Cover_1" | "Cover_0"
  | "Cover_2_Man" | "Cover_3_Match" | "Cover_4_Match" | "Zone_Blitz" | "Fire_Zone";

export interface TeamScheme {
  off: OffScheme;
  front: Front;
  cov: Coverage;
}

export const DEFAULT_SCHEME: TeamScheme = { off: "Modern_Hybrid", front: "4_3", cov: "Cover_3" };
export const SCHEME_SECONDS = 60;

/** How a scheme bends the play-by-play. Every field is optional and neutral when missing. */
export interface SimTweak {
  pass?: number; // added to the chance of calling a pass
  air?: number; // yards added to the average throw depth
  cmp?: number; // added to completion chance
  int?: number; // added to interception chance
  run?: number; // yards added to the average run
  qbRun?: number; // share of runs the QB keeps (default 0.12)
  big?: number; // multiplier on breakaway chance
  sack?: number; // multiplier on sack chance
  rush?: number; // pass-rush rating points (defense)
  stop?: number; // run-stop rating points (defense)
}

interface SchemeInfo {
  label: string;
  blurb: string;
  pros: string;
  cons: string;
  tweak: SimTweak;
  /** From the scheme guide: the formation it's run from, who's on the field, and its alternate package. */
  formation?: string;
  field?: string;
  alternate?: string;
}

export const OFFENSES: Record<OffScheme, SchemeInfo> = {
  West_Coast: {
    label: "West Coast", blurb: "Short, timed passing that sets up the run.",
    pros: "High-percentage throws, handles the blitz, gets RBs and TEs involved.", cons: "Fewer explosive plays.",
    tweak: { pass: 0.05, air: -1.2, cmp: 0.05, sack: 0.85, big: 0.85 }, formation: "Pro Set / Split Backs, under center", field: "QB, RB, FB, TE, 2 WR, 5 OL", alternate: "11 personnel (1 RB, 1 TE, 3 WR) in Shotgun or Singleback",
  },
  Air_Coryell: {
    label: "Air Coryell", blurb: "Vertical passing that stretches the defense deep.",
    pros: "Explosive plays, punishes aggressive safeties.", cons: "Needs protection; incompletions stall drives.",
    tweak: { pass: 0.08, air: 2.5, cmp: -0.05, big: 1.4, sack: 1.2 }, formation: "Singleback, under center (deep drops / play action)", field: "QB, RB, TE, 3 WR, 5 OL", alternate: "12 personnel (1 RB, 2 TE, 2 WR) for max-protect play action",
  },
  Erhardt_Perkins: {
    label: "Erhardt–Perkins", blurb: "Concept-based, flexible, no-huddle friendly.",
    pros: "Hard to predict, adapts to any look.", cons: "Needs smart players.",
    tweak: { pass: 0.03, cmp: 0.02, int: -0.004 }, formation: "Singleback / Ace (multiple, frequent motion)", field: "QB, RB, 2 TE, 2 WR, 5 OL", alternate: "11 personnel from Shotgun for no-huddle",
  },
  Air_Raid: {
    label: "Air Raid", blurb: "Spread passing that forces you to cover the whole field.",
    pros: "Huge passing numbers, beats stacked boxes.", cons: "Run game takes a back seat; leans on the QB.",
    tweak: { pass: 0.15, air: 0.8, cmp: 0.02, sack: 1.1, run: -0.3 }, formation: "Shotgun 2x2 (Spread) or 3x1 (Trips)", field: "QB, RB, 4 WR, 5 OL", alternate: "00 personnel (Empty, 5 WR) on obvious passing downs",
  },
  Run_Shoot: {
    label: "Run & Shoot", blurb: "Receivers adjust routes to the coverage they see.",
    pros: "Mismatches, excellent against man coverage.", cons: "Miscommunication is costly.",
    tweak: { pass: 0.12, air: 1, big: 1.2, int: 0.005 }, formation: "Run-and-Shoot Doubles (2x2), under center or Shotgun", field: "QB, RB, 2 WR, 2 Slot WR, 5 OL", alternate: "Trips (3x1) with motion",
  },
  Spread_Option: {
    label: "Spread Option", blurb: "Spreads the field and makes the QB a running threat.",
    pros: "Numbers advantages, puts defenders in conflict.", cons: "QB takes hits; needs a mobile QB.",
    tweak: { pass: -0.08, qbRun: 0.3, run: 0.4 }, formation: "Shotgun 2x2 or Trips, RB offset beside QB", field: "Mobile QB, RB, TE, 3 WR, 5 OL", alternate: "10 personnel (4 WR) for wider spacing",
  },
  RPO: {
    label: "RPO", blurb: "Run-pass options: the QB reads one defender and picks.",
    pros: "Easy throws, punishes aggressive linebackers.", cons: "Needs a fast-processing QB.",
    tweak: { cmp: 0.04, run: 0.3, qbRun: 0.15 }, formation: "Shotgun Trips or 2x2", field: "QB, RB, TE, 3 WR, 5 OL", alternate: "12 personnel (2 TE) to force base defense, then throw",
  },
  Zone_Read: {
    label: "Zone Read", blurb: "QB reads the edge and gives or keeps.",
    pros: "Adds the QB as a runner, punishes crashing ends.", cons: "Less useful with a statue at QB.",
    tweak: { pass: -0.06, qbRun: 0.25, run: 0.3 }, formation: "Shotgun (RB beside QB) or Pistol", field: "Mobile QB, RB, TE, 3 WR, 5 OL", alternate: "12 personnel with the TE as split-zone blocker",
  },
  Shanahan_Outside_Zone: {
    label: "Shanahan Zone", blurb: "Outside zone with play-action and bootlegs off it.",
    pros: "Cutback lanes, great play-action shots.", cons: "Needs athletic linemen; dominant fronts hurt it.",
    tweak: { pass: -0.05, run: 0.5, big: 1.15 }, formation: "Offset I / Under center with heavy motion", field: "QB, RB, FB, TE, 2 WR, 5 OL", alternate: "11 personnel under center (McVay style); 12 personnel",
  },
  Power_GAP: {
    label: "Power / Gap", blurb: "Downhill, physical gap runs.",
    pros: "Defined lanes, wears defenses down, great in short yardage.", cons: "Predictable; heavy boxes hurt.",
    tweak: { pass: -0.12, run: 0.7, big: 0.8 }, formation: "Singleback / Ace, under center", field: "QB, RB, 2 TE, 2 WR, 5 OL", alternate: "22 personnel (2 RB, 2 TE, 1 WR) in short yardage",
  },
  Pistol: {
    label: "Pistol", blurb: "QB a few yards back, RB behind him: downhill runs plus spread looks.",
    pros: "Balanced, disguises direction.", cons: "Less natural for straight drop-back passing.",
    tweak: { pass: -0.03, qbRun: 0.15, run: 0.3 }, formation: "Pistol (QB ~4 yds deep, RB directly behind)", field: "QB, RB, TE, 3 WR, 5 OL", alternate: "12 personnel Pistol with a wing TE",
  },
  Option: {
    label: "Option", blurb: "Triple option: the QB chooses among several ball carriers.",
    pros: "Controls the clock, neutralises better talent.", cons: "Passing game is limited.",
    tweak: { pass: -0.2, qbRun: 0.35, run: 0.6, cmp: -0.04 }, formation: "Flexbone, under center", field: "QB, FB, 2 Slotbacks (RB), 2 WR, 5 OL", alternate: "Wishbone: 30 personnel with FB + 2 HB behind QB",
  },
  I_Formation: {
    label: "I-Formation", blurb: "Smashmouth: fullback, tailback, physical blocking.",
    pros: "Short yardage, strong play action.", cons: "Predictable; defenses stack the box.",
    tweak: { pass: -0.15, run: 0.6, big: 0.85, sack: 0.9 }, formation: "I-Formation, under center", field: "QB, HB, FB, TE, 2 WR, 5 OL", alternate: "22 personnel (Heavy I, 1 WR); 23 personnel goal line",
  },
  Modern_Hybrid: {
    label: "Modern Hybrid", blurb: "West Coast timing, Coryell verticals, RPOs and zone runs.",
    pros: "Adaptable, attacks everywhere.", cons: "Can lose identity.",
    tweak: {}, formation: "Shotgun and Singleback mix", field: "QB, RB, TE, 3 WR, 5 OL", alternate: "12 and 21 personnel by down/distance",
  },
};

export const FRONTS: Record<Front, SchemeInfo> = {
  "4_3": { label: "4–3", blurb: "Four linemen, three linebackers.", pros: "Four-man rush, strong run defense.", cons: "Stressed by spread offenses.", tweak: { stop: 3, rush: 2 }, formation: "4–3 Over/Even" },
  "3_4": { label: "3–4", blurb: "Three linemen, four linebackers.", pros: "Blitz disguise, confuses protections.", cons: "Needs versatile linebackers.", tweak: { rush: 3 }, formation: "3–4 Okie (odd front)" },
  "4_2_5_Nickel": { label: "4–2–5 Nickel", blurb: "Extra defensive back for the slot.", pros: "Strong against modern passing.", cons: "Lighter against the run.", tweak: { stop: -3, cmp: -0.02 }, formation: "4–2–5" },
  "3_3_5": { label: "3–3–5", blurb: "Three down, three backers, five DBs.", pros: "Disguise and pressure against spread.", cons: "Struggles with power runs.", tweak: { stop: -4, rush: 2, cmp: -0.02 }, formation: "3–3–5 Stack / Tite" },
  "3_4_Under": { label: "3–4 Under", blurb: "Front shifted to create edge matchups.", pros: "Strong edge pressure.", cons: "Can open run gaps.", tweak: { rush: 4, stop: -1 }, formation: "3–4 Under (front shaded weak, SAM on the line strong)" },
  Bear: { label: "Bear", blurb: "Five-man front covering center and guards.", pros: "Smothers inside and zone runs.", cons: "Edges and passes are softer.", tweak: { stop: 8, rush: 1, big: 1.15 }, formation: "Bear / 46: NT over C, DTs over both G, SAM + WILL on the line", alternate: "Goal line: 5 DL, 3 LB, 3 DB" },
  Wide_9: { label: "Wide 9", blurb: "Ends split way outside the tackles.", pros: "Elite pass-rush angles, stresses outside zone.", cons: "Opens inside run lanes.", tweak: { rush: 5, stop: -3 }, formation: "4–3 with DEs in the 9-technique", alternate: "Nickel 4–2–5" },
  NASCAR_Pass_Rush: { label: "NASCAR", blurb: "Four pure pass rushers on the field.", pros: "Maximum pass rush.", cons: "Weak against the run and screens.", tweak: { rush: 7, stop: -8 }, formation: "4–1–6 with four edge rushers across the line" },
};

export const COVERAGES: Record<Coverage, SchemeInfo> = {
  Tampa_2: { label: "Tampa 2", blurb: "Cover 2 with the MLB running the deep middle.", pros: "Protects deep, takeaways underneath.", cons: "Seams can be stressed.", tweak: { big: 0.8, cmp: 0.02, int: 0.004 }, formation: "4–3 Over with two-high shell", alternate: "Nickel 4–2–5 vs 3 WR" },
  Cover_2: { label: "Cover 2", blurb: "Two deep safeties, zones underneath.", pros: "Keeps everything in front.", cons: "Deep middle is open.", tweak: { big: 0.8, cmp: 0.03, stop: 1 }, formation: "Two-high shell, hard (squat) corners", alternate: "Nickel 4–2–5 vs 11 personnel" },
  Cover_3: { label: "Cover 3", blurb: "Three deep zones, four underneath.", pros: "Balanced, good run support.", cons: "Seams and flats can be attacked.", tweak: { stop: 2 }, formation: "Single-high, SS rotated into the box", alternate: "Nickel 4–2–5" },
  Cover_4_Quarters: { label: "Cover 4", blurb: "Quarters: four deep defenders.", pros: "Eliminates the deep ball.", cons: "Soft underneath.", tweak: { big: 0.65, cmp: 0.04, stop: 1 }, formation: "4–2–5, two-high shell", alternate: "Base 4–3" },
  Cover_6: { label: "Cover 6", blurb: "Quarters to one side, Cover 2 to the other.", pros: "Different answers by side.", cons: "Complex; the weak side gets attacked.", tweak: { big: 0.75, cmp: 0.02 }, formation: "4–2–5, two-high shell (Quarters to strength, Cover 2 to weak)" },
  Cover_1: { label: "Cover 1", blurb: "Man coverage with one deep safety.", pros: "Aggressive, strong against the run.", cons: "Elite receivers win one-on-one.", tweak: { cmp: -0.04, big: 1.15, stop: 3 }, formation: "4–2–5, single-high; SS/LB as robber or rusher", alternate: "Base 4–3 vs 21/12 personnel" },
  Cover_0: { label: "Cover 0", blurb: "Pure man, everyone else rushes.", pros: "Maximum pressure, forces quick decisions.", cons: "No deep help at all.", tweak: { sack: 1.5, cmp: -0.06, big: 1.7 }, formation: "4–2–5 with six-man pressure, no deep safety", alternate: "3–4 base with both OLB + an ILB rushing" },
  Cover_2_Man: { label: "Cover 2 Man", blurb: "Man underneath, two safeties deep.", pros: "Takes away easy throws.", cons: "Scrambling QBs hurt it.", tweak: { cmp: -0.05, big: 0.9 }, formation: "4–1–6, two-high shell", alternate: "Nickel 4–2–5" },
  Cover_3_Match: { label: "Cover 3 Match", blurb: "Cover 3 that matches routes.", pros: "Handles modern route combos.", cons: "Mistakes become big plays.", tweak: { cmp: -0.02, big: 0.9 }, formation: "4–2–5, single-high" },
  Cover_4_Match: { label: "Cover 4 Match", blurb: "Quarters that matches routes.", pros: "Excellent against modern passing.", cons: "Play action can fool safeties.", tweak: { cmp: -0.02, big: 0.75 }, formation: "4–2–5, two-high shell" },
  Zone_Blitz: { label: "Zone Blitz", blurb: "Surprise rushers, others drop into zones.", pros: "Confuses protections, baits QBs.", cons: "Busts give up huge plays.", tweak: { sack: 1.25, int: 0.008, big: 1.2 }, formation: "3–4 Okie; a DE drops while LBs/DBs rush", alternate: "3–3–5 Nickel" },
  Fire_Zone: { label: "Fire Zone", blurb: "Five rushers, three deep, three under.", pros: "Pressure without leaving zero coverage.", cons: "Quick throws beat it.", tweak: { sack: 1.2, cmp: 0.02, big: 1.15 }, formation: "5 rush / 3 under / 3 deep", alternate: "3–3–5 Nickel" },
};

/** A few well-known scheme counters (from the scheme guide), as extra yards per run / breakaway multipliers. */
const COUNTERS: { off: OffScheme[]; def: (Front | Coverage)[]; tweak: SimTweak }[] = [
  { off: ["Power_GAP", "I_Formation"], def: ["3_3_5", "4_2_5_Nickel", "Wide_9", "NASCAR_Pass_Rush"], tweak: { run: 0.8 } },
  { off: ["Shanahan_Outside_Zone", "Zone_Read"], def: ["Bear"], tweak: { run: -1 } },
  { off: ["Shanahan_Outside_Zone"], def: ["Wide_9"], tweak: { run: -0.6 } },
  { off: ["Air_Coryell", "Air_Raid"], def: ["Cover_4_Quarters", "Cover_4_Match", "Tampa_2"], tweak: { big: 0.8 } },
  { off: ["Run_Shoot"], def: ["Cover_1", "Cover_0", "Cover_2_Man"], tweak: { cmp: 0.05 } },
  { off: ["West_Coast", "RPO"], def: ["Cover_0", "Zone_Blitz", "Fire_Zone"], tweak: { sack: 0.7 } },
  { off: ["Spread_Option", "Option", "Zone_Read"], def: ["Cover_0", "Cover_1", "Cover_2_Man"], tweak: { run: 0.6 } },
];

const SCHEME_DATA = data as {
  off: OffScheme[];
  def: (Front | Coverage)[];
  profiles: { archetype: string; ideal: string; off: number[]; def: number[] }[];
  mon: Record<string, number>;
};

const profileOf = (dexId: number) => SCHEME_DATA.profiles[SCHEME_DATA.mon[dexId] ?? 0];

/** Scouting fit (1–5) of a Pokémon for a scheme. */
export function schemeFit(dexId: number, scheme: OffScheme | Front | Coverage): number {
  const p = profileOf(dexId);
  const off = SCHEME_DATA.off.indexOf(scheme as OffScheme);
  return off >= 0 ? p.off[off] : p.def[SCHEME_DATA.def.indexOf(scheme as Front | Coverage)] ?? 3;
}

export function scouting(dexId: number) {
  const p = profileOf(dexId);
  const best = <K extends string>(keys: K[], scores: number[]) => {
    const top = Math.max(...scores);
    return keys.filter((_, i) => scores[i] === top);
  };
  const isFront = (k: string) => k in FRONTS;
  return {
    archetype: p.archetype,
    ideal: p.ideal,
    bestOff: best(SCHEME_DATA.off, p.off),
    bestFront: best(SCHEME_DATA.def.filter(isFront), p.def.filter((_, i) => isFront(SCHEME_DATA.def[i]))),
    bestCov: best(SCHEME_DATA.def.filter(k => !isFront(k)), p.def.filter((_, i) => !isFront(SCHEME_DATA.def[i]))),
  };
}

/** Fit to rating points: 4 is neutral, 5 is +3, and each step down costs 3. */
export const fitBonus = (fit: number) => Math.round((fit - 4) * 3);

/** The scheme fit that applies at a spot: linemen care about the front, DBs the coverage, linebackers both. */
export function slotFit(dexId: number, pos: Pos, side: "off" | "def", scheme: TeamScheme): number {
  if (side === "off") return schemeFit(dexId, scheme.off);
  if (pos === "DL") return schemeFit(dexId, scheme.front);
  if (pos === "LB") return Math.round((schemeFit(dexId, scheme.front) + schemeFit(dexId, scheme.cov)) / 2);
  return schemeFit(dexId, scheme.cov);
}

export type RatingContext = { advanced: boolean; scheme: TeamScheme | null };

export function ratingContext(league: Pick<League, "settings" | "schemes"> | null | undefined, team: Pick<Team, "id"> | null | undefined): RatingContext {
  const advanced = isAdvanced(league?.settings);
  return { advanced, scheme: advanced && team ? league?.schemes?.[team.id] ?? null : null };
}

export const isAdvanced = (settings: Pick<LeagueSettings, "mode"> | null | undefined) => settings?.mode === "advanced";

/**
 * A player's rating at a roster spot. Standard mode: their position rating.
 * Advanced mode: their granular role rating plus their fit with the team's scheme.
 */
export function slotRating(p: Player, slot: Slot, ctx: RatingContext): number {
  if (!ctx.advanced) return p.posOvr[slot.pos];
  const base = p.roleOvr[slot.role];
  const bonus = ctx.scheme ? fitBonus(slotFit(p.id, slot.pos, slot.side, ctx.scheme)) : 0;
  return Math.max(40, Math.min(99, base + bonus));
}

/** Combined play-by-play adjustments when this offense meets this defense. */
export function matchupTweak(off: TeamScheme | null, def: TeamScheme | null): Required<SimTweak> {
  const t: Required<SimTweak> = { pass: 0, air: 0, cmp: 0, int: 0, run: 0, qbRun: 0.12, big: 1, sack: 1, rush: 0, stop: 0 };
  if (!off || !def) return t;
  const parts = [OFFENSES[off.off].tweak, FRONTS[def.front].tweak, COVERAGES[def.cov].tweak];
  for (const c of COUNTERS) if (c.off.includes(off.off) && (c.def.includes(def.front) || c.def.includes(def.cov))) parts.push(c.tweak);
  for (const p of parts) {
    t.pass += p.pass ?? 0;
    t.air += p.air ?? 0;
    t.cmp += p.cmp ?? 0;
    t.int += p.int ?? 0;
    t.run += p.run ?? 0;
    t.rush += p.rush ?? 0;
    t.stop += p.stop ?? 0;
    t.big *= p.big ?? 1;
    t.sack *= p.sack ?? 1;
    if (p.qbRun != null) t.qbRun = Math.max(t.qbRun, p.qbRun);
  }
  return t;
}

export const schemeLabel = (s: TeamScheme) => `${OFFENSES[s.off].label} · ${FRONTS[s.front].label} · ${COVERAGES[s.cov].label}`;
