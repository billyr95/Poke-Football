"use client";

import { useEffect, useState } from "react";
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

export const FIT_TEXT = [
  "",
  "text-red-600 dark:text-red-400",
  "text-orange-600 dark:text-orange-400",
  "text-muted-foreground",
  "text-emerald-600 dark:text-emerald-400",
  "font-semibold text-emerald-600 dark:text-emerald-400",
];

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
      <span className="block leading-none [text-box:trim-both_cap_alphabetic]">
        {shown}
      </span>
    </span>
  );
}

const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const MAX_PIXEL_ICON_ID = 898;

function spriteUrl(p: Pick<Player, "id">) {
  return p.id <= MAX_PIXEL_ICON_ID
    ? `${SPRITE_BASE}/versions/generation-viii/icons/${p.id}.png`
    : `${SPRITE_BASE}/${p.id}.png`;
}

/**
 * The sprite sheets put small Pokémon in a big empty canvas (a Gen 8 icon is often 30% Pokémon, 70% air),
 * so trim each image to its visible pixels once, in the browser, and reuse it everywhere.
 */
const trimmed = new Map<string, Promise<string>>();

function trimSprite(src: string): Promise<string> {
  let job = trimmed.get(src);
  if (!job) {
    job = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0);
        const alpha = ctx.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (alpha[(y * w + x) * 4 + 3] > 8) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 < 0) return resolve(src);
        // Square crop around the Pokémon so every sprite scales the same way.
        const side = Math.max(x1 - x0, y1 - y0) + 3;
        const out = document.createElement("canvas");
        out.width = out.height = side;
        out.getContext("2d")!.drawImage(img, x0 - Math.floor((side - (x1 - x0)) / 2), y0 - Math.floor((side - (y1 - y0)) / 2), side, side, 0, 0, side, side);
        resolve(out.toDataURL());
      };
      img.onerror = () => reject(new Error(`sprite ${src}`));
      img.src = src;
    });
    trimmed.set(src, job);
  }
  return job;
}

function useTrimmedSprite(src: string) {
  const [state, setState] = useState<{ src: string; url: string | null; failed: boolean }>({ src, url: null, failed: false });
  useEffect(() => {
    let live = true;
    trimSprite(src).then(
      url => live && setState({ src, url, failed: false }),
      () => live && setState({ src, url: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [src]);
  return state.src === src ? state : { src, url: null, failed: false };
}

/**
 * A Pokémon's token: a pixel sprite on a circle of its type colours (or just the sprite, `bare`, on the field).
 * Falls back to the Dex number if the sprite can't load, and shows an L/P rarity badge.
 */
export function MonBadge({
  player,
  size = 40,
  bare = false,
  className,
}: {
  player: Pick<Player, "id" | "name" | "types" | "rarity">;
  size?: number | string;
  /** No type-colour circle: just the sprite (used on the field). */
  bare?: boolean;
  className?: string;
}) {
  const [a, b = a] = player.types.map((t) => TYPE_COLOR[t] ?? "#888");
  const sprite = useTrimmedSprite(spriteUrl(player));

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-heading",
        bare ? "text-white" : "rounded-full text-white shadow-sm ring-2 ring-white/70 dark:ring-black/40",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: bare ? undefined : `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`,
        fontSize: typeof size === "number" ? Math.max(10, size * 0.32) : `max(10px, calc(${size} * 0.32))`,
        textShadow: "0 1px 2px rgb(0 0 0 / 0.55)",
      }}
      aria-hidden
    >
      {sprite.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sprite.url}
          alt=""
          draggable={false}
          className={cn(
            "max-w-none object-contain [image-rendering:pixelated]",
            bare ? "size-full drop-shadow-[0_2px_1px_rgb(0_0_0/0.5)]" : "size-[78%] drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]",
          )}
        />
      ) : sprite.failed ? (
        <span className="block leading-none [text-box:trim-both_cap_alphabetic]">{player.id}</span>
      ) : null}

      {player.rarity && (
        <span
          className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1 text-[9px] leading-tight text-zinc-950"
          style={{ textShadow: "none" }}
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
      style={{ background: TYPE_COLOR[type] ?? "#888" }}
    >
      {type}
    </span>
  );
}

export function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>

      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground/80"
          style={{ width: `${((value - 40) / 59) * 100}%` }}
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