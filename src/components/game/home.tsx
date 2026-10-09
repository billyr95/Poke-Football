"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCode } from "@/lib/game/league";
import { useGame } from "@/lib/game/store";

export function Home() {
  const { me, host, join, status } = useGame();
  const [name, setName] = useState(me.name);
  const [code, setCode] = useState("");
  const busy = status === "connecting";
  const nameOk = name.trim().length >= 2;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-3 text-center">
        <h1 className="font-heading text-5xl tracking-tight sm:text-6xl">Draft. Play. Win the title.</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Draft Pokémon onto a football team with your friends: 11 on offense, 11 on defense. Then play a full season with
          standings, playoffs and a championship game. Ratings come from real base stats, height and weight.
        </p>
      </div>

      <div className="mx-auto max-w-sm space-y-1.5">
        <Label htmlFor="username">Your username</Label>
        <Input id="username" value={name} maxLength={20} placeholder="e.g. Ash" onChange={e => setName(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Host a league</CardTitle>
            <CardDescription>
              Pick the generations, invite friends with a code, and fill any empty seats with AI teams. Your browser runs the
              league, so keep this tab open while you play.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" size="lg" disabled={!nameOk || busy} onClick={() => host(name.trim())}>
              Create league
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Join a league</CardTitle>
            <CardDescription>Enter the 6-character code your host shared.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={code}
              placeholder="ABC123"
              className="text-center font-heading text-2xl tracking-[0.3em] uppercase"
              onChange={e => setCode(normalizeCode(e.target.value))}
              aria-label="League code"
            />
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              disabled={!nameOk || code.length !== 6 || busy}
              onClick={() => join(code, name.trim())}
            >
              {busy ? "Connecting…" : "Join league"}
            </Button>
          </CardContent>
        </Card>
      </div>
      {!nameOk && <p className="text-center text-sm text-muted-foreground">Pick a username (2+ letters) to host or join.</p>}
    </div>
  );
}
