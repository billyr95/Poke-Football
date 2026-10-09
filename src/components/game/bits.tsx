"use client";

import { useState } from "react";
import { tier } from "@/lib/game/ratings";
import type { Player } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export const TYPE_COLOR: Record<string, string> = {
  normal: "#a8a77a",
  fire: "#ee8130",
  water: "#6390f0",
  electric: "#e5c22b",
  grass: "#7ac74c",
  ice: "#7fd3cf",
  fighting: "#c22e28",
  poison: "#a33ea1",
  ground: "#d6b55a",
  flying: "#a98ff3",
  psychic: "#f95587",
  bug: "#a6b91a",
  rock: "#b6a136",
  ghost: "#735797",
  dragon: "#6f35fc",
  dark: "#705746",
  steel: "#9aa3b5",
  fairy: "#d685ad",
};

const TIER_TEXT = {
  elite: "text-emerald-600 dark:text-emerald-400",
  good: "text-lime-600 dark:text-lime-400",
  avg: "text-amber-600 dark:text-amber-400",
  low: "text-orange-700 dark:text-orange-400",
};

const TIER_CHIP = {
  elite: "bg-amber-400 text-zinc-950",
  good: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  avg: "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900",
  low: "bg-zinc-500 text-white dark:bg-zinc-500",
};

export const ratingText = (r: number) => TIER_TEXT[tier(r)];

/** Text colour for a 1–5 scheme fit. */
export const FIT_TEXT = [
  "", "text-red-600 dark:text-red-400", "text-orange-600 dark:text-orange-400", "text-muted-foreground",
  "text-emerald-600 dark:text-emerald-400", "font-semibold text-emerald-600 dark:text-emerald-400",
];

/** Big-number rating chip, gold for 90+. */
export function RatingChip({
  value,
  bonus = 0,
  className,
}: {
  value: number;
  bonus?: number;
  className?: string;
}) {
  const shown = Math.min(99, value + bonus);

  return (
    <span
      className={cn(
        "inline-flex h-[1.6em] min-w-[2.3em] items-center justify-center rounded-md px-[0.4em] font-heading text-base leading-none tabular-nums",
        TIER_CHIP[tier(shown)],
        bonus > 0 && "ring-2 ring-emerald-400",
        className,
      )}
      title={bonus > 0 ? `${value} + ${bonus} chemistry` : undefined}
    >
      <span className="block leading-none [text-box:trim-both_cap_alphabetic]">{shown}</span>
    </span>
  );
}

/**
 * PokeAPI official artwork.
 *
 * `player.id` should be the Pokémon's National Dex number.
 *
 * Example:
 *   1  -> Bulbasaur
 *   25 -> Pikachu
 *   149 -> Dragonite
 */
function spriteUrl(p: Pick<Player, "id">) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`;
}

/**
 * A Pokémon's token:
 * - Background uses the Pokémon's type colors
 * - Official PokeAPI artwork sits on top
 * - Falls back to the Dex number if the sprite fails
 * - Shows L/P rarity badge when applicable
 */
export function MonBadge({
  player,
  size = 40,
  className,
}: {
  player: Pick<Player, "id" | "name" | "types" | "rarity">;
  /** Pixels, or any CSS length (e.g. a clamp() that scales with the field). */
  size?: number | string;
  className?: string;
}) {
  const [a, b = a] = player.types.map(
    (t) => TYPE_COLOR[t] ?? "#888",
  );

  const src = spriteUrl(player);

  const [failed, setFailed] = useState<string | null>(null);

  const showImage = failed !== src;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-heading text-white shadow-sm ring-2 ring-white/70 dark:ring-black/40",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`,
        fontSize: typeof size === "number" ? Math.max(10, size * 0.32) : `max(10px, calc(${size} * 0.32))`,
        textShadow: "0 1px 2px rgb(0 0 0 / 0.55)",
      }}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(src)}
          className="size-[115%] max-w-none object-contain drop-shadow-[0_2px_2px_rgb(0_0_0/0.35)]"
        />
      ) : (
        <span className="block leading-none [text-box:trim-both_cap_alphabetic]">{player.id}</span>
      )}

      {player.rarity && (
        <span
          className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1 text-[9px] leading-tight text-zinc-950"
          style={{
            textShadow: "none",
          }}
        >
          {player.rarity === "pseudo" ? "P" : "L"}
        </span>
      )}
    </span>
  );
}

export function TypePill({ type }: { type: string }) {
  return (
    <span
      className="rounded px-1.5 py-px text-[10px] font-semibold tracking-wide text-white uppercase"
      style={{
        background: TYPE_COLOR[type] ?? "#888",
      }}
    >
      {type}
    </span>
  );
}

export function AttrBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">
        {label}
      </span>

      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground/80"
          style={{
            width: `${((value - 40) / 59) * 100}%`,
          }}
        />
      </span>

      <span
        className={cn(
          "w-7 text-right font-heading text-lg leading-none tabular-nums",
          ratingText(value),
        )}
      >
        {value}
      </span>
    </div>
  );
}