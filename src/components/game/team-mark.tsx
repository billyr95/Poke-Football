"use client";

import { useMemo } from "react";
import { teamAbbrevs } from "@/lib/game/league";
import { useGame } from "@/lib/game/store";
import type { Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/** Dark text on light team colours (gold, lime…), white on the rest. */
function textOn(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#18181b" : "#ffffff";
}

export function useTeamAbbrevs() {
  const { league } = useGame();
  const teams = league?.teams;
  return useMemo(() => teamAbbrevs(teams ?? []), [teams]);
}

/** A team's badge: its colour plus a scoreboard abbreviation, so teams are easy to tell apart. */
export function TeamMark({ team, size = "sm", className }: { team: Pick<Team, "id" | "name" | "color">; size?: "xs" | "sm" | "md"; className?: string }) {
  const abbr = useTeamAbbrevs().get(team.id) ?? "";
  return (
    <span
      title={team.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[5px] font-heading tracking-wide shadow-sm",
        size === "xs" && "h-4 min-w-7 px-1 text-[9px]",
        size === "sm" && "h-5 min-w-9 px-1 text-[11px]",
        size === "md" && "h-6 min-w-11 px-1.5 text-[13px]",
        className,
      )}
      style={{ background: team.color, color: textOn(team.color) }}
    >
      <span className="block leading-none [text-box:trim-both_cap_alphabetic]">{abbr}</span>
    </span>
  );
}
