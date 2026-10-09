"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chemistry } from "@/lib/game/chemistry";
import { grade, teamRatings } from "@/lib/game/draft";
import { useGame } from "@/lib/game/store";
import type { Player } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { ChemistryList } from "./chemistry-list";
import { Formation } from "./formation";
import { PlayerDialog } from "./player-dialog";
import { TeamMark } from "./team-mark";

export function useTeamTable() {
  const { league, byId } = useGame();
  return useMemo(() => {
    const rows = league!.teams.map(t => ({ team: t, r: teamRatings(t, byId, league!.settings) }));
    const avg = rows.reduce((a, x) => a + x.r.ovr, 0) / rows.length;
    return rows
      .map(x => ({ ...x, grade: grade(x.r.ovr, avg) }))
      .sort((a, b) => b.r.ovr - a.r.ovr);
  }, [league, byId]);
}

export function Review() {
  const { league, byId, isHost, beginSeason, myTeamId } = useGame();
  const rows = useTeamTable();
  const [viewId, setViewId] = useState<number>(myTeamId ?? rows[0].team.id);
  const [open, setOpen] = useState<Player | null>(null);
  const view = league!.teams.find(t => t.id === viewId)!;
  const chem = useMemo(() => chemistry(view, byId, league!.settings), [view, byId, league]);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div>
          <h1 className="font-heading text-4xl">Draft complete</h1>
          <p className="text-muted-foreground">Grades compare each team with the league average.</p>
        </div>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {rows.map(({ team, r, grade }, i) => (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => setViewId(team.id)}
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60", viewId === team.id && "bg-muted")}
                  >
                    <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
                    <TeamMark team={team} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{team.name}{team.id === myTeamId && " (you)"}</span>
                      <span className="text-xs text-muted-foreground">{team.manager ?? "AI"} · OFF {r.off} · DEF {r.def}</span>
                    </span>
                    <span className="font-heading text-3xl">{grade}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        {isHost ? (
          <Button size="lg" className="w-full" onClick={beginSeason}>Start the season</Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Waiting for the host to start the season…</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{view.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Formation team={view} byId={byId} chem={chem.bonus} onSlot={(_, p) => p && setOpen(p)} />
          <ChemistryList chem={chem} byId={byId} />
        </CardContent>
      </Card>
      <PlayerDialog player={open} onClose={() => setOpen(null)} bonus={open ? chem.bonus.get(open.id) : 0} />
    </div>
  );
}
