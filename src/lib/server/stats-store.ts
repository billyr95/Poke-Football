import { ROLE_LIST } from "@/lib/game/ratings";
import {
  TRACKED_STATS, type Combo, type GameReport, type MonDetail, type MonSummary, type RoleLine, type SchemeLine, type StatsSummary,
} from "@/lib/game/tracking";
import type { Role } from "@/lib/game/types";

/**
 * All-time stats storage. Uses Upstash Redis (add it from the Vercel Marketplace; it sets
 * KV_REST_API_URL / KV_REST_API_TOKEN) and falls back to memory when it isn't configured,
 * which is fine for local development but resets on every deploy.
 *
 * Everything is running totals in hashes:
 *   pf:m:<id>        per Pokémon: n, w, pts, r, plus "<role>:n|w|pts|r" and "s:<stat>"
 *   pf:role:<role>   regression sums for expected points by rating: n, sr, sp, srr, srp
 *   pf:c:<id>        teammate combos on the same side: "<role>|<partner>|<partnerRole>" -> games
 *   pf:cw:<id>       same fields -> wins
 *   pf:sum           games, advanced
 *   pf:schemes       "<kind>:<scheme>:n|w"
 */

type Op = [key: string, field: string, by: number];
interface GameOps {
  key: string;
  ops: Op[];
  mons: number[];
}

const DEDUPE_TTL = 60 * 60 * 24 * 120; // seconds
const SUMMARY_TTL = 300;

function toOps(g: GameReport): GameOps {
  const acc = new Map<string, number>();
  const add = (key: string, field: string, by: number) => {
    if (!by) return;
    const k = `${key}\u0000${field}`;
    acc.set(k, (acc.get(k) ?? 0) + by);
  };
  add("pf:sum", "games", 1);
  if (g.mode === "advanced") add("pf:sum", "advanced", 1);
  const mons: number[] = [];
  for (const t of g.teams) {
    if (t.scheme) {
      for (const [kind, name] of [["off", t.scheme.off], ["front", t.scheme.front], ["cov", t.scheme.cov]] as const) {
        add("pf:schemes", `${kind}:${name}:n`, 1);
        add("pf:schemes", `${kind}:${name}:w`, t.result);
      }
    }
    for (const p of t.players) {
      mons.push(p.id);
      const m = `pf:m:${p.id}`;
      add(m, "n", 1);
      add(m, "w", t.result);
      add(m, "pts", p.pts);
      add(m, "r", p.rating);
      add(m, `${p.role}:n`, 1);
      add(m, `${p.role}:w`, t.result);
      add(m, `${p.role}:pts`, p.pts);
      add(m, `${p.role}:r`, p.rating);
      for (const [stat, v] of Object.entries(p.line)) add(m, `s:${stat}`, v);
      const r = `pf:role:${p.role}`;
      add(r, "n", 1);
      add(r, "sr", p.rating);
      add(r, "sp", p.pts);
      add(r, "srr", p.rating * p.rating);
      add(r, "srp", p.rating * p.pts);
    }
    // Combos: teammates on the same side of the ball.
    const offense = new Set(["QB", "RB", "X", "Z", "SLOT", "TE", "T", "G", "C"]);
    for (const p of t.players) {
      for (const q of t.players) {
        if (p === q || offense.has(p.role) !== offense.has(q.role)) continue;
        const field = `${p.role}|${q.id}|${q.role}`;
        add(`pf:c:${p.id}`, field, 1);
        add(`pf:cw:${p.id}`, field, t.result);
      }
    }
  }
  const ops: Op[] = [...acc].map(([k, by]) => {
    const [key, field] = k.split("\u0000");
    return [key, field, Math.round(by * 100) / 100];
  });
  return { key: `pf:g:${g.key}`, ops, mons: [...new Set(mons)] };
}

// ---- Backends ----

interface Backend {
  configured: boolean;
  record(games: GameOps[]): Promise<number>;
  readAll(): Promise<{ mons: [string, Record<string, string>][]; roles: [string, Record<string, string>][]; sum: Record<string, string>; schemes: Record<string, string> }>;
  readCombos(id: number): Promise<{ n: Record<string, string>; w: Record<string, string>; mon: Record<string, string> }>;
  getCache(): Promise<string | null>;
  setCache(v: string): Promise<void>;
}

const RECORD_LUA = `
local games = cjson.decode(ARGV[1])
local recorded = 0
for _, g in ipairs(games) do
  if redis.call('SET', g.key, '1', 'NX', 'EX', ${DEDUPE_TTL}) then
    recorded = recorded + 1
    for _, op in ipairs(g.ops) do redis.call('HINCRBYFLOAT', op[1], op[2], op[3]) end
    for _, m in ipairs(g.mons) do redis.call('SADD', 'pf:mons', m) end
  end
end
if recorded > 0 then redis.call('DEL', 'pf:summary') end
return recorded`;

const READ_LUA = `
local ids = redis.call('SMEMBERS', 'pf:mons')
local mons = {}
for i, id in ipairs(ids) do mons[i] = {id, redis.call('HGETALL', 'pf:m:' .. id)} end
local roles = {}
for i, r in ipairs(cjson.decode(ARGV[1])) do roles[i] = {r, redis.call('HGETALL', 'pf:role:' .. r)} end
return {mons, roles, redis.call('HGETALL', 'pf:sum'), redis.call('HGETALL', 'pf:schemes')}`;

const pairs = (flat: string[] | null | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; flat && i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
};

function redisBackend(url: string, token: string): Backend {
  const call = async (body: unknown, path = "") => {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(`Redis: ${data.error ?? res.status}`);
    return data.result;
  };
  return {
    configured: true,
    async record(games) {
      return Number(await call(["EVAL", RECORD_LUA, "0", JSON.stringify(games)]));
    },
    async readAll() {
      const [mons, roles, sum, schemes] = (await call(["EVAL", READ_LUA, "0", JSON.stringify(ROLE_LIST)])) as [
        [string, string[]][], [string, string[]][], string[], string[],
      ];
      return {
        mons: mons.map(([id, h]) => [String(id), pairs(h)]),
        roles: roles.map(([r, h]) => [r, pairs(h)]),
        sum: pairs(sum),
        schemes: pairs(schemes),
      };
    },
    async readCombos(id) {
      const res = (await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["HGETALL", `pf:c:${id}`], ["HGETALL", `pf:cw:${id}`], ["HGETALL", `pf:m:${id}`]]),
        cache: "no-store",
      }).then(r => r.json())) as { result: string[] }[];
      return { n: pairs(res[0]?.result), w: pairs(res[1]?.result), mon: pairs(res[2]?.result) };
    },
    async getCache() {
      return (await call(["GET", "pf:summary"])) as string | null;
    },
    async setCache(v) {
      await call(["SET", "pf:summary", v, "EX", String(SUMMARY_TTL)]);
    },
  };
}

function memoryBackend(): Backend {
  const g = globalThis as unknown as { __pfStats?: { hashes: Map<string, Map<string, number>>; seen: Set<string>; mons: Set<string> } };
  const db = (g.__pfStats ??= { hashes: new Map(), seen: new Set(), mons: new Set() });
  const hash = (k: string) => {
    let h = db.hashes.get(k);
    if (!h) db.hashes.set(k, (h = new Map()));
    return h;
  };
  const read = (k: string) => Object.fromEntries([...(db.hashes.get(k) ?? [])].map(([f, v]) => [f, String(v)]));
  return {
    configured: false,
    async record(games) {
      let n = 0;
      for (const game of games) {
        if (db.seen.has(game.key)) continue;
        db.seen.add(game.key);
        n++;
        for (const [k, f, by] of game.ops) hash(k).set(f, (hash(k).get(f) ?? 0) + by);
        for (const m of game.mons) db.mons.add(String(m));
      }
      return n;
    },
    async readAll() {
      return {
        mons: [...db.mons].map(id => [id, read(`pf:m:${id}`)]),
        roles: ROLE_LIST.map(r => [r, read(`pf:role:${r}`)]),
        sum: read("pf:sum"),
        schemes: read("pf:schemes"),
      };
    },
    async readCombos(id) {
      return { n: read(`pf:c:${id}`), w: read(`pf:cw:${id}`), mon: read(`pf:m:${id}`) };
    },
    async getCache() {
      return null;
    },
    async setCache() {},
  };
}

function backend(): Backend {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? redisBackend(url, token) : memoryBackend();
}

// ---- Public API ----

export async function recordGames(games: GameReport[]) {
  return backend().record(games.map(toOps));
}

const num = (h: Record<string, string>, f: string) => Number(h[f] ?? 0);
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

export async function summary(): Promise<StatsSummary> {
  const b = backend();
  const cached = await b.getCache().catch(() => null);
  if (cached) return JSON.parse(cached);

  const { mons, roles, sum, schemes } = await b.readAll();
  // Expected points by rating, per role: a least-squares line through every player-game at that role.
  const line = new Map<string, { a: number; b: number }>();
  for (const [role, h] of roles) {
    const n = num(h, "n");
    if (!n) continue;
    const sr = num(h, "sr"), sp = num(h, "sp"), srr = num(h, "srr"), srp = num(h, "srp");
    const den = n * srr - sr * sr;
    const slope = den > 1e-6 ? (n * srp - sr * sp) / den : 0;
    line.set(role, { a: (sp - slope * sr) / n, b: slope });
  }

  const out: MonSummary[] = mons.map(([id, h]) => {
    const n = num(h, "n");
    const roleLines: RoleLine[] = ROLE_LIST.filter(r => num(h, `${r}:n`) > 0).map(r => {
      const rn = num(h, `${r}:n`);
      const rating = num(h, `${r}:r`) / rn;
      const fit = line.get(r) ?? { a: 0, b: 0 };
      return {
        role: r,
        n: rn,
        winPct: round(num(h, `${r}:w`) / rn, 3),
        ppg: round(num(h, `${r}:pts`) / rn),
        expected: round(fit.a + fit.b * rating),
        rating: round(rating),
      };
    }).sort((x, y) => y.n - x.n);
    const expected = roleLines.reduce((acc, r) => acc + r.expected * r.n, 0) / (n || 1);
    const ppg = num(h, "pts") / (n || 1);
    const stats: MonSummary["stats"] = {};
    for (const k of TRACKED_STATS) if (h[`s:${k}`]) stats[k] = Math.round(num(h, `s:${k}`));
    return {
      id: Number(id),
      n,
      winPct: round(num(h, "w") / (n || 1), 3),
      ppg: round(ppg),
      expected: round(expected),
      diff: round(ppg - expected),
      rating: round(num(h, "r") / (n || 1)),
      mainRole: (roleLines[0]?.role ?? "QB") as Role,
      roles: roleLines,
      stats,
    };
  });

  const schemeLines: SchemeLine[] = [];
  for (const [f, v] of Object.entries(schemes)) {
    const [kind, name, metric] = f.split(":");
    if (metric !== "n") continue;
    const n = Number(v);
    schemeLines.push({ kind: kind as SchemeLine["kind"], scheme: name, n, winPct: round(num(schemes, `${kind}:${name}:w`) / n, 3) });
  }

  const result: StatsSummary = {
    configured: b.configured,
    games: num(sum, "games"),
    advancedGames: num(sum, "advanced"),
    mons: out,
    schemes: schemeLines,
  };
  await b.setCache(JSON.stringify(result)).catch(() => {});
  return result;
}

export async function monDetail(id: number): Promise<MonDetail> {
  const { n, w, mon } = await backend().readCombos(id);
  const combos: Combo[] = [];
  for (const [field, games] of Object.entries(n)) {
    const [role, partner, partnerRole] = field.split("|");
    const g = Number(games);
    const roleWin = num(mon, `${role}:w`) / (num(mon, `${role}:n`) || 1);
    combos.push({
      role: role as Role,
      partner: Number(partner),
      partnerRole: partnerRole as Role,
      n: g,
      winPct: round(Number(w[field] ?? 0) / g, 3),
      lift: round(Number(w[field] ?? 0) / g - roleWin, 3),
    });
  }
  return { id, combos };
}
