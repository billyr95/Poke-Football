/**
 * Pulls every Pokémon (National Dex #1–1025) from PokeAPI and writes src/data/dex.json.
 * Run with: npm run build:dex
 * PokeAPI asks clients to cache data instead of hammering the API, so we fetch once and ship the result.
 */
import { writeFileSync } from "node:fs";

const API = "https://pokeapi.co/api/v2";
const LAST_ID = 1025;
const CONCURRENCY = 16;
const PSEUDO_BST = 600; // non-legendary 600 BST lines: Dragonite, Tyranitar, Salamence…

type Ref = { name: string; url: string };
interface ApiPokemon {
  height: number;
  weight: number;
  types: { slot: number; type: Ref }[];
  stats: { base_stat: number; stat: Ref }[];
}
interface ApiSpecies {
  name: string;
  names: { name: string; language: Ref }[];
  generation: Ref;
  evolution_chain: { url: string };
  evolves_from_species: Ref | null;
  is_legendary: boolean;
  is_mythical: boolean;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

async function getJson<T>(url: string, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function fetchOne(id: number) {
  const [d, sp] = await Promise.all([
    getJson<ApiPokemon>(`${API}/pokemon/${id}`),
    getJson<ApiSpecies>(`${API}/pokemon-species/${id}`),
  ]);
  const stat = (n: string) => d.stats.find(s => s.stat.name === n)!.base_stat;
  const bst = d.stats.reduce((a, s) => a + s.base_stat, 0);
  const name = sp.names.find(n => n.language.name === "en")?.name ?? sp.name;
  return {
    id,
    name,
    gen: ROMAN[sp.generation.name.replace("generation-", "")],
    types: [...d.types].sort((a, b) => a.slot - b.slot).map(t => t.type.name),
    heightM: d.height / 10,
    weightKg: d.weight / 10,
    base: {
      hp: stat("hp"), atk: stat("attack"), def: stat("defense"),
      spa: stat("special-attack"), spd: stat("special-defense"), spe: stat("speed"),
    },
    family: Number(sp.evolution_chain.url.match(/\/(\d+)\/?$/)![1]),
    evolvesFrom: sp.evolves_from_species ? Number(sp.evolves_from_species.url.match(/\/(\d+)\/?$/)![1]) : null,
    rarity: sp.is_mythical ? "mythical" : sp.is_legendary ? "legendary" : bst === PSEUDO_BST ? "pseudo" : null,
  };
}

const out: Awaited<ReturnType<typeof fetchOne>>[] = new Array(LAST_ID);
let next = 1;
let done = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next <= LAST_ID) {
    const id = next++;
    out[id - 1] = await fetchOne(id);
    if (++done % 100 === 0) console.log(`${done}/${LAST_ID}`);
  }
}));
writeFileSync(new URL("../src/data/dex.json", import.meta.url), JSON.stringify(out));
console.log(`Wrote ${out.length} Pokémon to src/data/dex.json`);
