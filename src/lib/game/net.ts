"use client";

import type { DataConnection, Peer } from "peerjs";
import type { League, LeagueSettings, SlotId } from "./types";

/**
 * Peer-to-peer league connections (PeerJS / WebRTC). The host's browser owns the league:
 * friends connect with the invite code, send their actions, and receive the full league state back.
 */

const PREFIX = "pokefootball-v2-";

export type GuestMessage =
  | { t: "hello"; clientId: string; name: string }
  | { t: "pick"; clientId: string; playerId: number; slotId: SlotId }
  | { t: "rename"; clientId: string; teamName: string };

export type HostMessage =
  | { t: "state"; league: League; now: number } // now = host clock, so guests can sync the pick timer
  | { t: "error"; message: string }
  | { t: "kicked"; message: string };

export type { LeagueSettings };

/** Fetches STUN/TURN servers from /api/ice (falls back to public STUN if that fails). */
let iceCache: Promise<RTCIceServer[]> | null = null;
function iceServers(): Promise<RTCIceServer[]> {
  iceCache ??= (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch("/api/ice", { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      const data = (await res.json()) as { iceServers: RTCIceServer[]; source: string };
      if (data.source === "stun-only") console.warn("No TURN relay configured: players on strict networks may not be able to connect.");
      return data.iceServers;
    } catch {
      iceCache = null; // try again next time
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  })();
  return iceCache;
}

async function newPeer(id?: string): Promise<Peer> {
  const [{ Peer }, ice] = await Promise.all([import("peerjs"), iceServers()]);
  return new Promise((resolve, reject) => {
    const opts = { config: { iceServers: ice } };
    const peer = id ? new Peer(id, opts) : new Peer(opts);
    const onError = (e: { type?: string; message?: string }) => {
      peer.destroy();
      reject(
        new Error(
          e.type === "unavailable-id"
            ? "That league code is already being hosted in another tab."
            : `Couldn't reach the connection server (${e.type ?? e.message}). Check your internet connection and try again.`,
        ),
      );
    };
    peer.once("open", () => {
      peer.off("error", onError);
      resolve(peer);
    });
    peer.once("error", onError);
  });
}

export interface HostLink {
  broadcast(league: League): void;
  send(conn: DataConnection, msg: HostMessage): void;
  close(): void;
}

export async function startHosting(
  code: string,
  onMessage: (msg: GuestMessage, conn: DataConnection) => void,
  onGuestLeft: (clientId: string) => void,
): Promise<HostLink> {
  const peer = await newPeer(PREFIX + code);
  const conns = new Map<DataConnection, string | null>(); // connection -> clientId once they say hello

  peer.on("connection", conn => {
    conns.set(conn, null);
    conn.on("data", raw => {
      const msg = raw as GuestMessage;
      if (msg?.t === "hello") conns.set(conn, msg.clientId);
      onMessage(msg, conn);
    });
    conn.on("close", () => {
      const id = conns.get(conn);
      conns.delete(conn);
      if (id) onGuestLeft(id);
    });
  });
  // Keep the code registered if the signalling server blips.
  peer.on("disconnected", () => !peer.destroyed && peer.reconnect());

  return {
    broadcast(league) {
      const msg: HostMessage = { t: "state", league, now: Date.now() };
      for (const c of conns.keys()) if (c.open) c.send(msg);
    },
    send(conn, msg) {
      if (conn.open) conn.send(msg);
    },
    close() {
      peer.destroy();
    },
  };
}

export interface GuestLink {
  send(msg: GuestMessage): void;
  close(): void;
}

export async function joinLeague(
  code: string,
  hello: Extract<GuestMessage, { t: "hello" }>,
  onMessage: (msg: HostMessage) => void,
  onClosed: () => void,
): Promise<GuestLink> {
  const peer = await newPeer();
  const conn = peer.connect(PREFIX + code, { reliable: true });

  await new Promise<void>((resolve, reject) => {
    const fail = (msg: string) => {
      clearTimeout(timer);
      reject(new Error(msg));
    };
    const BLOCKED =
      "Found the league, but couldn't connect to the host. One of your networks is blocking direct connections. " +
      "Try again, or try a different network (e.g. phone hotspot).";
    const timer = setTimeout(() => fail(BLOCKED), 20000);
    peer.once("error", e =>
      fail(e.type === "peer-unavailable" ? "No league found with that code. Check it with your host, and make sure their tab is open." : e.message),
    );
    // Fail fast when the browsers can't find any route to each other.
    const watchIce = () => {
      const pc = conn.peerConnection;
      if (!pc) return setTimeout(watchIce, 100);
      pc.addEventListener("iceconnectionstatechange", () => {
        if (pc.iceConnectionState === "failed") fail(BLOCKED);
      });
    };
    watchIce();
    conn.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
  }).catch(e => {
    peer.destroy();
    throw e;
  });

  conn.on("data", raw => onMessage(raw as HostMessage));
  conn.on("close", onClosed);
  conn.send(hello);

  return {
    send(msg) {
      if (conn.open) conn.send(msg);
    },
    close() {
      peer.destroy();
    },
  };
}
