import { SLOTS, SLOT_BY_ID } from "./ratings";
import { isAdvanced, type Coverage, type Front, type OffScheme, type TeamScheme } from "./schemes";
import type { League, Slot, SlotId, Team } from "./types";

/**
 * Advanced mode: schemes decide who is on the field (see the scheme guide's personnel tables).
 * Every team still drafts 11 + 11, but a West Coast team drafts a fullback, an Air Raid team four
 * receivers and no tight end, a Cover 2 Man defense four corners and one linebacker, and so on.
 * Personnel is fixed when the draft starts.
 */

export type OffPersonnel = "11" | "10" | "12" | "21" | "30";

export interface DefPersonnel {
  /** e.g. "4–2–5 Nickel" */
  label: string;
  slots: SlotId[];
}

export interface TeamPersonnel {
  off: OffPersonnel;
  /** Older leagues stored a key ("43", "34", "425", "335"); newer ones store the line-up itself. */
  def: DefPersonnel | "43" | "34" | "425" | "335";
}

const OL: SlotId[] = ["LT", "LG", "C", "RG", "RT"];

export const OFF_PERSONNEL: Record<OffPersonnel, { label: string; detail: string; slots: SlotId[] }> = {
  "11": { label: "11 personnel", detail: "1 RB · 1 TE · 3 WR", slots: ["QB", "RB", "WR1", "WR2", "WR3", "TE", ...OL] },
  "10": { label: "10 personnel", detail: "1 RB · 4 WR", slots: ["QB", "RB", "WR1", "WR2", "WR3", "WR4", ...OL] },
  "12": { label: "12 personnel", detail: "1 RB · 2 TE · 2 WR", slots: ["QB", "RB", "WR1", "WR2", "TE", "TE2", ...OL] },
  "21": { label: "21 personnel", detail: "RB + FB · 1 TE · 2 WR", slots: ["QB", "RB", "FB", "WR1", "WR2", "TE", ...OL] },
  "30": { label: "30 personnel", detail: "FB + 2 slotbacks · 2 WR", slots: ["QB", "RB", "FB", "RB2", "WR1", "WR2", ...OL] },
};

/** The personnel each offensive scheme lines up in (scheme guide, Part III). */
export const SCHEME_PERSONNEL: Record<OffScheme, OffPersonnel> = {
  West_Coast: "21",
  Air_Coryell: "11",
  Erhardt_Perkins: "12",
  Air_Raid: "10",
  Run_Shoot: "10",
  Spread_Option: "11",
  RPO: "11",
  Zone_Read: "11",
  Shanahan_Outside_Zone: "21",
  Power_GAP: "12",
  Pistol: "11",
  Option: "30",
  I_Formation: "21",
  Modern_Hybrid: "11",
};

/** Fronts set the defensive line (and their base number of DBs). */
export const FRONT_SHAPE: Record<Front, { dl: SlotId[]; db: number; label: string; rover?: boolean }> = {
  "4_3": { dl: ["DE1", "DT1", "DT2", "DE2"], db: 4, label: "Base" },
  "3_4": { dl: ["DE1", "NT", "DE2"], db: 4, label: "Base" },
  "4_2_5_Nickel": { dl: ["DE1", "DT1", "DT2", "DE2"], db: 5, label: "Nickel" },
  "3_3_5": { dl: ["DE1", "NT", "DE2"], db: 5, label: "Nickel (odd)", rover: true },
  "3_4_Under": { dl: ["DE1", "NT", "DE2"], db: 4, label: "Base" },
  Bear: { dl: ["DE1", "DT1", "NT", "DE2"], db: 4, label: "Base (46 Bear)" },
  Wide_9: { dl: ["DE1", "DT1", "DT2", "DE2"], db: 4, label: "Base" },
  NASCAR_Pass_Rush: { dl: ["DE1", "DT1", "DT2", "DE2"], db: 6, label: "Dime" },
};

/** Coverages are called from a personnel package: 4 DB base, 5 DB nickel, 6 DB dime. */
export const COVERAGE_DBS: Record<Coverage, number> = {
  Tampa_2: 4,
  Cover_2: 4,
  Cover_3: 4,
  Cover_4_Quarters: 5,
  Cover_6: 5,
  Cover_1: 5,
  Cover_0: 5,
  Cover_2_Man: 6,
  Cover_3_Match: 5,
  Cover_4_Match: 5,
  Zone_Blitz: 4,
  Fire_Zone: 4,
};

export const PACKAGE_NAME: Record<number, string> = { 4: "Base", 5: "Nickel", 6: "Dime" };

const LBS: Record<number, SlotId[]> = { 4: ["LB1", "LB2", "LB4", "LB3"], 3: ["LB1", "LB2", "LB3"], 2: ["LB1", "LB2"], 1: ["LB2"] };

function dbs(n: number, rover: boolean): SlotId[] {
  if (n <= 4) return ["CB1", "CB2", "FS", "SS"];
  if (n === 5) return rover ? ["CB1", "CB2", "FS", "SS", "S3"] : ["CB1", "CB2", "NB", "FS", "SS"];
  return rover ? ["CB1", "CB2", "NB", "FS", "SS", "S3"] : ["CB1", "CB2", "NB", "DC", "FS", "SS"];
}

/**
 * Defensive personnel from a front and a coverage: the front decides the linemen, the coverage can bring
 * extra defensive backs (nickel, dime), and linebackers fill the rest of the 11.
 */
export function defPersonnel(front: Front, cov: Coverage): DefPersonnel {
  const shape = FRONT_SHAPE[front];
  const db = Math.max(shape.db, COVERAGE_DBS[cov]);
  const lb = 11 - shape.dl.length - db;
  const pkg = db === shape.db ? shape.label : PACKAGE_NAME[db];
  return { label: `${shape.dl.length}–${lb}–${db} ${pkg}`, slots: [...shape.dl, ...LBS[lb], ...dbs(db, !!shape.rover)] };
}

export const personnelFor = (s: TeamScheme): TeamPersonnel => ({ off: SCHEME_PERSONNEL[s.off], def: defPersonnel(s.front, s.cov) });

const LEGACY_DEF: Record<string, SlotId[]> = {
  "43": ["DE1", "DT1", "DT2", "DE2", "LB1", "LB2", "LB3", "CB1", "CB2", "FS", "SS"],
  "34": ["DE1", "NT", "DE2", "LB1", "LB2", "LB4", "LB3", "CB1", "CB2", "FS", "SS"],
  "425": ["DE1", "DT1", "DT2", "DE2", "LB1", "LB2", "CB1", "CB2", "NB", "FS", "SS"],
  "335": ["DE1", "NT", "DE2", "LB1", "LB2", "LB3", "CB1", "CB2", "FS", "SS", "S3"],
};

const defSlots = (d: TeamPersonnel["def"]) => (typeof d === "string" ? LEGACY_DEF[d] : d.slots);

/** Short description of a team's personnel for headers, e.g. "21 personnel · 4–2–5 Nickel". */
export function personnelLabel(league: Pick<League, "settings" | "personnel"> | null | undefined, team: Pick<Team, "id"> | null | undefined) {
  const p = isAdvanced(league?.settings) && team ? league?.personnel?.[team.id] : undefined;
  if (!p) return null;
  const def = typeof p.def === "string" ? { "43": "4–3–4 Base", "34": "3–4–4 Base", "425": "4–2–5 Nickel", "335": "3–3–5 Nickel" }[p.def] : p.def.label;
  return { off: `${OFF_PERSONNEL[p.off].label} (${OFF_PERSONNEL[p.off].detail})`, def };
}

/** The 22 spots a team drafts and plays, in display order (offense first, then defense). */
export function teamSlots(league: Pick<League, "settings" | "personnel"> | null | undefined, team: Pick<Team, "id"> | null | undefined): Slot[] {
  const p = isAdvanced(league?.settings) && team ? league?.personnel?.[team.id] : undefined;
  if (!p) return SLOTS;
  return [...OFF_PERSONNEL[p.off].slots, ...defSlots(p.def)].map(id => SLOT_BY_ID[id]);
}
