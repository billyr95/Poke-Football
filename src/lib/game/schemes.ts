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
}

export const OFFENSES: Record<OffScheme, SchemeInfo> = {
  West_Coast: {
    label: "West Coast", blurb: "Short, timed passing that sets up the run.",
    pros: "High-percentage throws, handles the blitz, gets RBs and TEs involved.", cons: "Fewer explosive plays.",
    tweak: { pass: 0.05, air: -1.2, cmp: 0.05, sack: 0.85, big: 0.85 },
  },
  Air_Coryell: {
    label: "Air Coryell", blurb: "Vertical passing that stretches the defense deep.",
    pros: "Explosive plays, punishes aggressive safeties.", cons: "Needs protection; incompletions stall drives.",
    tweak: { pass: 0.08, air: 2.5, cmp: -0.05, big: 1.4, sack: 1.2 },
  },
  Erhardt_Perkins: {
    label: "Erhardt–Perkins", blurb: "Concept-based, flexible, no-huddle friendly.",
    pros: "Hard to predict, adapts to any look.", cons: "Needs smart players.",
    tweak: { pass: 0.03, cmp: 0.02, int: -0.004 },
  },
  Air_Raid: {
    label: "Air Raid", blurb: "Spread passing that forces you to cover the whole field.",
    pros: "Huge passing numbers, beats stacked boxes.", cons: "Run game takes a back seat; leans on the QB.",
    tweak: { pass: 0.15, air: 0.8, cmp: 0.02, sack: 1.1, run: -0.3 },
  },
  Run_Shoot: {
    label: "Run & Shoot", blurb: "Receivers adjust routes to the coverage they see.",
    pros: "Mismatches, excellent against man coverage.", cons: "Miscommunication is costly.",
    tweak: { pass: 0.12, air: 1, big: 1.2, int: 0.005 },
  },
  Spread_Option: {
    label: "Spread Option", blurb: "Spreads the field and makes the QB a running threat.",
    pros: "Numbers advantages, puts defenders in conflict.", cons: "QB takes hits; needs a mobile QB.",
    tweak: { pass: -0.08, qbRun: 0.3, run: 0.4 },
  },
  RPO: {
    label: "RPO", blurb: "Run-pass options: the QB reads one defender and picks.",
    pros: "Easy throws, punishes aggressive linebackers.", cons: "Needs a fast-processing QB.",
    tweak: { cmp: 0.04, run: 0.3, qbRun: 0.15 },
  },
  Zone_Read: {
    label: "Zone Read", blurb: "QB reads the edge and gives or keeps.",
    pros: "Adds the QB as a runner, punishes crashing ends.", cons: "Less useful with a statue at QB.",
    tweak: { pass: -0.06, qbRun: 0.25, run: 0.3 },
  },
  Shanahan_Outside_Zone: {
    label: "Shanahan Zone", blurb: "Outside zone with play-action and bootlegs off it.",
    pros: "Cutback lanes, great play-action shots.", cons: "Needs athletic linemen; dominant fronts hurt it.",
    tweak: { pass: -0.05, run: 0.5, big: 1.15 },
  },
  Power_GAP: {
    label: "Power / Gap", blurb: "Downhill, physical gap runs.",
    pros: "Defined lanes, wears defenses down, great in short yardage.", cons: "Predictable; heavy boxes hurt.",
    tweak: { pass: -0.12, run: 0.7, big: 0.8 },
  },
  Pistol: {
    label: "Pistol", blurb: "QB a few yards back, RB behind him: downhill runs plus spread looks.",
    pros: "Balanced, disguises direction.", cons: "Less natural for straight drop-back passing.",
    tweak: { pass: -0.03, qbRun: 0.15, run: 0.3 },
  },
  Option: {
    label: "Option", blurb: "Triple option: the QB chooses among several ball carriers.",
    pros: "Controls the clock, neutralises better talent.", cons: "Passing game is limited.",
    tweak: { pass: -0.2, qbRun: 0.35, run: 0.6, cmp: -0.04 },
  },
  I_Formation: {
    label: "I-Formation", blurb: "Smashmouth: fullback, tailback, physical blocking.",
    pros: "Short yardage, strong play action.", cons: "Predictable; defenses stack the box.",
    tweak: { pass: -0.15, run: 0.6, big: 0.85, sack: 0.9 },
  },
  Modern_Hybrid: {
    label: "Modern Hybrid", blurb: "West Coast timing, Coryell verticals, RPOs and zone runs.",
    pros: "Adaptable, attacks everywhere.", cons: "Can lose identity.",
    tweak: {},
  },
};

export const FRONTS: Record<Front, SchemeInfo> = {
  "4_3": { label: "4–3", blurb: "Four linemen, three linebackers.", pros: "Four-man rush, strong run defense.", cons: "Stressed by spread offenses.", tweak: { stop: 3, rush: 2 } },
  "3_4": { label: "3–4", blurb: "Three linemen, four linebackers.", pros: "Blitz disguise, confuses protections.", cons: "Needs versatile linebackers.", tweak: { rush: 3 } },
  "4_2_5_Nickel": { label: "4–2–5 Nickel", blurb: "Extra defensive back for the slot.", pros: "Strong against modern passing.", cons: "Lighter against the run.", tweak: { stop: -3, cmp: -0.02 } },
  "3_3_5": { label: "3–3–5", blurb: "Three down, three backers, five DBs.", pros: "Disguise and pressure against spread.", cons: "Struggles with power runs.", tweak: { stop: -4, rush: 2, cmp: -0.02 } },
  "3_4_Under": { label: "3–4 Under", blurb: "Front shifted to create edge matchups.", pros: "Strong edge pressure.", cons: "Can open run gaps.", tweak: { rush: 4, stop: -1 } },
  Bear: { label: "Bear", blurb: "Five-man front covering center and guards.", pros: "Smothers inside and zone runs.", cons: "Edges and passes are softer.", tweak: { stop: 8, rush: 1, big: 1.15 } },
  Wide_9: { label: "Wide 9", blurb: "Ends split way outside the tackles.", pros: "Elite pass-rush angles, stresses outside zone.", cons: "Opens inside run lanes.", tweak: { rush: 5, stop: -3 } },
  NASCAR_Pass_Rush: { label: "NASCAR", blurb: "Four pure pass rushers on the field.", pros: "Maximum pass rush.", cons: "Weak against the run and screens.", tweak: { rush: 7, stop: -8 } },
};

export const COVERAGES: Record<Coverage, SchemeInfo> = {
  Tampa_2: { label: "Tampa 2", blurb: "Cover 2 with the MLB running the deep middle.", pros: "Protects deep, takeaways underneath.", cons: "Seams can be stressed.", tweak: { big: 0.8, cmp: 0.02, int: 0.004 } },
  Cover_2: { label: "Cover 2", blurb: "Two deep safeties, zones underneath.", pros: "Keeps everything in front.", cons: "Deep middle is open.", tweak: { big: 0.8, cmp: 0.03, stop: 1 } },
  Cover_3: { label: "Cover 3", blurb: "Three deep zones, four underneath.", pros: "Balanced, good run support.", cons: "Seams and flats can be attacked.", tweak: { stop: 2 } },
  Cover_4_Quarters: { label: "Cover 4", blurb: "Quarters: four deep defenders.", pros: "Eliminates the deep ball.", cons: "Soft underneath.", tweak: { big: 0.65, cmp: 0.04, stop: 1 } },
  Cover_6: { label: "Cover 6", blurb: "Quarters to one side, Cover 2 to the other.", pros: "Different answers by side.", cons: "Complex; the weak side gets attacked.", tweak: { big: 0.75, cmp: 0.02 } },
  Cover_1: { label: "Cover 1", blurb: "Man coverage with one deep safety.", pros: "Aggressive, strong against the run.", cons: "Elite receivers win one-on-one.", tweak: { cmp: -0.04, big: 1.15, stop: 3 } },
  Cover_0: { label: "Cover 0", blurb: "Pure man, everyone else rushes.", pros: "Maximum pressure, forces quick decisions.", cons: "No deep help at all.", tweak: { sack: 1.5, cmp: -0.06, big: 1.7 } },
  Cover_2_Man: { label: "Cover 2 Man", blurb: "Man underneath, two safeties deep.", pros: "Takes away easy throws.", cons: "Scrambling QBs hurt it.", tweak: { cmp: -0.05, big: 0.9 } },
  Cover_3_Match: { label: "Cover 3 Match", blurb: "Cover 3 that matches routes.", pros: "Handles modern route combos.", cons: "Mistakes become big plays.", tweak: { cmp: -0.02, big: 0.9 } },
  Cover_4_Match: { label: "Cover 4 Match", blurb: "Quarters that matches routes.", pros: "Excellent against modern passing.", cons: "Play action can fool safeties.", tweak: { cmp: -0.02, big: 0.75 } },
  Zone_Blitz: { label: "Zone Blitz", blurb: "Surprise rushers, others drop into zones.", pros: "Confuses protections, baits QBs.", cons: "Busts give up huge plays.", tweak: { sack: 1.25, int: 0.008, big: 1.2 } },
  Fire_Zone: { label: "Fire Zone", blurb: "Five rushers, three deep, three under.", pros: "Pressure without leaving zero coverage.", cons: "Quick throws beat it.", tweak: { sack: 1.2, cmp: 0.02, big: 1.15 } },
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
