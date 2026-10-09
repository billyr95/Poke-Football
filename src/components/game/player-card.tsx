"use client";

import type { ReactNode } from "react";
import { ATTR_LIST, ATTRS, POS_LIST, POSITIONS, RARITY_LABEL, heightFt, weightLb } from "@/lib/game/ratings";
import type { Player, Pos } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { AttrBar, MonBadge, RatingChip, TypePill, ratingText } from "./bits";

export function PlayerCard({
  player, bonus = 0, highlightPos, children,
}: {
  player: Player;
  bonus?: number;
  highlightPos?: Pos;
  /** Actions, e.g. draft buttons. */
  children?: ReactNode;
}) {
  const base = player.base;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
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

      <section>
        <h4 className="mb-2 text-sm font-semibold">Rating at each position</h4>
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
