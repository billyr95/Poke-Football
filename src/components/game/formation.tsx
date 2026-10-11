"use client";

import { SLOT_BY_ID } from "@/lib/game/ratings";
import { personnelLabel, teamSlots } from "@/lib/game/personnel";
import { ratingContext, slotRating } from "@/lib/game/schemes";
import { useGame } from "@/lib/game/store";
import type { Player, SlotId, Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { MonBadge, RatingChip } from "./bits";

/** Where each spot sits on the field, as % of width / height. Defense on top, offense below the line. */
const SPOTS: Record<SlotId, [number, number]> = {
  FS: [32, 7], SS: [68, 7], S3: [50, 11],
  CB1: [8, 22], DC: [21, 28], LB1: [29, 25], LB2: [50, 25], LB3: [71, 25], LB4: [61, 25], NB: [79, 28], CB2: [92, 22],
  DE1: [15, 40], DT1: [38, 40], NT: [50, 40], DT2: [62, 40], DE2: [85, 40],
  // The line is the tightest row: seven across, spread to the edges.
  WR1: [7, 58], LT: [22.5, 58], LG: [36, 58], C: [50, 58], RG: [64, 58], RT: [77.5, 58], TE: [93, 58],
  TE2: [9, 68], WR2: [18, 75], QB: [50, 74], WR3: [82, 75], WR4: [93, 64],
  FB: [50, 83], RB: [50, 92], RB2: [64, 88],
};

/** Spread the linebackers and linemen out when personnel changes how many there are. */
function spot(slot: SlotId, on: Set<SlotId>): [number, number] {
  if (on.has("LB4")) {
    const x = ({ LB1: 20, LB2: 40, LB4: 60, LB3: 80 } as Partial<Record<SlotId, number>>)[slot];
    if (x != null) return [x, 25];
  }
  if (!on.has("LB3") && on.has("LB1") && (slot === "LB1" || slot === "LB2")) return [slot === "LB1" ? 38 : 60, 25];
  // Three-man front spreads out; a Bear front puts the nose between a 3-tech and the ends.
  if (on.has("NT") && !on.has("DT1") && (slot === "DE1" || slot === "DE2")) return [slot === "DE1" ? 25 : 75, 40];
  if (on.has("NT") && on.has("DT1") && slot === "NT") return [60, 40];
  // Flexbone: fullback behind the QB, a slotback either side.
  if (on.has("RB2") && slot === "RB") return [36, 88];
  if (!on.has("FB") && slot === "RB") return [50, 90];
  return SPOTS[slot];
}

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
  const { league } = useGame();
  const ctx = ratingContext(league, team);
  const slots = teamSlots(league, team);
  const personnel = personnelLabel(league, team);
  const on = new Set(slots.map(s => s.id));
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
        {personnel && (
          <>
            <span className="absolute top-2 right-3 text-[11px] font-semibold text-white/70">{personnel.def}</span>
            <span className="absolute right-3 bottom-2 text-[11px] font-semibold text-white/70">{personnel.off}</span>
          </>
        )}
        {/* line of scrimmage */}
        <span className="absolute inset-x-0 h-1 bg-amber-400" style={{ top: "49.5%" }} />

        {slots.map(({ id: slot }) => {
          const [x, y] = spot(slot, on);
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
              title={p ? `${ctx.advanced ? s.role : s.label}: ${p.name}` : `${ctx.advanced ? s.role : s.label} (open)`}
            >
              {p ? (
                <>
                  <MonBadge player={p} size={size} className="transition-transform group-enabled:group-hover:scale-110" />
                  <RatingChip
                    value={slotRating(p, s, ctx)}
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
                  {ctx.advanced ? s.role : s.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
