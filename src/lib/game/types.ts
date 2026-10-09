export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type BaseStats = Record<StatKey, number>;

export type AttrKey = "SPD" | "STR" | "AGI" | "AWR" | "CTH" | "THP" | "THA" | "BLK" | "TKL" | "COV";
export type Pos = "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "CB" | "S";
export type Side = "off" | "def";

export type SlotId =
  | "QB" | "RB" | "WR1" | "WR2" | "WR3" | "TE" | "LT" | "LG" | "C" | "RG" | "RT"
  | "DE1" | "DT1" | "DT2" | "DE2" | "LB1" | "LB2" | "LB3" | "CB1" | "CB2" | "FS" | "SS";

export interface Slot {
  id: SlotId;
  pos: Pos;
  label: string;
  side: Side;
}

/** Raw data straight from PokeAPI. */
export type Rarity = "legendary" | "mythical" | "pseudo" | null;

export interface DexEntry {
  id: number;
  name: string;
  types: string[];
  heightM: number;
  weightKg: number;
  base: BaseStats;
  /** Evolution chain id from PokeAPI; members of one chain share it. */
  family: number;
  evolvesFrom: number | null;
  rarity: Rarity;
  gen: number;
  /** 1 = basic, 2 = first evolution, 3 = second. */
  stage: number;
  /** stage ÷ the deepest stage in its family; 1 for fully evolved and single-stage Pokémon. */
  maturity: number;
}

/** A Pokémon with football ratings attached. */
export interface Player extends DexEntry {
  /** Rating points added for legendary / pseudo-legendary status (already included below). */
  rarityBonus: number;
  attrs: Record<AttrKey, number>;
  posOvr: Record<Pos, number>;
  pos: Pos;
  ovr: number;
}

export type Roster = Partial<Record<SlotId, number>>;

export interface Team {
  id: number;
  name: string;
  /** Client id of the friend running this team, or null for an AI team. */
  managerId: string | null;
  manager: string | null; // display name
  color: string;
  roster: Roster;
}

export interface PickRecord {
  pick: number;
  teamId: number;
  playerId: number;
  slotId: SlotId;
}

export interface DraftState {
  order: number[]; // team id for every pick, in order
  pick: number; // index into order of the pick on the clock
  /** When the current pick's timer runs out (host clock, ms since epoch), or null if untimed. */
  deadline: number | null;
  log: PickRecord[];
  snake: boolean;
}

export interface StatLine {
  // passing
  passAtt: number; passCmp: number; passYds: number; passTd: number; passInt: number; passLong: number;
  sacked: number; sackYdsLost: number;
  // rushing
  rushAtt: number; rushYds: number; rushTd: number; rushLong: number; fumbles: number; fumblesLost: number;
  // receiving
  targets: number; rec: number; recYds: number; recTd: number; recLong: number; yac: number;
  // defense
  tkl: number; tfl: number; sack: number; defInt: number; intYds: number; passDef: number; ff: number; fr: number; safety: number;
}

/** "Long" stats keep the best single play instead of adding up. */
export const LONG_KEYS = ["passLong", "rushLong", "recLong"] as const;

export interface TeamLine {
  plays: number; firstDowns: number; totalYds: number;
  passYds: number; // net of sack yardage, like the NFL
  rushYds: number; rushAtt: number; passAtt: number;
  thirdAtt: number; thirdConv: number; fourthAtt: number; fourthConv: number;
  rzAtt: number; rzTd: number;
  turnovers: number; sacksAllowed: number;
  fga: number; fgm: number; fgLong: number; xpa: number; xpm: number;
  punts: number; puntYds: number;
}

export interface GameResult {
  score: [number, number]; // [home, away]
  /** Box score keyed by Pokémon id; each player is on exactly one team. */
  stats: Record<number, Partial<StatLine>>;
  /** Team stats, [home, away]. Missing on games played before team stats existed. */
  team?: [TeamLine, TeamLine];
  plays: string[]; // scoring summary
}

export interface Game {
  id: string;
  home: number;
  away: number;
  result?: GameResult;
}

export interface SeasonState {
  weeks: Game[][];
  week: number; // next week to play
  playoffs: Game[][]; // rounds, filled in as they're decided
  championId: number | null;
}

export type Phase = "lobby" | "draft" | "review" | "season" | "done";

export interface LeagueSettings {
  teamCount: number; // humans + AI fill
  gens: number[]; // which generations are in the draft pool
  legendaries: boolean; // include legendary & mythical Pokémon
  pickSeconds: number | null; // pick timer; null = no timer
  snake: boolean;
  randomOrder: boolean;
  /** A player in several type stacks gets every stack's bonus instead of just the best one. Missing on older leagues = off. */
  stackChem?: boolean;
  /** Hidden surprises (Bidoof). Missing on older leagues = on. */
  easterEggs?: boolean;
}

export interface League {
  version: 2;
  code: string; // invite code
  hostId: string;
  settings: LeagueSettings;
  seed: number;
  phase: Phase;
  teams: Team[];
  draft: DraftState;
  season: SeasonState | null;
}
