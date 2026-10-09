"use client";

import { Check, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SLOTS } from "@/lib/game/ratings";
import {
  COVERAGES, DEFAULT_SCHEME, FRONTS, OFFENSES, SCHEME_SECONDS, schemeFit, slotRating,
  type Coverage, type Front, type OffScheme, type TeamScheme,
} from "@/lib/game/schemes";
import { useGame } from "@/lib/game/store";
import type { Player } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { FIT_TEXT, MonBadge, RatingChip } from "./bits";
import { TeamMark } from "./team-mark";

/** Advanced mode, before the draft: every manager picks an offense, a front and a coverage. */
export function SchemeSelect() {
  const { league, myTeamId, pool, clockOffset, setMyScheme } = useGame();
  const l = league!;
  const pickState = l.schemePick;
  const myTeam = l.teams.find(t => t.id === myTeamId) ?? null;
  const locked = myTeam != null && !!pickState?.locked.includes(myTeam.id);
  const [scheme, setScheme] = useState<TeamScheme>(() => (myTeam && l.schemes?.[myTeam.id]) || DEFAULT_SCHEME);

  const update = (patch: Partial<TeamScheme>) => {
    const next = { ...scheme, ...patch };
    setScheme(next);
    setMyScheme(next, false); // so whatever is picked when time runs out is what counts
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
        <h2 className="font-heading text-2xl">Pick your schemes</h2>
        {pickState && <Countdown deadline={pickState.deadline} offset={clockOffset} />}
        <span className="text-sm text-muted-foreground">
          Anyone who doesn&apos;t lock in plays whatever they have selected ({OFFENSES[DEFAULT_SCHEME.off].label}, {FRONTS[DEFAULT_SCHEME.front].label},{" "}
          {COVERAGES[DEFAULT_SCHEME.cov].label} by default).
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          {myTeam ? (
            <>
              <SchemeGroup
                title="Offense"
                options={OFFENSES}
                value={scheme.off}
                disabled={locked}
                onChange={off => update({ off: off as OffScheme })}
                pool={pool}
                side="off"
              />
              <SchemeGroup
                title="Defensive front"
                note="Fit here counts for your linemen, and half for your linebackers."
                options={FRONTS}
                value={scheme.front}
                disabled={locked}
                onChange={front => update({ front: front as Front })}
                pool={pool}
                side="front"
              />
              <SchemeGroup
                title="Coverage & pressure"
                note="Fit here counts for your corners and safeties, and half for your linebackers."
                options={COVERAGES}
                value={scheme.cov}
                disabled={locked}
                onChange={cov => update({ cov: cov as Coverage })}
                pool={pool}
                side="cov"
              />
            </>
          ) : (
            <p className="rounded-xl border p-6 text-center text-muted-foreground">The managers are picking their schemes. The draft starts right after.</p>
          )}
        </div>

        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          {myTeam && (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Offense:</span> <b>{OFFENSES[scheme.off].label}</b></div>
                  <div><span className="text-muted-foreground">Front:</span> <b>{FRONTS[scheme.front].label}</b></div>
                  <div><span className="text-muted-foreground">Coverage:</span> <b>{COVERAGES[scheme.cov].label}</b></div>
                </div>
                {locked ? (
                  <Button variant="outline" className="w-full" onClick={() => setMyScheme(scheme, false)}>
                    <Check /> Locked in · change
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={() => setMyScheme(scheme, true)}>
                    <Lock /> Lock in
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Teams</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {l.teams.map(t => {
                const done = pickState?.locked.includes(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <TeamMark team={t} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.managerId ? (
                      <Badge variant={done ? "default" : "outline"}>{done ? "Locked" : "Choosing…"}</Badge>
                    ) : (
                      <Badge variant="secondary">AI</Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Countdown({ deadline, offset }: { deadline: number; offset: number }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [offset]);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className="flex items-center gap-2" role="timer" aria-label={`${left} seconds left`}>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-300", left <= 10 ? "bg-red-500" : "bg-emerald-500")}
          style={{ width: `${(left / SCHEME_SECONDS) * 100}%` }}
        />
      </span>
      <span className={cn("font-heading text-xl tabular-nums", left <= 10 && "text-red-600 dark:text-red-400")}>0:{String(left).padStart(2, "0")}</span>
    </span>
  );
}

type Info = { label: string; blurb: string; pros: string; cons: string };

function SchemeGroup({
  title, note, options, value, disabled, onChange, pool, side,
}: {
  title: string;
  note?: string;
  options: Record<string, Info>;
  value: string;
  disabled: boolean;
  onChange: (key: string) => void;
  pool: Player[];
  side: "off" | "front" | "cov";
}) {
  const info = options[value];
  // Who in this draft pool fits the selected scheme best: fit first, then rating at their best spot on that side.
  const topFits = useMemo(() => {
    const slots = SLOTS.filter(s => (side === "off" ? s.side === "off" : side === "front" ? s.pos === "DL" || s.pos === "LB" : s.side === "def" && s.pos !== "DL"));
    const ctx = { advanced: true, scheme: null };
    return pool
      .map(p => ({ p, fit: schemeFit(p.id, value as OffScheme), r: Math.max(...slots.map(s => slotRating(p, s, ctx))) }))
      .sort((a, b) => b.fit - a.fit || b.r - a.r)
      .slice(0, 6);
  }, [pool, value, side]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Object.entries(options).map(([key, o]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={key === value}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                key === value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                disabled && key !== value && "opacity-50",
              )}
            >
              <div className="font-medium">{o.label}</div>
              <div className="line-clamp-2 text-xs opacity-75">{o.blurb}</div>
            </button>
          ))}
        </div>
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <div className="font-semibold">{info.label}</div>
            <p><span className="text-emerald-700 dark:text-emerald-400">+</span> {info.pros}</p>
            <p><span className="text-red-600 dark:text-red-400">−</span> {info.cons}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Best fits in this pool</div>
            <div className="flex flex-wrap gap-2">
              {topFits.map(({ p, fit, r }) => (
                <span key={p.id} className="flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1" title={`${p.name}: fit ${fit}/5`}>
                  <MonBadge player={p} size={22} />
                  <span className="max-w-20 truncate text-xs">{p.name}</span>
                  <b className={cn("text-xs", FIT_TEXT[fit])}>{fit}</b>
                  <RatingChip value={r} className="text-xs" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
