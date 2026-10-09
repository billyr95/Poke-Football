import { SLOT_BY_ID } from "./ratings";
import type { LeagueSettings, Player, SlotId, Team } from "./types";

/**
 * Team chemistry: build around a type or an evolution line and the players involved get better.
 *
 *  Unit type stack  — 3 of one type in a unit: +2, 4: +3, 5+: +4   (best type per player, or all of them with stackChem)
 *  QB connection    — a RB/WR/TE sharing a type with the QB: +2; the QB gets +1 per connection, up to +3
 *  Evolution line   — 2+ from one family anywhere on the roster: +2 each
 *
 * Bonuses add up, capped at +5 per player, and no rating goes above 99.
 */

export const UNITS: { key: string; label: string; slots: SlotId[] }[] = [
  { key: "line", label: "Offensive line", slots: ["LT", "LG", "C", "RG", "RT"] },
  { key: "receivers", label: "Receivers", slots: ["RB", "WR1", "WR2", "WR3", "TE"] },
  { key: "front", label: "Front seven", slots: ["DE1", "DT1", "DT2", "DE2", "LB1", "LB2", "LB3"] },
  { key: "secondary", label: "Secondary", slots: ["CB1", "CB2", "FS", "SS"] },
];

const STACK_BONUS = (n: number) => (n >= 5 ? 4 : n === 4 ? 3 : n === 3 ? 2 : 0);
const QB_LINK_BONUS = 2;
const QB_MAX = 3;
const FAMILY_BONUS = 2;
export const MAX_CHEM = 5;

export interface ChemLink {
  kind: "stack" | "qb" | "family";
  label: string;
  members: number[]; // player ids
  bonus: number;
}

export interface Chemistry {
  bonus: Map<number, number>; // player id -> total bonus (capped)
  links: ChemLink[];
}

export function chemistry(team: Team, byId: Map<number, Player>, settings?: Pick<LeagueSettings, "stackChem">): Chemistry {
  const stack = settings?.stackChem ?? false;
  const at = (slot: SlotId) => {
    const id = team.roster[slot];
    return id != null ? byId.get(id) : undefined;
  };
  const raw = new Map<number, number>();
  const bump = (id: number, n: number) => raw.set(id, (raw.get(id) ?? 0) + n);
  const links: ChemLink[] = [];

  // Type stacks inside a unit.
  for (const unit of UNITS) {
    const players = unit.slots.map(at).filter((p): p is Player => !!p);
    const best = new Map<number, number>();
    for (const type of new Set(players.flatMap(p => p.types))) {
      const members = players.filter(p => p.types.includes(type));
      const bonus = STACK_BONUS(members.length);
      if (!bonus) continue;
      links.push({ kind: "stack", label: `${cap(type)} ${unit.label.toLowerCase()}`, members: members.map(p => p.id), bonus });
      for (const p of members) best.set(p.id, stack ? (best.get(p.id) ?? 0) + bonus : Math.max(best.get(p.id) ?? 0, bonus));
    }
    for (const [id, b] of best) bump(id, b);
  }

  // Quarterback connections.
  const qb = at("QB");
  if (qb) {
    const targets = (["RB", "WR1", "WR2", "WR3", "TE"] as SlotId[])
      .map(at)
      .filter((p): p is Player => !!p && p.types.some(t => qb.types.includes(t)));
    if (targets.length) {
      for (const r of targets) bump(r.id, QB_LINK_BONUS);
      bump(qb.id, Math.min(QB_MAX, targets.length));
      links.push({ kind: "qb", label: `${qb.name}'s connection`, members: [qb.id, ...targets.map(p => p.id)], bonus: QB_LINK_BONUS });
    }
  }

  // Evolution lines anywhere on the roster.
  const families = new Map<number, Player[]>();
  for (const slot of Object.keys(SLOT_BY_ID) as SlotId[]) {
    const p = at(slot);
    if (p) families.set(p.family, [...(families.get(p.family) ?? []), p]);
  }
  for (const members of families.values()) {
    if (members.length < 2) continue;
    const head = [...members].sort((a, b) => a.stage - b.stage || a.id - b.id)[0];
    links.push({ kind: "family", label: `${head.name} line`, members: members.map(p => p.id), bonus: FAMILY_BONUS });
    for (const p of members) bump(p.id, FAMILY_BONUS);
  }

  const bonus = new Map<number, number>();
  for (const [id, b] of raw) bonus.set(id, Math.min(MAX_CHEM, b));
  links.sort((a, b) => b.bonus - a.bonus || b.members.length - a.members.length);
  return { bonus, links };
}

/** A copy of the player with chemistry folded into every rating. */
export function withChem(p: Player, bonus: number): Player {
  if (!bonus) return p;
  const up = <K extends string>(r: Record<K, number>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.min(99, (v as number) + bonus)])) as Record<K, number>;
  const posOvr = up(p.posOvr);
  return { ...p, attrs: up(p.attrs), posOvr, ovr: posOvr[p.pos] };
}

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
