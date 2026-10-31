import type { NextUp } from "@/lib/teamGame";
import { nextName } from "@/lib/teamGame";

/** On a card in a game with teams: who of the team throws now, and who throws next, which is the one up on the other side, not a teammate. */
export function WhoLine({ now, next, extra }: { now?: string; next: NextUp<{ name: string }> | null; extra?: string }) {
  const after = nextName(next);
  if (!now && !after) return null;
  return (
    <p className="cd-recent cd-recent--who">
      {now && (
        <span>
          Nå: {now}
          {extra}
        </span>
      )}
      {after && <span>Neste: {after}</span>}
    </p>
  );
}
