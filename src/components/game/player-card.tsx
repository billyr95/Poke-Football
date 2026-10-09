"use client";

import type { ReactNode } from "react";
import { ATTR_LIST, ATTRS, POS_LIST, POSITIONS, RARITY_LABEL, ROLE_LIST, ROLES, SLOTS, heightFt, weightLb } from "@/lib/game/ratings";
import { COVERAGES, FRONTS, OFFENSES, isAdvanced, ratingContext, schemeFit, scouting, slotRating } from "@/lib/game/schemes";
import { useGame } from "@/lib/game/store";
import type { Player, Pos, Role } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { AttrBar, FIT_TEXT, MonBadge, RatingChip, TypePill, ratingText } from "./bits";

export function PlayerCard({
  player, bonus = 0, highlightPos, highlightRole, children,
}: {
  player: Player;
  bonus?: number;
  highlightPos?: Pos;
  highlightRole?: Role;
  /** Actions, e.g. draft buttons. */
  children?: ReactNode;
}) {
  const base = player.base;
  const { league, myTeamId } = useGame();
  const advanced = isAdvanced(league?.settings);
  const myTeam = league?.teams.find(t => t.id === myTeamId);
  const ctx = ratingContext(league, myTeam);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 pr-12">
        <MonBadge player={player} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-heading text-2xl leading-tight">{player.name}</h3>
            <span className="text-xs text-muted-foreground">#{player.id}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {player.types.map(t => <TypePill key={t} type={t} />)}
            {player.rarity && (
              <span className="rounded bg-amber-400 px-1.5 py-px text-[10px] font-semibold tracking-wide text-zinc-950 uppercase">
                {RARITY_LABEL[player.rarity]}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {heightFt(player.heightM)} · {weightLb(player.weightKg)} lb · Gen {player.gen} · stage {player.stage}
          </p>
        </div>
        <div className="text-center">
          <RatingChip value={player.ovr} bonus={bonus} className="px-2 py-1 text-2xl" />
          <div className="mt-1 text-[10px] font-semibold text-muted-foreground uppercase">{player.pos}</div>
        </div>
      </div>

      {children}

      <section>
        <h4 className="mb-2 text-sm font-semibold">Natural {POSITIONS[player.pos].name.toLowerCase()}</h4>
        <div className="space-y-1.5">
          {ATTR_LIST.map(a => <AttrBar key={a} label={ATTRS[a].name} value={player.attrs[a]} />)}
        </div>
        {player.rarityBonus > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Includes +{player.rarityBonus} for {RARITY_LABEL[player.rarity!].toLowerCase()} status.</p>
        )}
      </section>

      {advanced && <AdvancedSections player={player} ctx={ctx} highlightRole={highlightRole} />}

      <section>
        <h4 className="mb-2 text-sm font-semibold">Rating at each position{advanced && " (standard)"}</h4>
        <div className="grid grid-cols-9 gap-1 text-center">
          {POS_LIST.map(pos => (
            <div
              key={pos}
              className={cn(
                "rounded-md border py-1",
                pos === player.pos && "border-foreground/40 bg-muted",
                pos === highlightPos && "border-amber-400 bg-amber-400/15",
              )}
            >
              <div className="text-[10px] font-semibold text-muted-foreground">{pos}</div>
              <div className={cn("font-heading text-lg leading-tight tabular-nums", ratingText(player.posOvr[pos]))}>{player.posOvr[pos]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="text-xs text-muted-foreground">
        Base stats: HP {base.hp} · Atk {base.atk} · Def {base.def} · SpA {base.spa} · SpD {base.spd} · Spe {base.spe}
      </section>
    </div>
  );
}


/** Advanced mode: granular role ratings (with my schemes' fit) and the scheme scouting report. */
function AdvancedSections({ player, ctx, highlightRole }: { player: Player; ctx: ReturnType<typeof ratingContext>; highlightRole?: Role }) {
  const scout = scouting(player.id);
  const slotFor = (r: Role) => SLOTS.find(s => s.role === r)!;
  return (
    <>
      <section>
        <h4 className="mb-2 text-sm font-semibold">Rating at each role{ctx.scheme && " (with your schemes)"}</h4>
        <div className="grid grid-cols-8 gap-1 text-center">
          {ROLE_LIST.map(role => {
            const r = slotRating(player, slotFor(role), ctx);
            return (
              <div
                key={role}
                title={ROLES[role].name}
                className={cn("rounded-md border py-1", role === highlightRole && "border-amber-400 bg-amber-400/15")}
              >
                <div className="text-[10px] font-semibold text-muted-foreground">{role}</div>
                <div className={cn("font-heading text-lg leading-tight tabular-nums", ratingText(r))}>{r}</div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-1 text-sm">
        <h4 className="text-sm font-semibold">Scheme scouting</h4>
        <p className="text-xs text-muted-foreground">{scout.archetype} · ideal at {scout.ideal}</p>
        {ctx.scheme && (
          <p className="text-xs">
            Fit with your schemes:{" "}
            {([
              [OFFENSES[ctx.scheme.off].label, schemeFit(player.id, ctx.scheme.off)],
              [FRONTS[ctx.scheme.front].label, schemeFit(player.id, ctx.scheme.front)],
              [COVERAGES[ctx.scheme.cov].label, schemeFit(player.id, ctx.scheme.cov)],
            ] as const).map(([label, fit], i) => (
              <span key={label}>
                {i > 0 && " · "}
                {label} <b className={FIT_TEXT[fit]}>{fit}/5</b>
              </span>
            ))}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Best fits: {scout.bestOff.map(k => OFFENSES[k].label).join(", ")} · {scout.bestFront.map(k => FRONTS[k as keyof typeof FRONTS].label).join(", ")} ·{" "}
          {scout.bestCov.map(k => COVERAGES[k as keyof typeof COVERAGES].label).join(", ")}
        </p>
      </section>
    </>
  );
}
