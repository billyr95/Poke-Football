"use client";

import { Check, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COVERAGE_DBS, FRONT_SHAPE, OFF_PERSONNEL, PACKAGE_NAME, SCHEME_PERSONNEL, defPersonnel } from "@/lib/game/personnel";
import { ALL_SLOTS } from "@/lib/game/ratings";
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
                personnel={k => OFF_PERSONNEL[SCHEME_PERSONNEL[k as OffScheme]]}
                sheet={k => {
                  const per = OFF_PERSONNEL[SCHEME_PERSONNEL[k as OffScheme]];
                  return { personnel: `${per.label} (${per.detail.replaceAll(" · ", ", ")})`, field: OFFENSES[k as OffScheme].field ?? "" };
                }}
                pool={pool}
                side="off"
              />
              <SchemeGroup
                title="Defensive front"
                note="The front sets your defensive line. Fit here counts for your linemen, and half for your linebackers."
                options={FRONTS}
                value={scheme.front}
                disabled={locked}
                onChange={front => update({ front: front as Front })}
                personnel={k => {
                  const f = FRONT_SHAPE[k as Front];
                  return { label: f.label, detail: `${f.dl.length} DL · ${PACKAGE_NAME[f.db]} (${f.db} DB)` };
                }}
                sheet={k => defSheet({ ...scheme, front: k as Front })}
                pool={pool}
                side="front"
              />
              <SchemeGroup
                title="Coverage & pressure"
                note="Nickel and dime coverages bring extra defensive backs in place of linebackers. Fit here counts for your corners and safeties, and half for your linebackers."
                options={COVERAGES}
                value={scheme.cov}
                disabled={locked}
                onChange={cov => update({ cov: cov as Coverage })}
                personnel={k => ({ label: "Called from", detail: `${PACKAGE_NAME[COVERAGE_DBS[k as Coverage]]} (${COVERAGE_DBS[k as Coverage]} DB)` })}
                sheet={k => defSheet({ ...scheme, cov: k as Coverage })}
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
                <div className="rounded-md bg-muted/60 px-2 py-1.5 text-xs">
                  <div className="font-semibold">You&apos;ll draft</div>
                  <div>QB · {OFF_PERSONNEL[SCHEME_PERSONNEL[scheme.off]].detail} · 5 OL</div>
                  <div>{defSummary(scheme)}</div>
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

type Info = { label: string; blurb: string; pros: string; cons: string; formation?: string; alternate?: string };

function SchemeGroup({
  title, note, options, value, disabled, onChange, personnel, sheet, pool, side,
}: {
  title: string;
  note?: string;
  options: Record<string, Info>;
  /** Who this option puts on the field, if it changes personnel. */
  personnel?: (key: string) => { label: string; detail: string };
  /** The scheme guide's personnel sheet for an option: personnel grouping and who's on the field. */
  sheet?: (key: string) => { personnel: string; field: string };
  value: string;
  disabled: boolean;
  onChange: (key: string) => void;
  pool: Player[];
  side: "off" | "front" | "cov";
}) {
  const info = options[value];
  // Who in this draft pool fits the selected scheme best: fit first, then rating at their best spot on that side.
  const topFits = useMemo(() => {
    const slots = ALL_SLOTS.filter(s => (side === "off" ? s.side === "off" : side === "front" ? s.pos === "DL" || s.pos === "LB" : s.side === "def" && s.pos !== "DL"));
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
              {personnel && <div className="mt-1 text-[11px] font-semibold opacity-90">{personnel(key).detail}</div>}
            </button>
          ))}
        </div>
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <div className="font-semibold">{info.label}</div>
            <p><span className="text-emerald-700 dark:text-emerald-400">+</span> {info.pros}</p>
            <p><span className="text-red-600 dark:text-red-400">−</span> {info.cons}</p>
            {sheet && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-emerald-600/30 bg-emerald-600/5 px-2.5 py-2 text-xs">
                <dt className="font-semibold">Personnel</dt>
                <dd>{sheet(value).personnel}</dd>
                {info.formation && (
                  <>
                    <dt className="font-semibold">Base formation</dt>
                    <dd>{info.formation}</dd>
                  </>
                )}
                <dt className="font-semibold">On the field (11)</dt>
                <dd>{sheet(value).field}</dd>
                {info.alternate && (
                  <>
                    <dt className="font-semibold">Alternate</dt>
                    <dd>{info.alternate}</dd>
                  </>
                )}
              </dl>
            )}
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

/** "4 DL · 2 LB · 3 CB · 2 S (4–2–5 Nickel)" */
function defSummary(scheme: TeamScheme) {
  const d = defPersonnel(scheme.front, scheme.cov);
  const count = (pred: (id: string) => boolean) => d.slots.filter(pred).length;
  const dl = count(id => /^(DE|DT|NT)/.test(id));
  const lb = count(id => id.startsWith("LB"));
  const cb = count(id => ["CB1", "CB2", "NB", "DC"].includes(id));
  const s = count(id => ["FS", "SS", "S3"].includes(id));
  return `${dl} DL · ${lb} LB · ${cb} CB · ${s} S (${d.label})`;
}

/** Personnel sheet for a defense: package name, and exactly who lines up (front + coverage together). */
function defSheet(scheme: TeamScheme) {
  const d = defPersonnel(scheme.front, scheme.cov);
  const name: Record<string, string> = {
    DE1: "DE", DE2: "DE", DT1: "DT", DT2: "DT", NT: "NT", LB1: "OLB", LB3: "OLB", LB2: "MIKE", LB4: "ILB",
    CB1: "CB", CB2: "CB", NB: "Nickel CB", DC: "Dime CB", FS: "FS", SS: "SS", S3: "Spur/Rover",
  };
  const parts = new Map<string, number>();
  for (const id of d.slots) parts.set(name[id], (parts.get(name[id]) ?? 0) + 1);
  return {
    personnel: d.label,
    field: `${defSummary(scheme).split(" (")[0].replaceAll(" · ", ", ")} — ${[...parts].map(([n, c]) => (c > 1 ? `${c} ${n}` : n)).join(", ")}`,
  };
}
