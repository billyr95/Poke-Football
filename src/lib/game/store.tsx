"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ratedPool } from "./dex";
import { aiChoose, makePick, onClock, startClock } from "./draft";
import {
  addManager, createLobby, loadHostedLeague, loadMe, removeManager, renameTeam, saveHostedLeague, saveMe,
  startDraft, updateSettings, type Me,
} from "./league";
import { joinLeague, startHosting, type GuestLink, type GuestMessage, type HostLink } from "./net";
import { advance, simToEnd, startSeason } from "./sim";
import type { League, LeagueSettings, Player, SlotId } from "./types";

type Status = "idle" | "connecting" | "connected" | "lost";

interface GameContext {
  me: Me;
  role: "host" | "guest" | null;
  status: Status;
  error: string | null;
  league: League | null;
  pool: Player[];
  byId: Map<number, Player>;
  /** Which team (id) each drafted Pokémon belongs to. */
  ownerOf: Map<number, number>;
  myTeamId: number | null;
  isHost: boolean;
  /** Host clock minus this browser's clock, in ms; add it to Date.now() to compare with draft.deadline. */
  clockOffset: number;

  host(name: string): Promise<void>;
  join(code: string, name: string): Promise<void>;
  leave(): void;
  clearError(): void;

  pick(playerId: number, slotId: SlotId): void;
  renameMyTeam(name: string): void;
  // host only
  setSettings(patch: Partial<LeagueSettings>): void;
  beginDraft(): void;
  autoPick(): void;
  beginSeason(): void;
  playNext(): void;
  playAll(): void;
}

const Ctx = createContext<GameContext | null>(null);

export function useGame() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}

const AI_PICK_DELAY_MS = 650;

export function GameProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me>(loadMe);
  const [league, setLeagueState] = useState<League | null>(null);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  const leagueRef = useRef<League | null>(null);
  const hostLink = useRef<HostLink | null>(null);
  const guestLink = useRef<GuestLink | null>(null);
  const setMe = useCallback((m: Me) => {
    saveMe(m);
    setMeState(m);
  }, []);

  /** Host-side state change: save, show, and send to everyone. */
  const commit = useCallback((next: League | null) => {
    leagueRef.current = next;
    saveHostedLeague(next);
    setLeagueState(next);
    if (next) hostLink.current?.broadcast(next);
  }, []);

  const apply = useCallback(
    (fn: (l: League) => League) => {
      const cur = leagueRef.current;
      if (!cur) return;
      try {
        commit(fn(cur));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [commit],
  );

  const onGuestMessage = useCallback(
    (msg: GuestMessage, conn: Parameters<HostLink["send"]>[0]) => {
      const cur = leagueRef.current;
      if (!cur || !hostLink.current) return;
      try {
        if (msg.t === "hello") {
          commit(addManager(cur, msg.clientId, msg.name.slice(0, 20)));
          hostLink.current.send(conn, { t: "state", league: leagueRef.current!, now: Date.now() });
        } else if (msg.t === "pick") {
          if (onClock(cur)?.managerId !== msg.clientId) throw new Error("It's not your pick.");
          commit(makePick(cur, msg.playerId, msg.slotId));
        } else if (msg.t === "rename") {
          commit(renameTeam(cur, msg.clientId, msg.teamName));
        }
      } catch (e) {
        hostLink.current.send(conn, { t: msg.t === "hello" ? "kicked" : "error", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [commit],
  );

  const goHost = useCallback(
    async (l: League) => {
      setStatus("connecting");
      setRole("host");
      setClockOffset(0);
      // Coming back mid-draft (e.g. after a refresh): give whoever is on the clock a fresh timer.
      commit(l.phase === "draft" ? startClock(l) : l);
      hostLink.current = await startHosting(l.code, onGuestMessage, clientId => {
        const cur = leagueRef.current;
        if (cur?.phase === "lobby") commit(removeManager(cur, clientId));
      });
      setStatus("connected");
    },
    [commit, onGuestMessage],
  );

  const goJoin = useCallback(async (code: string, m: Me) => {
    setStatus("connecting");
    setRole("guest");
    guestLink.current = await joinLeague(
      code,
      { t: "hello", clientId: m.clientId, name: m.name },
      msg => {
        if (msg.t === "state") {
          setClockOffset(msg.now - Date.now());
          leagueRef.current = msg.league;
          setLeagueState(msg.league);
        } else if (msg.t === "error") {
          setError(msg.message);
        } else if (msg.t === "kicked") {
          setError(msg.message);
          guestLink.current?.close();
          guestLink.current = null;
          setMe({ ...m, session: null });
          setRole(null);
          setStatus("idle");
          setLeagueState(null);
        }
      },
      () => setStatus("lost"),
    );
    setStatus("connected");
  }, [setMe]);

  // On load: reconnect to the last league this browser was in.
  useEffect(() => {
    const m = me;
    saveMe(m);
    const s = m.session;
    if (!s) return;
    const resume = async () => {
      if (s.role === "host") {
        const saved = loadHostedLeague();
        if (saved?.code === s.code) return goHost(saved);
      } else {
        return goJoin(s.code, m);
      }
      setMe({ ...m, session: null });
    };
    resume().catch(e => {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("lost");
    });
    return () => {
      hostLink.current?.close();
      guestLink.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settingsKey = league ? JSON.stringify([league.settings.gens, league.settings.legendaries]) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => (league ? ratedPool(league.settings) : []), [settingsKey]);
  const byId = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);

  // Host runs the AI teams' picks.
  useEffect(() => {
    if (role !== "host" || league?.phase !== "draft") return;
    const team = onClock(league);
    if (!team || team.managerId) return;
    const timer = setTimeout(() => {
      apply(l => {
        const choice = aiChoose(l, pool);
        return choice ? makePick(l, choice.playerId, choice.slotId) : l;
      });
    }, AI_PICK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [role, league, pool, apply]);

  // Host enforces the pick timer: when it runs out, the best available player is drafted for that team.
  useEffect(() => {
    const deadline = league?.draft.deadline;
    if (role !== "host" || league?.phase !== "draft" || deadline == null) return;
    const timer = setTimeout(() => {
      apply(l => {
        if (l.draft.deadline !== deadline) return l; // someone picked in time
        const choice = aiChoose(l, pool);
        return choice ? makePick(l, choice.playerId, choice.slotId) : l;
      });
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [role, league, pool, apply]);

  const value = useMemo<GameContext>(() => {
    const ownerOf = new Map<number, number>();
    for (const p of league?.draft.log ?? []) ownerOf.set(p.playerId, p.teamId);
    const myTeamId = league?.teams.find(t => t.managerId === me.clientId)?.id ?? null;
    const isHost = role === "host";
    const hostOnly = (fn: (l: League) => League) => () => isHost && apply(fn);

    return {
      me, role, status, error, league, pool, byId, ownerOf, myTeamId, isHost, clockOffset,

      async host(name) {
        setError(null);
        const m = { ...me, name };
        const l = createLobby(m.clientId, name);
        setMe({ ...m, session: { role: "host", code: l.code } });
        try {
          await goHost(l);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("idle");
          setRole(null);
          commit(null);
          setMe({ ...m, session: null });
        }
      },
      async join(code, name) {
        setError(null);
        const m = { ...me, name, session: { role: "guest" as const, code } };
        setMe(m);
        try {
          await goJoin(code, m);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("idle");
          setRole(null);
          setMe({ ...m, session: null });
        }
      },
      leave() {
        hostLink.current?.close();
        guestLink.current?.close();
        hostLink.current = guestLink.current = null;
        if (isHost) saveHostedLeague(null);
        leagueRef.current = null;
        setLeagueState(null);
        setRole(null);
        setStatus("idle");
        setMe({ ...me, session: null });
      },
      clearError: () => setError(null),

      pick(playerId, slotId) {
        if (isHost) {
          if (onClock(leagueRef.current!)?.managerId !== me.clientId) return setError("It's not your pick.");
          apply(l => makePick(l, playerId, slotId));
        } else {
          guestLink.current?.send({ t: "pick", clientId: me.clientId, playerId, slotId });
        }
      },
      renameMyTeam(name) {
        if (isHost) apply(l => renameTeam(l, me.clientId, name));
        else guestLink.current?.send({ t: "rename", clientId: me.clientId, teamName: name });
      },
      setSettings: patch => isHost && apply(l => updateSettings(l, patch)),
      beginDraft: hostOnly(startDraft),
      autoPick: hostOnly(l => {
        const choice = aiChoose(l, pool);
        return choice ? makePick(l, choice.playerId, choice.slotId) : l;
      }),
      beginSeason: hostOnly(startSeason),
      playNext: hostOnly(l => advance(l, byId)),
      playAll: hostOnly(l => simToEnd(l, byId)),
    };
  }, [me, role, status, error, league, pool, byId, clockOffset, apply, commit, goHost, goJoin, setMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
