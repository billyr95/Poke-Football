"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** The commit this page's code was built from (set by Vercel at build time; missing in local dev). */
const BUILD = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
const CHECK_MS = 2 * 60 * 1000;

/**
 * The app is one long-lived page, so an open tab keeps running old code after a deploy.
 * When a newer version is live, ask everyone to refresh (leagues reconnect on reload).
 */
export function UpdateBanner() {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (!BUILD) return;
    let stopped = false;
    const check = async () => {
      try {
        const { sha } = (await (await fetch("/api/version", { cache: "no-store" })).json()) as { sha: string | null };
        if (!stopped && sha && sha !== BUILD) setOutdated(true);
      } catch {
        // offline; try again later
      }
    };
    check();
    const timer = setInterval(check, CHECK_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!outdated) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/60 bg-amber-300/90 px-4 py-2 text-sm text-zinc-950">
      <span>
        <b>A new version of PokeFootball is out.</b> Refresh to get it (your league reconnects). Hosts: refresh before starting a league.
      </span>
      <Button size="sm" variant="outline" className="border-zinc-900/30 bg-white/70 text-zinc-950 hover:bg-white" onClick={() => location.reload()}>
        <RefreshCw /> Refresh now
      </Button>
    </div>
  );
}
