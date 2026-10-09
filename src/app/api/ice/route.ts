/**
 * ICE servers for player-to-player connections.
 *
 * STUN alone only works when both players' networks allow a direct link. A TURN relay
 * carries the traffic when they don't (mobile data, school/work Wi-Fi, strict routers).
 * TURN credentials stay on the server; configure ONE of these in Vercel → Settings → Environment Variables:
 *
 *   Cloudflare Realtime TURN:  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *   Metered TURN:              METERED_TURN_DOMAIN (e.g. yourapp.metered.live) + METERED_TURN_API_KEY
 *   Any TURN server:           ICE_SERVERS = JSON array of RTCIceServer objects
 */

import { connection } from "next/server";

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN: IceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

async function cloudflare(keyId: string, token: string): Promise<IceServer[]> {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: 86400 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cloudflare TURN returned ${res.status}`);
  const data = (await res.json()) as { iceServers: IceServer[] | IceServer };
  return Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
}

async function metered(domain: string, apiKey: string): Promise<IceServer[]> {
  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Metered TURN returned ${res.status}`);
  return (await res.json()) as IceServer[];
}

export async function GET() {
  await connection(); // per request: TURN credentials are short-lived, so never prerender this
  const env = process.env;
  let relay: IceServer[] = [];
  let source = "stun-only";
  try {
    if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) {
      relay = await cloudflare(env.CLOUDFLARE_TURN_KEY_ID, env.CLOUDFLARE_TURN_API_TOKEN);
      source = "cloudflare";
    } else if (env.METERED_TURN_DOMAIN && env.METERED_TURN_API_KEY) {
      relay = await metered(env.METERED_TURN_DOMAIN, env.METERED_TURN_API_KEY);
      source = "metered";
    } else if (env.ICE_SERVERS) {
      relay = JSON.parse(env.ICE_SERVERS) as IceServer[];
      source = "custom";
    }
  } catch (e) {
    console.error("TURN credentials unavailable, falling back to STUN only:", e);
  }
  return Response.json({ iceServers: [...STUN, ...relay], source }, { headers: { "Cache-Control": "no-store" } });
}
