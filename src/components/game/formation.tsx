"use client";

import { SLOT_BY_ID } from "@/lib/game/ratings";
import type { Player, SlotId, Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge, RatingChip } from "./bits";

/** Where each spot sits on the field, as % of width / height. Defense on top, offense below the line. */
const SPOTS: Record<SlotId, [number, number]> = {
  FS: [32, 7], SS: [68, 7],
  CB1: [8, 22], LB1: [29, 25], LB2: [50, 25], LB3: [71, 25], CB2: [92, 22],
  DE1: [15, 40], DT1: [38, 40], DT2: [62, 40], DE2: [85, 40],
  // The line is the tightest row: seven across, spread to the edges.
  WR1: [7, 58], LT: [22.5, 58], LG: [36, 58], C: [50, 58], RG: [64, 58], RT: [77.5, 58], TE: [93, 58],
  WR2: [18, 75], QB: [50, 74], WR3: [82, 75],
  RB: [50, 90],
};

export function Formation({
  team, byId, chem, onSlot, highlight, compact = false,
}: {
  team: Team;
  byId: Map<number, Player>;
  chem?: Map<number, number>;
  onSlot?: (slot: SlotId, player: Player | undefined) => void;
  /** Slots to call out (e.g. where the selected player could go). */
  highlight?: Set<SlotId>;
  compact?: boolean;
}) {
  // Sized off the field's width (container query units), so seven linemen fit across on a phone.
  const size = compact ? "clamp(26px, 8.5cqw, 40px)" : "clamp(28px, 9cqw, 46px)";
  return (
    <div className="rounded-2xl border-4 border-emerald-900/80 bg-emerald-800 p-1 shadow-inner dark:border-emerald-950">
      <div
        className="relative w-full overflow-hidden rounded-xl border-2 border-white/70 [container-type:inline-size]"
        style={{
          aspectRatio: compact ? "4 / 5" : "4 / 5.2",
          background: "repeating-linear-gradient(180deg, #2f6b45 0 12.5%, #2a6140 12.5% 25%)",
        }}
      >
        <span className="absolute top-2 left-3 text-xs font-semibold tracking-wide text-white/70 uppercase">Defense</span>
        <span className="absolute bottom-2 left-3 text-xs font-semibold tracking-wide text-white/70 uppercase">Offense</span>
        {/* line of scrimmage */}
        <span className="absolute inset-x-0 h-1 bg-amber-400" style={{ top: "49.5%" }} />

        {(Object.entries(SPOTS) as [SlotId, [number, number]][]).map(([slot, [x, y]]) => {
          const id = team.roster[slot];
          const p = id != null ? byId.get(id) : undefined;
          const s = SLOT_BY_ID[slot];
          const hot = highlight?.has(slot);
          return (
            <button
              key={slot}
              type="button"
              disabled={!onSlot}
              onClick={() => onSlot?.(slot, p)}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 disabled:cursor-default"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={p ? `${s.label}: ${p.name}` : `${s.label} (open)`}
            >
              {p ? (
                <>
                  <MonBadge player={p} size={size} className="transition-transform group-enabled:group-hover:scale-110" />
                  <RatingChip
                    value={p.posOvr[s.pos]}
                    bonus={chem?.get(p.id) ?? 0}
                    className="text-[clamp(11px,3.6cqw,16px)]"
                  />
                </>
              ) : (
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 border-dashed font-heading text-white/80",
                    hot ? "border-amber-300 bg-amber-300/25 text-amber-100" : "border-white/50",
                  )}
                  style={{ width: size, height: size, fontSize: "clamp(10px, 3cqw, 13px)" }}
                >
                  {s.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
