"use client";

import { LogOut, Wifi, WifiOff } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { GameProvider, useGame } from "@/lib/game/store";
import { DraftRoom } from "./draft-room";
import { Home } from "./home";
import { HowRatings } from "./how-ratings";
import { Lobby } from "./lobby";
import { Review } from "./review";
import { Season } from "./season";

function Header() {
  const { league, status, role, leave } = useGame();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <span className="font-heading text-2xl tracking-tight">
          Poke<span className="text-emerald-600">Football</span>
        </span>
        {league && (
          <span className="hidden items-center gap-2 rounded-md border px-2 py-0.5 text-xs sm:flex">
            <span className="text-muted-foreground">League</span>
            <span className="font-heading text-sm tracking-widest">{league.code}</span>
            {status === "connected" ? (
              <Wifi className="size-3.5 text-emerald-600" aria-label="Connected" />
            ) : (
              <WifiOff className="size-3.5 text-destructive" aria-label="Disconnected" />
            )}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <HowRatings />
          {league && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const msg = role === "host"
                  ? "Leave and close this league? Everyone in it will be disconnected."
                  : "Leave this league? You can rejoin with the same code and username.";
                if (confirm(msg)) leave();
              }}
            >
              <LogOut /> Leave
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Screen() {
  const { league, status, role, error, clearError, leave } = useGame();

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  if (status === "connecting" && !league) {
    return (
      <div className="space-y-3 py-24 text-center">
        <p className="text-muted-foreground">Connecting to the league…</p>
        <Button variant="ghost" size="sm" onClick={leave}>Cancel</Button>
      </div>
    );
  }
  if (status === "lost" && role === "guest") {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-24 text-center">
        <h2 className="font-heading text-3xl">Lost connection to the host</h2>
        <p className="text-muted-foreground">
          The host&apos;s tab may have closed, refreshed or gone to sleep. Try reconnecting once they&apos;re back, or head
          home to join or host a different league.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => location.reload()}>Reconnect</Button>
          <Button variant="outline" onClick={leave}>Back to home</Button>
        </div>
      </div>
    );
  }
  if (!league) return <Home />;
  switch (league.phase) {
    case "lobby":
      return <Lobby />;
    case "draft":
      return <DraftRoom />;
    case "review":
      return <Review />;
    default:
      return <Season />;
  }
}

export function App() {
  return (
    <GameProvider>
      <div className="flex min-h-svh flex-col">
        <Header />
        <main className="flex-1">
          <Screen />
        </main>
        <footer className="border-t py-3 text-center text-xs text-muted-foreground">
          Pokémon data from PokeAPI. Fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company.
        </footer>
      </div>
      <Toaster position="top-center" />
    </GameProvider>
  );
}
