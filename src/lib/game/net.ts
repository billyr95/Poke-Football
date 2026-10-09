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
  | { t: "kicked"; message: string }
  | { t: "ping" }; // heartbeat, so guests notice when the host vanishes without saying goodbye

const PING_MS = 5000;
const HOST_SILENT_MS = 20000;

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
  /** Tells every guest the league is over (so they go back to the home page), then disconnects. */
  end(message: string): void;
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
  // Keep the code registered: guests can only find us while we're connected to the signalling server.
  // Connections drop when the tab sleeps or the network blips, and a single reconnect can fail, so keep trying.
  const keepAlive = () => {
    if (peer.destroyed || !peer.disconnected) return;
    try {
      peer.reconnect();
    } catch {
      // still offline; the next tick retries
    }
  };
  peer.on("disconnected", keepAlive);
  peer.on("error", e => console.warn("Host connection error:", e.type));
  const retry = setInterval(keepAlive, 5000);
  const ping = setInterval(() => {
    for (const c of conns.keys()) if (c.open) c.send({ t: "ping" } satisfies HostMessage);
  }, PING_MS);
  const wake = keepScreenAwake();
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    keepAlive();
    wake.renew();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", keepAlive);

  const link: HostLink = {
    broadcast(league) {
      const msg: HostMessage = { t: "state", league, now: Date.now() };
      for (const c of conns.keys()) if (c.open) c.send(msg);
    },
    send(conn, msg) {
      if (conn.open) conn.send(msg);
    },
    end(message) {
      for (const c of conns.keys()) if (c.open) c.send({ t: "kicked", message } satisfies HostMessage);
      setTimeout(() => link.close(), 500); // give the goodbye a moment to arrive
    },
    close() {
      clearInterval(retry);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", keepAlive);
      wake.release();
      peer.destroy();
    },
  };
  return link;
}

/** Stops the host's screen from sleeping (which would cut off the league). Best effort: not every browser supports it. */
function keepScreenAwake() {
  let lock: WakeLockSentinel | null = null;
  let released = false;
  const renew = () => {
    if (released || (lock && !lock.released) || !("wakeLock" in navigator)) return;
    navigator.wakeLock.request("screen").then(
      l => (lock = l),
      () => {},
    );
  };
  renew();
  return {
    renew,
    release() {
      released = true;
      lock?.release().catch(() => {});
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
  // A first attempt can fail on a network blip or while the host's tab wakes up, so try twice before giving up.
  let peer: Peer, conn: DataConnection;
  for (let attempt = 1; ; attempt++) {
    try {
      ({ peer, conn } = await connectToHost(code));
      break;
    } catch (e) {
      if (attempt >= 2 || !(e instanceof RetryableError)) throw e;
    }
  }

  // A closed tab or dead network doesn't always close the connection, so also give up when the host goes quiet.
  let lastHeard = Date.now();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(watchdog);
    peer.destroy();
  };
  const watchdog = setInterval(() => {
    if (Date.now() - lastHeard < HOST_SILENT_MS) return;
    close();
    onClosed();
  }, 1000);
  conn.on("data", raw => {
    lastHeard = Date.now();
    const msg = raw as HostMessage;
    if (msg.t !== "ping") onMessage(msg);
  });
  conn.on("close", () => {
    if (closed) return;
    close();
    onClosed();
  });
  conn.send(hello);

  return {
    send(msg) {
      if (conn.open) conn.send(msg);
    },
    close,
  };
}

class RetryableError extends Error {}

async function connectToHost(code: string): Promise<{ peer: Peer; conn: DataConnection }> {
  const peer = await newPeer();
  const conn = peer.connect(PREFIX + code, { reliable: true });

  await new Promise<void>((resolve, reject) => {
    const fail = (err: Error) => {
      clearTimeout(timer);
      reject(err);
    };
    const NO_ANSWER =
      "Found the league, but the host's game isn't responding. Ask your host to keep the PokeFootball tab open " +
      "and on screen (not minimised or asleep), then try again.";
    const BLOCKED =
      "Found the league, but couldn't connect to the host. One of your networks is blocking the connection. " +
      "Try again, or try a different network (e.g. phone hotspot).";
    // If the host never answered our offer, their tab is asleep or offline; otherwise the networks couldn't link up.
    const timer = setTimeout(() => fail(new RetryableError(conn.peerConnection?.remoteDescription ? BLOCKED : NO_ANSWER)), 15000);
    peer.once("error", e =>
      fail(
        e.type === "peer-unavailable"
          ? new Error("No league found with that code. Check it with your host, and make sure their tab is open.")
          : new RetryableError(e.message),
      ),
    );
    // Fail fast when the browsers can't find any route to each other.
    const watchIce = () => {
      const pc = conn.peerConnection;
      if (!pc) return setTimeout(watchIce, 100);
      pc.addEventListener("iceconnectionstatechange", () => {
        if (pc.iceConnectionState === "failed") fail(new RetryableError(BLOCKED));
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

  return { peer, conn };
}
