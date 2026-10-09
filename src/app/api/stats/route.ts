/**
 * All-time stats across every league ever played.
 *   POST { games: GameReport[] }  — the host's browser reports games it just played
 *   GET                           — summary for the stats page
 *   GET ?mon=<dex id>             — one Pokémon's best teammate combinations
 */

import { connection } from "next/server";
import { ROLE_LIST, SLOT_BY_ID } from "@/lib/game/ratings";
import { TRACKED_STATS, type GameReport, type PlayerReport, type TeamReport } from "@/lib/game/tracking";
import { monDetail, recordGames, summary } from "@/lib/server/stats-store";

const MAX_GAMES = 200;
const isNum = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

// Reports come from players' browsers, so accept only well-formed, plausible ones.
function validPlayer(p: PlayerReport) {
  return (
    isNum(p?.id, 1, 2000) && p.slot in SLOT_BY_ID && ROLE_LIST.includes(p.role) && isNum(p.rating, 0, 300) && isNum(p.pts, -100, 1000) &&
    typeof p.line === "object" && Object.entries(p.line ?? {}).every(([k, v]) => (TRACKED_STATS as readonly string[]).includes(k) && isNum(v, -100, 5000))
  );
}
function validTeam(t: TeamReport) {
  return [0, 0.5, 1].includes(t?.result) && Array.isArray(t.players) && t.players.length <= 22 && t.players.every(validPlayer);
}
function validGame(g: GameReport) {
  return typeof g?.key === "string" && g.key.length < 120 && ["standard", "advanced"].includes(g.mode) &&
    Array.isArray(g.teams) && g.teams.length === 2 && g.teams.every(validTeam);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { games?: GameReport[] } | null;
  const games = Array.isArray(body?.games) ? body.games.slice(0, MAX_GAMES).filter(validGame) : [];
  if (!games.length) return Response.json({ recorded: 0 }, { status: 400 });
  try {
    return Response.json({ recorded: await recordGames(games) });
  } catch (e) {
    console.error("Recording stats failed:", e);
    return Response.json({ recorded: 0 }, { status: 502 });
  }
}

export async function GET(req: Request) {
  await connection();
  const mon = Number(new URL(req.url).searchParams.get("mon"));
  try {
    const data = mon > 0 ? await monDetail(mon) : await summary();
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Reading stats failed:", e);
    return Response.json({ error: "Stats are unavailable right now." }, { status: 502 });
  }
}
