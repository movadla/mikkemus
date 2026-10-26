"use client";

import { outIn } from "@/lib/knockout";
import { tournamentTitle, type Tournament } from "@/lib/tournament";
import { roundName } from "./KnockoutOverview";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * When the last of the house is out of the cup: where it ended, who it ended against, and the way on — watch the rest of the cup
 * play out (the matches are decided at once, then the champion is shown) or leave it.
 */
export function EliminatedScreen({
  tournament,
  names,
  onWatchRest,
  onLeave,
}: {
  tournament: Tournament;
  /** The house's own sides, all out. */
  names: string[];
  onWatchRest: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="animate-screen-enter screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <p className="section-label text-center mb-2">{tournamentTitle(tournament).toUpperCase()}</p>
        <h1 className="font-display text-center mb-6" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)" }}>
          {names.length === 1 ? "Ute" : "Alle er ute"}
        </h1>
        <div className="space-y-3 mb-6">
          {names.map((name) => {
            const lost = outIn(tournament, name);
            const beatBy = lost ? (lost.winner === lost.participantA ? lost.participantA : lost.participantB) : null;
            return (
              <div key={name} className="card" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                <p className="font-display" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                  {name}
                </p>
                <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>
                  {lost ? `Ute i ${roundName(lost).toLowerCase()} mot ${beatBy}` : "Ute"}
                </p>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <button type="button" onClick={onWatchRest} className={`glossy w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}>
            Se resten
          </button>
          <button type="button" onClick={onLeave} className={`tactile w-full rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
            Til forsiden
          </button>
        </div>
      </div>
    </div>
  );
}
