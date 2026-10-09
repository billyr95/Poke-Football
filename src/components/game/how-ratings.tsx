"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MAX_CHEM, UNITS } from "@/lib/game/chemistry";
import { SLOT_WEIGHT } from "@/lib/game/draft";
import { ATTR_LIST, ATTR_SHARE, ATTRS, INPUT_NAMES, POS_LIST, POSITIONS, RARITY_LIFT } from "@/lib/game/ratings";

const pct = (w: number) => `${Math.round(Math.abs(w) * 100)}%`;

function recipe(from: Record<string, number | undefined>, names: Record<string, string>) {
  return Object.entries(from)
    .map(([k, w], i) => `${i === 0 ? "" : w! < 0 ? "minus " : "+ "}${pct(w!)} ${names[k]}`)
    .join(" ");
}

/** "How ratings work", written from the same constants the game uses so it can't drift. */
export function HowRatings() {
  const [open, setOpen] = useState(false);
  const attrNames = Object.fromEntries(ATTR_LIST.map(a => [a, ATTRS[a].name.toLowerCase()]));
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>How ratings work</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">How ratings work</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-5 text-sm leading-relaxed">
              <p>
                Nothing is hand-picked. Every number comes from PokeAPI data: base stats, height, weight and evolution stage.
                Ratings are scaled against the league&apos;s own draft pool, so <b>70 is the average Pokémon in your pool</b>.
                The floor is 40, and the scale tightens above 88, which keeps 99s rare.
              </p>

              <section>
                <h3 className="mb-1 font-heading text-lg">Attributes</h3>
                <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                  {ATTR_LIST.map(a => (
                    <li key={a}><b>{ATTRS[a].name}</b>: {recipe(ATTRS[a].from, INPUT_NAMES)}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">Weight and height are compared on a log scale, since Pokémon range from a few ounces to over a ton.</p>
              </section>

              <section>
                <h3 className="mb-1 font-heading text-lg">Positions</h3>
                <p className="mb-1">
                  Every Pokémon has a rating at all nine positions and can fill any open spot. A position rating is {pct(ATTR_SHARE)} the
                  attributes below and {pct(1 - ATTR_SHARE)} base stat total. Body size also matters: each position has an ideal
                  frame (linemen heavy, corners light), and a Pokémon far from it loses rating there.
                </p>
                <ul className="space-y-0.5">
                  {POS_LIST.map(p => (
                    <li key={p}><b>{POSITIONS[p].name}</b>: {recipe(POSITIONS[p].weights, attrNames)}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">
                  &quot;Natural&quot; position is where a Pokémon fits best. The pool is balanced so it splits roughly like a real lineup
                  (about five linemen for every quarterback).
                </p>
              </section>

              <section>
                <h3 className="mb-1 font-heading text-lg">Legendaries</h3>
                <p>
                  Legendary and mythical Pokémon get a lift of {RARITY_LIFT.legendary} standard deviations, and pseudo-legendaries
                  (600 base stat total, three-stage lines like Dragonite) get {RARITY_LIFT.pseudo}. The lift is applied before the
                  top of the scale tightens, so legends are the best at their spots but elite regulars stay close. Hosts can leave
                  legendaries out entirely.
                </p>
              </section>

              <section>
                <h3 className="mb-1 font-heading text-lg">Chemistry</h3>
                <ul className="list-disc space-y-0.5 pl-5">
                  <li>Stack a type inside a unit ({UNITS.map(u => u.label.toLowerCase()).join(", ")}): 3 players +2, 4 players +3, 5 players +4.</li>
                  <li>Receivers who share a type with the quarterback get +2, and the QB gets +1 for each, up to +3.</li>
                  <li>Two or more Pokémon from one evolution line get +2 each.</li>
                  <li>Bonuses add up to at most +{MAX_CHEM} per player. They show as a green ring on the rating.</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-heading text-lg">Team rating &amp; grades</h3>
                <p>
                  Spots are weighted by impact: QB ×{SLOT_WEIGHT.QB}; RB, WR, CB and DL ×{SLOT_WEIGHT.RB}; everyone else ×1.
                  Stars count extra, with each point above 85 worth 1.6. Draft grades compare your team with the league average.
                </p>
              </section>

              <section>
                <h3 className="mb-1 font-heading text-lg">Games</h3>
                <p>
                  Every snap is simulated. Runs pit the ball carrier and blockers against the front four and linebackers. Passes pit
                  the quarterback and the targeted receiver against their defender and the pass rush. Better units win more snaps,
                  but close games still swing on luck. Results are seeded, so everyone in the league sees the same games.
                </p>
              </section>

              <p className="text-xs text-muted-foreground">Data: PokeAPI (pokeapi.co).</p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
