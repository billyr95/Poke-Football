/**
 * Turns the scheme scouting sheet (scripts/data/scheme-scouting.csv) into src/data/schemes.json.
 * Run with: npm run build:schemes
 *
 * Most Pokémon share a scouting profile with others of the same archetype, so the output stores
 * each distinct profile once and maps every dex number to one.
 */
import { readFileSync, writeFileSync } from "node:fs";

const rows = readFileSync(new URL("./data/scheme-scouting.csv", import.meta.url), "utf8").trim().split(/\r?\n/).map(l => l.split(","));
const [header, ...data] = rows;
const col = (name: string) => header.indexOf(name);
const off = header.filter(h => h.startsWith("O_"));
const def = header.filter(h => h.startsWith("D_"));

const profiles: { archetype: string; ideal: string; off: number[]; def: number[] }[] = [];
const keyToIndex = new Map<string, number>();
const mon: Record<number, number> = {};

for (const r of data) {
  const profile = {
    archetype: r[col("football_archetype")],
    ideal: r[col("ideal_position")],
    off: off.map(h => Number(r[col(h)])),
    def: def.map(h => Number(r[col(h)])),
  };
  if ([...profile.off, ...profile.def].some(n => !(n >= 1 && n <= 5))) throw new Error(`Bad fit score for #${r[0]}`);
  const key = JSON.stringify(profile);
  if (!keyToIndex.has(key)) {
    keyToIndex.set(key, profiles.length);
    profiles.push(profile);
  }
  mon[Number(r[col("dex")])] = keyToIndex.get(key)!;
}

const strip = (h: string) => h.slice(2);
writeFileSync(
  new URL("../src/data/schemes.json", import.meta.url),
  JSON.stringify({ off: off.map(strip), def: def.map(strip), profiles, mon }),
);
console.log(`${data.length} Pokémon, ${profiles.length} scouting profiles`);
