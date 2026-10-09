import { poolEntries } from "./dex";
import { buildOrder } from "./draft";
import { ROSTER_SIZE } from "./ratings";
import { mulberry32, shuffle } from "./rng";
import type { League, LeagueSettings, Team } from "./types";

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 12;

/** Every team drafts 22, so the pool caps the league size (Gen I alone fits 6 teams). */
export function maxTeamsFor(settings: Pick<LeagueSettings, "gens" | "legendaries">) {
  return Math.min(MAX_TEAMS, Math.floor(poolEntries(settings).length / ROSTER_SIZE));
}

export const TEAM_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#9333ea",
];

const CITIES = ["Harbor", "Summit", "Riverside", "Ironwood", "Bayview", "Granite", "Lakeshore", "Redrock", "Northgate", "Cedar"];
const MASCOTS = ["Comets", "Wardens", "Thunder", "Tide", "Rangers", "Stampede", "Owls", "Bolts", "Cyclones", "Knights"];

function freshTeamName(taken: Set<string>, rng: () => number) {
  for (let i = 0; i < 50; i++) {
    const name = `${CITIES[Math.floor(rng() * CITIES.length)]} ${MASCOTS[Math.floor(rng() * MASCOTS.length)]}`;
    if (!taken.has(name)) return name;
  }
  return `Team ${taken.size + 1}`;
}

// No 0/O/1/I so codes are easy to read out loud.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function createLobby(hostId: string, hostName: string): League {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const league: League = {
    version: 2,
    code: makeCode(),
    hostId,
    settings: { teamCount: 4, snake: true, randomOrder: true, gens: [1], legendaries: true },
    seed,
    phase: "lobby",
    teams: [],
    draft: { order: [], pick: 0, log: [], snake: true },
    season: null,
  };
  return addManager(league, hostId, hostName);
}

/** Adds a friend to the lobby, or reconnects them to the team they already have. */
export function addManager(league: League, clientId: string, name: string): League {
  const existing = league.teams.find(t => t.managerId === clientId);
  if (existing) {
    return { ...league, teams: league.teams.map(t => (t === existing ? { ...t, manager: name } : t)) };
  }
  if (league.phase !== "lobby") throw new Error("This league has already started drafting.");
  if (league.teams.length >= maxTeamsFor(league.settings)) throw new Error("This league is full.");
  const rng = mulberry32(league.seed + league.teams.length);
  const team: Team = {
    id: league.teams.length,
    name: freshTeamName(new Set(league.teams.map(t => t.name)), rng),
    managerId: clientId,
    manager: name,
    color: TEAM_COLORS[league.teams.length % TEAM_COLORS.length],
    roster: {},
  };
  const teamCount = Math.max(league.settings.teamCount, league.teams.length + 1);
  return { ...league, teams: [...league.teams, team], settings: { ...league.settings, teamCount } };
}

export function removeManager(league: League, clientId: string): League {
  if (league.phase !== "lobby" || clientId === league.hostId) return league;
  const teams = league.teams.filter(t => t.managerId !== clientId).map((t, i) => ({ ...t, id: i, color: TEAM_COLORS[i] }));
  return { ...league, teams };
}

export function renameTeam(league: League, clientId: string, name: string): League {
  const clean = name.trim().slice(0, 28);
  if (!clean) return league;
  return { ...league, teams: league.teams.map(t => (t.managerId === clientId ? { ...t, name: clean } : t)) };
}

export function updateSettings(league: League, patch: Partial<LeagueSettings>): League {
  const settings = { ...league.settings, ...patch };
  settings.gens = [...new Set(settings.gens)].sort((a, b) => a - b);
  if (!settings.gens.length) return league; // need at least one generation
  // The pool must still fit everyone who has already joined.
  if (maxTeamsFor(settings) < league.teams.length) return league;
  settings.teamCount = Math.min(maxTeamsFor(settings), Math.max(MIN_TEAMS, league.teams.length, settings.teamCount));
  return { ...league, settings };
}

/** Fills empty seats with AI teams and builds the pick order. */
export function startDraft(league: League): League {
  const rng = mulberry32(league.seed);
  const teams = [...league.teams];
  while (teams.length < league.settings.teamCount) {
    const i = teams.length;
    teams.push({
      id: i,
      name: freshTeamName(new Set(teams.map(t => t.name)), rng),
      managerId: null,
      manager: null,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      roster: {},
    });
  }
  const ids = teams.map(t => t.id);
  const firstRound = league.settings.randomOrder ? shuffle(rng, ids) : ids;
  return {
    ...league,
    teams,
    phase: "draft",
    draft: { order: buildOrder(firstRound, ROSTER_SIZE, league.settings.snake), pick: 0, log: [], snake: league.settings.snake },
  };
}

// ---- Persistence (host keeps the league; everyone keeps their identity) ----

const SAVE_KEY = "pf-league-v2";
const ME_KEY = "pf-me-v1";

export interface Me {
  clientId: string;
  name: string;
  /** Last league this browser was in, so a refresh reconnects. */
  session: { role: "host" | "guest"; code: string } | null;
}

export function loadMe(): Me {
  try {
    const me = JSON.parse(localStorage.getItem(ME_KEY) ?? "null");
    if (me?.clientId) return me;
  } catch {
    /* fall through */
  }
  return { clientId: crypto.randomUUID(), name: "", session: null };
}

export function saveMe(me: Me) {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    /* ignore */
  }
}

export function loadHostedLeague(): League | null {
  try {
    const l = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    return l?.version === 2 ? l : null;
  } catch {
    return null;
  }
}

export function saveHostedLeague(l: League | null) {
  try {
    if (l) localStorage.setItem(SAVE_KEY, JSON.stringify(l));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
