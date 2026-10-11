import { SLOTS, SLOT_BY_ID } from "./ratings";
import { isAdvanced, type Front, type OffScheme, type TeamScheme } from "./schemes";
import type { League, Slot, SlotId, Team } from "./types";

/**
 * Advanced mode: schemes decide who is on the field. Every team still drafts 11 + 11, but an Air Raid
 * team drafts four receivers and no tight end, an I-formation team a fullback, a 3–4 team a nose tackle
 * and four linebackers, and so on. Personnel is fixed when the draft starts.
 */

export type OffPersonnel = "11" | "10" | "12" | "21";
export type DefPersonnel = "43" | "34" | "425" | "335";

export interface TeamPersonnel {
  off: OffPersonnel;
  def: DefPersonnel;
}

const OL: SlotId[] = ["LT", "LG", "C", "RG", "RT"];

export const OFF_PERSONNEL: Record<OffPersonnel, { label: string; detail: string; slots: SlotId[] }> = {
  "11": { label: "11 personnel", detail: "1 RB · 1 TE · 3 WR", slots: ["QB", "RB", "WR1", "WR2", "WR3", "TE", ...OL] },
  "10": { label: "10 personnel", detail: "1 RB · 4 WR", slots: ["QB", "RB", "WR1", "WR2", "WR3", "WR4", ...OL] },
  "12": { label: "12 personnel", detail: "1 RB · 2 TE · 2 WR", slots: ["QB", "RB", "WR1", "WR2", "TE", "TE2", ...OL] },
  "21": { label: "21 personnel", detail: "RB + FB · 1 TE · 2 WR", slots: ["QB", "RB", "FB", "WR1", "WR2", "TE", ...OL] },
};

export const DEF_PERSONNEL: Record<DefPersonnel, { label: string; detail: string; slots: SlotId[] }> = {
  "43": { label: "Base 4–3", detail: "4 DL · 3 LB · 4 DB", slots: ["DE1", "DT1", "DT2", "DE2", "LB1", "LB2", "LB3", "CB1", "CB2", "FS", "SS"] },
  "34": { label: "Base 3–4", detail: "3 DL (nose) · 4 LB · 4 DB", slots: ["DE1", "NT", "DE2", "LB1", "LB2", "LB4", "LB3", "CB1", "CB2", "FS", "SS"] },
  "425": { label: "Nickel", detail: "4 DL · 2 LB · 5 DB", slots: ["DE1", "DT1", "DT2", "DE2", "LB1", "LB2", "CB1", "CB2", "NB", "FS", "SS"] },
  "335": { label: "3–3–5", detail: "3 DL · 3 LB · 5 DB", slots: ["DE1", "NT", "DE2", "LB1", "LB2", "LB3", "CB1", "CB2", "FS", "SS", "S3"] },
};

/** The personnel each offensive scheme lives in. */
export const SCHEME_PERSONNEL: Record<OffScheme, OffPersonnel> = {
  West_Coast: "11",
  Air_Coryell: "12",
  Erhardt_Perkins: "11",
  Air_Raid: "10",
  Run_Shoot: "10",
  Spread_Option: "10",
  RPO: "11",
  Zone_Read: "11",
  Shanahan_Outside_Zone: "21",
  Power_GAP: "12",
  Pistol: "11",
  Option: "21",
  I_Formation: "21",
  Modern_Hybrid: "11",
};

/** The personnel each front lines up with. Coverages are played by whoever is on the field. */
export const FRONT_PERSONNEL: Record<Front, DefPersonnel> = {
  "4_3": "43",
  "3_4": "34",
  "4_2_5_Nickel": "425",
  "3_3_5": "335",
  "3_4_Under": "34",
  Bear: "43",
  Wide_9: "43",
  NASCAR_Pass_Rush: "425",
};

export const personnelFor = (s: TeamScheme): TeamPersonnel => ({ off: SCHEME_PERSONNEL[s.off], def: FRONT_PERSONNEL[s.front] });

/** The 22 spots a team drafts and plays, in display order (offense first, then defense). */
export function teamSlots(league: Pick<League, "settings" | "personnel"> | null | undefined, team: Pick<Team, "id"> | null | undefined): Slot[] {
  const p = isAdvanced(league?.settings) && team ? league?.personnel?.[team.id] : undefined;
  if (!p) return SLOTS;
  return [...OFF_PERSONNEL[p.off].slots, ...DEF_PERSONNEL[p.def].slots].map(id => SLOT_BY_ID[id]);
}
