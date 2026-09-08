"use client";

import { DartboardHeatmap } from "./DartboardHeatmap";

/**
 * Fills the dead space in the landscape right-hand column — between the nav buttons at the top
 * and Angre/Bekreft at the bottom — with the two things worth glancing at mid-match: where the
 * darts are actually landing, and how the turn-by-turn numbers are tracking.
 *
 * Landscape only. Portrait has no such gap, and the same content there would push the board off
 * the screen, which is the problem the landscape layout exists to solve in the first place.
 *
 * Everything shown is for the player currently throwing, named at the top, so a bot's turn
 * plotting the bot's darts can't be mistaken for your own spread.
 */
export function LiveSidePanel({
  playerName,
  throws,
  recentFrom,
  hitPct,
  expected,
  actual,
}: {
  playerName: string;
  throws: [number, number][];
  recentFrom: number;
  /** Whole-percent treff share over completed turns, or null before the first one ends. */
  hitPct: number | null;
  /** Summed expected hits, or null when no dart this match had coordinates to judge. */
  expected: number | null;
  /** Crosses actually on the board, for the same "forventet / faktisk" reading the
   *  winner screen uses. */
  actual: number;
}) {
  return (
    <div className="live-panel flex flex-col min-h-0 gap-1.5">
      <div className="section-label truncate text-center">{playerName}</div>

      {throws.length > 0 ? (
        <div className="min-h-0 flex-1 flex items-center justify-center">
          <DartboardHeatmap throws={throws} compact recentFrom={recentFrom} />
        </div>
      ) : (
        // Manual scoring never produces coordinates, so an empty board is the normal state
        // off Scolia rather than something being broken — say so instead of showing a blank.
        <div className="min-h-0 flex-1 flex items-center justify-center text-center px-1" style={{ color: "var(--color-muted)", fontSize: "0.6rem", lineHeight: 1.3 }}>
          Treffbilde krever Scolia
        </div>
      )}

      <div className="grid grid-cols-2 gap-1">
        <Stat label="Treff" value={hitPct === null ? "–" : `${hitPct}%`} />
        <Stat label="xH" value={expected === null ? "–" : `${expected.toFixed(1)}/${actual}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md px-1 py-0.5 text-center"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}
    >
      <div className="section-label" style={{ fontSize: "0.5rem" }}>
        {label}
      </div>
      {/* Big and light against the tiny tracked label — the same contrast CardHeader's stat
          slot uses elsewhere, so a number reads as a number at a glance. */}
      <div style={{ fontSize: "0.8rem", fontWeight: 300, letterSpacing: "-0.01em", color: "var(--color-cream)" }}>
        {value}
      </div>
    </div>
  );
}
