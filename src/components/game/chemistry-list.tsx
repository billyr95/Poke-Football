import type { Chemistry } from "@/lib/game/chemistry";
import type { Player } from "@/lib/game/types";

export function ChemistryList({ chem, byId }: { chem: Chemistry; byId: Map<number, Player> }) {
  if (!chem.links.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No chemistry yet. Stack a type inside a unit, give your QB receivers who share a type, or draft an evolution line.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">Chemistry</h4>
      <ul className="space-y-1 text-xs">
        {chem.links.map((link, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="rounded bg-emerald-600 px-1.5 py-px font-semibold text-white">+{link.bonus}</span>
            <span>
              <b>{link.label}</b>{" "}
              <span className="text-muted-foreground">{link.members.map(id => byId.get(id)?.name).join(", ")}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
