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
  | { t: "state"; league: League }
  | { t: "error"; message: string }
  | { t: "kicked"; message: string };

export type { LeagueSettings };

async function newPeer(id?: string): Promise<Peer> {
  const { Peer } = await import("peerjs");
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer();
    const onError = (e: { type?: string; message?: string }) => {
      peer.destroy();
      reject(
        new Error(
          e.type === "unavailable-id"
            ? "That league code is already being hosted in another tab."
            : `Couldn't reach the connection server (${e.type ?? e.message}).`,
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
      for (const c of conns.keys()) if (c.open) c.send({ t: "state", league } satisfies HostMessage);
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
    const timer = setTimeout(() => reject(new Error("No league found with that code. Check it with your host.")), 10000);
    peer.once("error", e => {
      clearTimeout(timer);
      reject(new Error(e.type === "peer-unavailable" ? "No league found with that code. Check it with your host." : e.message));
    });
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
