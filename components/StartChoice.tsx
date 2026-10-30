"use client";

import { startedBy, type Startable } from "@/lib/startChoice";
import { Sheet } from "./ui/Sheet";
import { SideAvatar } from "./SideAvatar";
import { FOCUS_RING } from "./ui/focus";

/** «Hvem starter?»: the sides of a game that is about to begin, to pick who throws first (or leave it to chance). Closing keeps the order as it is. */
export function StartChoice<G extends Startable>({ game, setGame, photos, isBot }: { game: G; setGame: (g: G) => void; photos: Map<string, string | null | undefined>; isBot?: (name: string) => boolean }) {
  const team = !!game.rosters;
  return (
    <Sheet title={team ? "Hvilket lag starter?" : "Hvem starter?"} onClose={() => setGame(startedBy(game, game.players[0]))}>
      <ul className="space-y-2" aria-label="Hvem starter">
        {game.players.map((p) => (
          <li key={p}>
            <button type="button" onClick={() => setGame(startedBy(game, p))} className={`tactile flex items-center gap-3 w-full rounded-lg px-3 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-cell)", color: "var(--color-cream)", fontWeight: 700, fontSize: "var(--text-body)" }}>
              <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={36} bot={isBot?.(p)} />
              <span className="truncate">{p}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setGame(startedBy(game, game.players[Math.floor(Math.random() * game.players.length)]))} className={`tactile flex items-center justify-center w-full rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-teal)", fontWeight: 700, fontSize: "var(--text-body)", border: "1px solid var(--color-border)" }}>
            Tilfeldig
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
