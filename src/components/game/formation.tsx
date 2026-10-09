"use client";

import { SLOT_BY_ID } from "@/lib/game/ratings";
import type { Player, SlotId, Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge, RatingChip } from "./bits";

/** Where each spot sits on the field, as % of width / height. Defense on top, offense below the line. */
const SPOTS: Record<SlotId, [number, number]> = {
  FS: [36, 8], SS: [64, 8],
  CB1: [8, 27], LB1: [30, 30], LB2: [50, 30], LB3: [70, 30], CB2: [92, 27],
  DE1: [20, 44], DT1: [40, 44], DT2: [60, 44], DE2: [80, 44],
  WR1: [7, 59], LT: [27, 59], LG: [38.5, 59], C: [50, 59], RG: [61.5, 59], RT: [73, 59], TE: [89, 59],
  WR2: [16, 74], QB: [50, 75], WR3: [86, 74],
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
  const size = compact ? 30 : 40;
  return (
    <div className="rounded-2xl border-4 border-emerald-900/80 bg-emerald-800 p-1 shadow-inner dark:border-emerald-950">
      <div
        className="relative w-full overflow-hidden rounded-xl border-2 border-white/70"
        style={{
          aspectRatio: compact ? "4 / 4.4" : "4 / 4.6",
          background: "repeating-linear-gradient(180deg, #2f6b45 0 12.5%, #2a6140 12.5% 25%)",
        }}
      >
        <span className="absolute top-2 left-3 text-xs font-semibold tracking-wide text-white/70 uppercase">Defense</span>
        <span className="absolute bottom-2 left-3 text-xs font-semibold tracking-wide text-white/70 uppercase">Offense</span>
        {/* line of scrimmage */}
        <span className="absolute inset-x-0 h-1 bg-amber-400" style={{ top: "51.5%" }} />

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
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 disabled:cursor-default"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={p ? `${s.label}: ${p.name}` : `${s.label} (open)`}
            >
              {p ? (
                <>
                  <MonBadge player={p} size={size} className="transition-transform group-enabled:group-hover:scale-110" />
                  <RatingChip value={p.posOvr[s.pos]} bonus={chem?.get(p.id) ?? 0} className={cn(compact && "min-w-7 text-sm")} />
                </>
              ) : (
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 border-dashed font-heading text-xs text-white/80",
                    hot ? "border-amber-300 bg-amber-300/25 text-amber-100" : "border-white/50",
                  )}
                  style={{ width: size + 4, height: size + 4 }}
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
