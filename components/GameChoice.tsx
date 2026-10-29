"use client";

import { CAREER_GAMES, type CareerGame } from "@/lib/careerGame";
import { SwitchRow } from "./ui/Switch";
import { FOCUS_RING } from "./ui/focus";

/**
 * The game a career is played in: Mikke Mus, 501 or 301, as three rows with one line each, and for 501 and 301 whether it takes a double to
 * finish. Used where a career starts and in its settings.
 */
export function GameChoice({ game, doubleOut, onChange }: { game: CareerGame; doubleOut: boolean; onChange: (next: { game: CareerGame; doubleOut: boolean }) => void }) {
  return (
    <div className="space-y-2">
      <div className="level-list" role="radiogroup" aria-label="Spill">
        {CAREER_GAMES.map((g) => (
          <button key={g.id} type="button" role="radio" aria-checked={game === g.id} onClick={() => onChange({ game: g.id, doubleOut })} className={`game-row tactile ${FOCUS_RING}`}>
            <span className="level-name">{g.name}</span>
            <span className="game-about">{g.about}</span>
          </button>
        ))}
      </div>
      {game !== "mm" && <SwitchRow label="Dobbel ut" hint="Står det 1 igjen, er runden over streken" checked={doubleOut} onChange={(on) => onChange({ game, doubleOut: on })} />}
    </div>
  );
}
