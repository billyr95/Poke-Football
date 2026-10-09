import type { AttrKey, DexEntry, Player, Pos, Role, Side, Slot, SlotId } from "./types";

/**
 * Turns PokeAPI base stats, height, weight and evolution stage into football ratings.
 *
 * Everything is measured against the league's draft pool: each input becomes a z-score
 * (how far above or below the pool average it is), attributes blend those z-scores, and every
 * rating lands on the same scale — 70 is pool average, 40 is the floor, and the scale
 * tightens above 88 so a 99 is rare.
 */

/** Inputs every rating is built from. "size" is body mass, "height" is frame, "bst" is base stat total. */
type Input = "hp" | "atk" | "def" | "spa" | "spd" | "spe" | "size" | "height" | "maturity" | "bst";

export const INPUT_NAMES: Record<Input, string> = {
  hp: "HP", atk: "Attack", def: "Defense", spa: "Sp. Atk", spd: "Sp. Def", spe: "Speed",
  size: "weight", height: "height", maturity: "evolution stage", bst: "base stat total",
};

export const ATTRS: Record<AttrKey, { name: string; from: Partial<Record<Input, number>> }> = {
  SPD: { name: "Speed", from: { spe: 1 } },
  STR: { name: "Strength", from: { atk: 0.65, size: 0.35 } },
  AGI: { name: "Agility", from: { spe: 1, size: -0.45 } },
  AWR: { name: "Awareness", from: { spd: 0.6, maturity: 0.4 } },
  CTH: { name: "Catching", from: { spe: 0.5, spd: 0.3, hp: 0.2 } },
  THP: { name: "Throw power", from: { spa: 1 } },
  THA: { name: "Accuracy", from: { spa: 0.6, spd: 0.4 } },
  BLK: { name: "Blocking", from: { def: 0.45, size: 0.35, height: 0.2 } },
  TKL: { name: "Tackling", from: { atk: 0.55, def: 0.45 } },
  COV: { name: "Coverage", from: { spe: 0.5, spd: 0.3, def: 0.2 } },
};

export const ATTR_LIST = Object.keys(ATTRS) as AttrKey[];

/**
 * Position recipes. `frame` is the ideal body size (z-score of weight) for the position:
 * linemen want mass, corners and receivers want to be light. Being more than half a
 * standard deviation away from the ideal costs rating.
 */
export const POSITIONS: Record<Pos, {
  name: string; side: Side; frame: number; weights: Partial<Record<AttrKey, number>>;
}> = {
  QB: { name: "Quarterback", side: "off", frame: 0.2, weights: { THP: 0.35, THA: 0.35, AWR: 0.2, SPD: 0.1 } },
  RB: { name: "Running back", side: "off", frame: 0, weights: { SPD: 0.3, AGI: 0.3, STR: 0.2, CTH: 0.1, AWR: 0.1 } },
  WR: { name: "Wide receiver", side: "off", frame: -0.4, weights: { SPD: 0.4, CTH: 0.35, AGI: 0.25 } },
  TE: { name: "Tight end", side: "off", frame: 0.6, weights: { CTH: 0.3, BLK: 0.3, STR: 0.25, SPD: 0.15 } },
  OL: { name: "Offensive line", side: "off", frame: 1.2, weights: { BLK: 0.55, STR: 0.35, AWR: 0.1 } },
  DL: { name: "Defensive line", side: "def", frame: 1.0, weights: { STR: 0.4, TKL: 0.35, BLK: 0.15, SPD: 0.1 } },
  LB: { name: "Linebacker", side: "def", frame: 0.4, weights: { TKL: 0.4, AWR: 0.2, SPD: 0.2, STR: 0.2 } },
  CB: { name: "Cornerback", side: "def", frame: -0.6, weights: { COV: 0.45, SPD: 0.35, AGI: 0.2 } },
  S: { name: "Safety", side: "def", frame: -0.2, weights: { COV: 0.35, TKL: 0.25, SPD: 0.2, AWR: 0.2 } },
};

/**
 * Granular roles for advanced mode. Same recipe format as positions: each asks for a different mix,
 * so a burner is a better Z than X, and a heavy, strong lineman is a better guard than tackle.
 */
export const ROLES: Record<Role, {
  name: string; pos: Pos; frame: number; weights: Partial<Record<AttrKey, number>>;
}> = {
  QB: { pos: "QB", frame: POSITIONS.QB.frame, weights: POSITIONS.QB.weights, name: POSITIONS.QB.name },
  RB: { pos: "RB", frame: POSITIONS.RB.frame, weights: POSITIONS.RB.weights, name: POSITIONS.RB.name },
  X: { name: "X receiver (outside, contested catches)", pos: "WR", frame: -0.1, weights: { CTH: 0.4, STR: 0.25, SPD: 0.2, AGI: 0.15 } },
  Z: { name: "Z receiver (flanker, deep speed)", pos: "WR", frame: -0.4, weights: { SPD: 0.5, CTH: 0.3, AGI: 0.2 } },
  SLOT: { name: "Slot receiver (quickness)", pos: "WR", frame: -0.7, weights: { AGI: 0.45, CTH: 0.35, AWR: 0.2 } },
  TE: { pos: "TE", frame: POSITIONS.TE.frame, weights: POSITIONS.TE.weights, name: POSITIONS.TE.name },
  T: { name: "Tackle (pass protection on the edge)", pos: "OL", frame: 1.1, weights: { BLK: 0.5, AGI: 0.2, STR: 0.2, AWR: 0.1 } },
  G: { name: "Guard (interior power)", pos: "OL", frame: 1.3, weights: { STR: 0.5, BLK: 0.45, AWR: 0.05 } },
  C: { name: "Center (calls protections)", pos: "OL", frame: 1.1, weights: { BLK: 0.45, AWR: 0.35, STR: 0.2 } },
  DE: { name: "Defensive end (edge rusher)", pos: "DL", frame: 0.6, weights: { SPD: 0.35, STR: 0.3, TKL: 0.35 } },
  DT: { name: "Defensive tackle (interior)", pos: "DL", frame: 1.4, weights: { STR: 0.5, BLK: 0.2, TKL: 0.3 } },
  OLB: { name: "Outside linebacker", pos: "LB", frame: 0.3, weights: { SPD: 0.3, TKL: 0.35, STR: 0.2, COV: 0.15 } },
  MLB: { name: "Middle linebacker", pos: "LB", frame: 0.5, weights: { TKL: 0.4, AWR: 0.35, STR: 0.25 } },
  CB: { pos: "CB", frame: POSITIONS.CB.frame, weights: POSITIONS.CB.weights, name: POSITIONS.CB.name },
  FS: { name: "Free safety (deep range)", pos: "S", frame: -0.4, weights: { COV: 0.4, SPD: 0.3, AWR: 0.3 } },
  SS: { name: "Strong safety (box)", pos: "S", frame: 0.1, weights: { TKL: 0.4, STR: 0.2, COV: 0.25, AWR: 0.15 } },
};
export const ROLE_LIST = Object.keys(ROLES) as Role[];

const FRAME_TOLERANCE = 0.5;
const FRAME_PENALTY = 0.35; // SDs lost per SD of body size outside the tolerance
/** Share of a position rating that comes from the position's attributes; the rest is base stat total. */
export const ATTR_SHARE = 0.7;

export const POS_LIST = Object.keys(POSITIONS) as Pos[];

const slot = (id: SlotId, pos: Pos, label: string, role: Role): Slot => ({ id, pos, role, label, side: POSITIONS[pos].side });

export const SLOTS: Slot[] = [
  slot("QB", "QB", "QB", "QB"),
  slot("RB", "RB", "RB", "RB"),
  slot("WR1", "WR", "WR", "X"),
  slot("WR2", "WR", "WR", "Z"),
  slot("WR3", "WR", "WR", "SLOT"),
  slot("TE", "TE", "TE", "TE"),
  slot("LT", "OL", "LT", "T"),
  slot("LG", "OL", "LG", "G"),
  slot("C", "OL", "C", "C"),
  slot("RG", "OL", "RG", "G"),
  slot("RT", "OL", "RT", "T"),
  slot("DE1", "DL", "DE", "DE"),
  slot("DT1", "DL", "DT", "DT"),
  slot("DT2", "DL", "DT", "DT"),
  slot("DE2", "DL", "DE", "DE"),
  slot("LB1", "LB", "OLB", "OLB"),
  slot("LB2", "LB", "MLB", "MLB"),
  slot("LB3", "LB", "OLB", "OLB"),
  slot("CB1", "CB", "CB", "CB"),
  slot("CB2", "CB", "CB", "CB"),
  slot("FS", "S", "FS", "FS"),
  slot("SS", "S", "SS", "SS"),
];

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s])) as Record<SlotId, Slot>;
export const ROSTER_SIZE = SLOTS.length;

export const RATING_MEAN = 70;
export const RATING_SD = 11;
const SOFT_CAP = 88;

/** z-score to rating. Above 88 the scale tightens, so 99 stays rare. */
function toRating(z: number) {
  let r = RATING_MEAN + RATING_SD * z;
  if (r > SOFT_CAP) r = SOFT_CAP + (r - SOFT_CAP) * 0.55;
  return Math.max(40, Math.min(99, Math.round(r)));
}

function zScorer(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length) || 1;
  return (v: number) => (v - mean) / sd;
}

/** Rating tier used for colour coding everywhere. */
export function tier(r: number): "elite" | "good" | "avg" | "low" {
  return r >= 90 ? "elite" : r >= 80 ? "good" : r >= 70 ? "avg" : "low";
}

export function ratePlayers(dex: DexEntry[]): Player[] {
  // Weight and height span 0.1 kg to 999 kg, so compare them on a log scale.
  const inputs = dex.map(p => ({
    ...p.base,
    size: Math.log(p.weightKg + 1),
    height: Math.log(p.heightM + 0.1),
    maturity: p.maturity,
    bst: Object.values(p.base).reduce((a, b) => a + b, 0),
  }));
  const inputZ = {} as Record<Input, number[]>;
  for (const key of Object.keys(INPUT_NAMES) as Input[]) {
    const z = zScorer(inputs.map(i => i[key]));
    inputZ[key] = inputs.map(i => z(i[key]));
  }
  // Legendary status is a lift in standard deviations, applied before the soft cap,
  // so legends are very strong but elite non-legendaries can still match them at their best spots.
  const lift = dex.map(p => RARITY_LIFT[p.rarity ?? "none"]);

  const attrZ = dex.map(() => ({}) as Record<AttrKey, number>);
  for (const a of ATTR_LIST) {
    const raw = dex.map((_, i) =>
      Object.entries(ATTRS[a].from).reduce((sum, [k, w]) => sum + w! * inputZ[k as Input][i], 0));
    const z = zScorer(raw);
    raw.forEach((v, i) => (attrZ[i][a] = z(v)));
  }

  // Position scores: 70% the attributes that matter there, 30% base stat total (raw talent),
  // minus a body-size penalty when the frame is wrong for the job. Re-standardised so a 75
  // means the same thing at every position.
  const recipeZ = <K extends string>(recipes: Record<K, { frame: number; weights: Partial<Record<AttrKey, number>> }>) => {
    const out = dex.map(() => ({}) as Record<K, number>);
    for (const key of Object.keys(recipes) as K[]) {
      const { weights, frame } = recipes[key];
      const raw = attrZ.map((at, i) => {
        const fit = Object.entries(weights).reduce((sum, [a, w]) => sum + (w as number) * at[a as AttrKey], 0);
        const miss = Math.max(0, Math.abs(inputZ.size[i] - frame) - FRAME_TOLERANCE);
        return ATTR_SHARE * fit + (1 - ATTR_SHARE) * inputZ.bst[i] - FRAME_PENALTY * miss;
      });
      const z = zScorer(raw);
      raw.forEach((v, i) => (out[i][key] = z(v)));
    }
    return out;
  };
  const posZ = recipeZ(POSITIONS);
  const roleZ = recipeZ(ROLES);

  const natural = naturalPositions(posZ);

  const rateAll = <K extends string>(zs: Record<K, number>, l: number) =>
    Object.fromEntries(Object.entries(zs).map(([k, z]) => [k, toRating((z as number) + l)])) as Record<K, number>;

  return dex.map((p, i) => {
    const posOvr = rateAll(posZ[i], lift[i]);
    const plain = toRating(posZ[i][natural[i]]);
    return {
      ...p,
      rarityBonus: posOvr[natural[i]] - plain,
      attrs: rateAll(attrZ[i], lift[i]),
      posOvr,
      roleOvr: rateAll(roleZ[i], lift[i]),
      pos: natural[i],
      ovr: posOvr[natural[i]],
    };
  });
}

/** Rarity lift, in standard deviations of the whole National Dex. */
export const RARITY_LIFT: Record<NonNullable<Player["rarity"]> | "none", number> = {
  legendary: 0.6,
  mythical: 0.6,
  pseudo: 0.4,
  none: 0,
};

export const RARITY_LABEL: Record<NonNullable<Player["rarity"]>, string> = {
  legendary: "Legendary",
  mythical: "Mythical",
  pseudo: "Pseudo-legendary",
};

/**
 * Natural position = where a Pokémon fits best, with each position "priced" until the group
 * splits like a real 22-man lineup (5 linemen for every quarterback). Without this, every
 * special-stat Pokémon would be a natural QB. Ratings at every position are unchanged.
 */
function naturalPositions(posZ: Record<Pos, number>[]): Pos[] {
  const target = Object.fromEntries(POS_LIST.map(p => [
    p, (SLOTS.filter(s => s.pos === p).length / SLOTS.length) * posZ.length,
  ])) as Record<Pos, number>;

  // Fit = how good they are there, plus how much that position stands out from their other ratings.
  const fit = posZ.map(r => {
    const mean = POS_LIST.reduce((a, p) => a + r[p], 0) / POS_LIST.length;
    return Object.fromEntries(POS_LIST.map(p => [p, r[p] + 1.5 * (r[p] - mean)])) as Record<Pos, number>;
  });

  const price = Object.fromEntries(POS_LIST.map(p => [p, 0])) as Record<Pos, number>;
  const choose = () => fit.map(f => POS_LIST.reduce((best, p) => (f[p] - price[p] > f[best] - price[best] ? p : best)));
  for (let iter = 0; iter < 400; iter++) {
    const counts = Object.fromEntries(POS_LIST.map(p => [p, 0])) as Record<Pos, number>;
    for (const p of choose()) counts[p]++;
    for (const p of POS_LIST) price[p] += (0.4 * (counts[p] - target[p])) / posZ.length;
  }
  return choose();
}

/** Feet-and-inches / pounds for display, since it's football. */
export function heightFt(m: number) {
  const inches = Math.round(m * 39.37);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}
export const weightLb = (kg: number) => Math.round(kg * 2.2046);
