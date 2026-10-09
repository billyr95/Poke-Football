"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Player } from "@/lib/game/types";
import { PlayerCard } from "./player-card";

export function PlayerDialog({ player, bonus = 0, onClose }: { player: Player | null; bonus?: number; onClose: () => void }) {
  return (
    <Dialog open={!!player} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">{player?.name}</DialogTitle>
        {player && <PlayerCard player={player} bonus={bonus} />}
      </DialogContent>
    </Dialog>
  );
}
