"use client";

import { Check, Copy, Crown, Bot } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GENERATIONS, poolEntries } from "@/lib/game/dex";
import { MIN_TEAMS, maxTeamsFor } from "@/lib/game/league";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { TeamMark } from "./team-mark";

function Toggle({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
        on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
        disabled && !on && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

const PICK_TIMES: [number | null, string][] = [[null, "Off"], [30, "30s"], [60, "60s"], [90, "90s"], [120, "2 min"]];

function RenameForm({ current, onSave }: { current: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(current);
  return (
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); onSave(name); }}>
      <Input value={name} maxLength={28} onChange={e => setName(e.target.value)} aria-label="Team name" />
      <Button type="submit" variant="secondary" disabled={!name.trim() || name === current}>Save</Button>
    </form>
  );
}

export function Lobby() {
  const { league, me, isHost, setSettings, beginDraft, renameMyTeam, myTeamId } = useGame();
  const l = league!;
  const myTeam = l.teams.find(t => t.id === myTeamId);
  const [copied, setCopied] = useState(false);

  const s = l.settings;
  const poolSize = poolEntries(s).length;
  const maxTeams = maxTeamsFor(s);
  const aiSeats = Math.max(0, s.teamCount - l.teams.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(l.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Copy failed. The code is " + l.code);
    }
  };

  const toggleGen = (gen: number) => {
    const gens = s.gens.includes(gen) ? s.gens.filter(g => g !== gen) : [...s.gens, gen];
    const next = { ...s, gens };
    if (!gens.length) return toast("Keep at least one generation.");
    if (maxTeamsFor(next) < l.teams.length) return toast("That pool is too small for everyone who has joined.");
    setSettings({ gens });
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">League code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-heading text-5xl tracking-[0.2em]">{l.code}</span>
              <Button variant="outline" size="icon" onClick={copy} aria-label="Copy code">
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Friends open this site, choose a username, and enter this code.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Managers ({l.teams.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {l.teams.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <TeamMark team={t} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.manager}{t.managerId === me.clientId && " (you)"}</div>
                </div>
                {t.managerId === l.hostId && <Crown className="size-4 text-amber-500" aria-label="Host" />}
              </div>
            ))}
            {Array.from({ length: aiSeats }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
                <Bot className="size-4" />
                <span className="text-sm">Open seat. An AI team takes it if nobody joins.</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {myTeam && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Your team name</CardTitle>
            </CardHeader>
            <CardContent>
              <RenameForm key={myTeam.name} current={myTeam.name} onSave={renameMyTeam} />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">League settings</CardTitle>
          {!isHost && <p className="text-sm text-muted-foreground">Only the host can change these. Waiting for the host to start the draft…</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Generations</h3>
            <div className="grid grid-cols-3 gap-2">
              {GENERATIONS.map(g => (
                <Toggle key={g.gen} on={s.gens.includes(g.gen)} disabled={!isHost} onClick={() => toggleGen(g.gen)}>
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs opacity-75">{g.region} · {g.count}</div>
                </Toggle>
              ))}
            </div>
            {isHost && (
              <div className="flex gap-2 text-xs">
                <button type="button" className="underline" onClick={() => setSettings({ gens: [1] })}>Original 151 only</button>
                <button type="button" className="underline" onClick={() => setSettings({ gens: GENERATIONS.map(g => g.gen) })}>All generations</button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Legendary &amp; mythical Pokémon</h3>
            <div className="grid grid-cols-2 gap-2">
              <Toggle on={s.legendaries} disabled={!isHost} onClick={() => setSettings({ legendaries: true })}>Include</Toggle>
              <Toggle
                on={!s.legendaries}
                disabled={!isHost}
                onClick={() => {
                  if (maxTeamsFor({ ...s, legendaries: false }) < l.teams.length) return toast("That pool is too small for everyone who has joined.");
                  setSettings({ legendaries: false });
                }}
              >
                Leave out
              </Toggle>
            </div>
            <p className="text-xs text-muted-foreground">Pseudo-legendaries like Dragonite stay in either way.</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Teams</h3>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" disabled={!isHost || s.teamCount <= Math.max(MIN_TEAMS, l.teams.length)} onClick={() => setSettings({ teamCount: s.teamCount - 1 })}>−</Button>
              <span className="w-8 text-center font-heading text-3xl tabular-nums">{s.teamCount}</span>
              <Button variant="outline" size="icon" disabled={!isHost || s.teamCount >= maxTeams} onClick={() => setSettings({ teamCount: s.teamCount + 1 })}>+</Button>
              <span className="text-sm text-muted-foreground">
                {l.teams.length} {l.teams.length === 1 ? "manager" : "managers"} + {aiSeats} AI · up to {maxTeams} with {poolSize} Pokémon
              </span>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Draft order</h3>
            <div className="grid grid-cols-2 gap-2">
              <Toggle on={s.snake} disabled={!isHost} onClick={() => setSettings({ snake: true })}>
                <div className="font-medium">Snake</div>
                <div className="text-xs opacity-75">Order reverses each round</div>
              </Toggle>
              <Toggle on={!s.snake} disabled={!isHost} onClick={() => setSettings({ snake: false })}>
                <div className="font-medium">Straight</div>
                <div className="text-xs opacity-75">Same order every round</div>
              </Toggle>
              <Toggle on={s.randomOrder} disabled={!isHost} onClick={() => setSettings({ randomOrder: true })}>Random first round</Toggle>
              <Toggle on={!s.randomOrder} disabled={!isHost} onClick={() => setSettings({ randomOrder: false })}>Join order</Toggle>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Pick timer</h3>
            <div className="grid grid-cols-5 gap-2">
              {PICK_TIMES.map(([secs, label]) => (
                <Toggle key={label} on={s.pickSeconds === secs} disabled={!isHost} onClick={() => setSettings({ pickSeconds: secs })}>
                  <div className="text-center font-medium">{label}</div>
                </Toggle>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {s.pickSeconds
                ? "When time runs out, the best available player is drafted for that team automatically."
                : "No clock: everyone takes as long as they need."}
            </p>
          </section>

          {isHost && (
            <Button size="lg" className="w-full" onClick={beginDraft}>
              Start the draft · {s.teamCount} teams × 22 picks
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
