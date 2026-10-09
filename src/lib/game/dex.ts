import raw from "@/data/dex.json";
import { ratePlayers } from "./ratings";
import type { DexEntry, LeagueSettings, Player } from "./types";

/** The full National Dex, pulled from PokeAPI by scripts/build-dex.mts. */

type RawEntry = Omit<DexEntry, "stage" | "maturity">;
const RAW = raw as RawEntry[];
const rawById = new Map(RAW.map(p => [p.id, p]));

function stageOf(p: RawEntry): number {
  let stage = 1;
  for (let cur = p; cur.evolvesFrom && rawById.has(cur.evolvesFrom); cur = rawById.get(cur.evolvesFrom)!) stage++;
  return stage;
}

const stages = new Map(RAW.map(p => [p.id, stageOf(p)]));
const familyDepth = new Map<number, number>();
const familySize = new Map<number, number>();
for (const p of RAW) {
  familyDepth.set(p.family, Math.max(familyDepth.get(p.family) ?? 1, stages.get(p.id)!));
  familySize.set(p.family, (familySize.get(p.family) ?? 0) + 1);
}

export const DEX: DexEntry[] = RAW.map(p => ({
  ...p,
  stage: stages.get(p.id)!,
  maturity: stages.get(p.id)! / familyDepth.get(p.family)!,
  // A pseudo-legendary is a 600-BST, three-stage line (so Archaludon doesn't count).
  rarity: p.rarity === "pseudo" && (familySize.get(p.family) ?? 0) < 3 ? null : p.rarity,
}));

export const GENERATIONS = [
  { gen: 1, label: "Gen I", region: "Kanto" },
  { gen: 2, label: "Gen II", region: "Johto" },
  { gen: 3, label: "Gen III", region: "Hoenn" },
  { gen: 4, label: "Gen IV", region: "Sinnoh" },
  { gen: 5, label: "Gen V", region: "Unova" },
  { gen: 6, label: "Gen VI", region: "Kalos" },
  { gen: 7, label: "Gen VII", region: "Alola" },
  { gen: 8, label: "Gen VIII", region: "Galar" },
  { gen: 9, label: "Gen IX", region: "Paldea" },
].map(g => ({ ...g, count: DEX.filter(p => p.gen === g.gen).length }));

export const isLegendary = (p: Pick<DexEntry, "rarity">) => p.rarity === "legendary" || p.rarity === "mythical";

type PoolSettings = Pick<LeagueSettings, "gens" | "legendaries">;

export function poolEntries(settings: PoolSettings): DexEntry[] {
  const gens = new Set(settings.gens);
  return DEX.filter(p => gens.has(p.gen) && (settings.legendaries || !isLegendary(p)));
}

const cache = new Map<string, Player[]>();

/** The league's draft pool, rated against itself: 70 is this pool's average. */
export function ratedPool(settings: PoolSettings): Player[] {
  const key = `${[...settings.gens].sort().join(",")}|${settings.legendaries}`;
  if (!cache.has(key)) cache.set(key, ratePlayers(poolEntries(settings)));
  return cache.get(key)!;
}
