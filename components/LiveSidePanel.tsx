"use client";

import { useRoster } from "@/lib/storage";
import { DartboardHeatmap } from "./DartboardHeatmap";

/**
 * Fills the dead space in the landscape right-hand column — between the nav buttons at the top
 * and Angre/Bekreft at the bottom — with what is worth glancing at mid-match: whose turn it is,
 * where the darts are landing, and how the numbers are tracking.
 *
 * Landscape only. Portrait has no such gap, and the same content there would push the board off
 * the screen, which is the problem the landscape layout exists to solve in the first place.
 *
 * Whose turn it is shows as the player's photo rather than their name: the name is already
 * highlighted on its column in the board itself, so repeating it here spends the panel's
 * scarcest resource — height — on something already answered.
 */
export function LiveSidePanel({
  playerName,
  throws,
  recentFrom,
  darts,
  hitPct,
  expected,
  actual,
}: {
  playerName: string;
  throws: [number, number][];
  recentFrom: number;
  /** Darts thrown this match, including the turn in progress. */
  darts: number;
  /** Whole-percent treff share over completed turns, or null before the first one ends. */
  hitPct: number | null;
  /** Summed expected hits, or null when no dart this match had coordinates to judge. */
  expected: number | null;
  /** Crosses actually on the board, for the same "forventet / faktisk" reading the
   *  winner screen uses. */
  actual: number;
}) {
  // The reactive read rather than getPlayerRecord: a photo saved mid-match should appear
  // without waiting for whatever else happens to re-render this.
  const roster = useRoster();
  const photo = roster.find((r) => r.name.trim().toLowerCase() === playerName.trim().toLowerCase())?.photo;

  return (
    <div className="live-panel flex flex-col h-full min-h-0 items-center gap-1.5">
      <div
        className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
        style={{
          width: "2.1rem",
          height: "2.1rem",
          border: "2px solid var(--color-teal)",
          background: "var(--color-surface)",
        }}
        title={playerName}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={playerName} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display" style={{ color: "var(--color-teal)", fontSize: "1rem" }}>
            {playerName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {throws.length > 0 ? (
        <div className="min-h-0 flex-1 w-full flex items-center justify-center">
          <DartboardHeatmap throws={throws} compact recentFrom={recentFrom} />
        </div>
      ) : (
        // Manual scoring never produces coordinates, so an empty board is the normal state
        // off Scolia rather than something being broken — say so instead of showing a blank.
        <div
          className="min-h-0 flex-1 flex items-center justify-center text-center px-1"
          style={{ color: "var(--color-muted)", fontSize: "0.6rem", lineHeight: 1.3 }}
        >
          Treffbilde krever Scolia
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 w-full">
        <Stat label="Piler" value={String(darts)} />
        <Stat label="Treff" value={hitPct === null ? "–" : `${hitPct}%`} />
        <Stat label="xH" value={expected === null ? "–" : `${expected.toFixed(1)}/${actual}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md px-0.5 py-0.5 text-center overflow-hidden"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}
    >
      <div className="section-label" style={{ fontSize: "0.48rem" }}>
        {label}
      </div>
      {/* Big and light against the tiny tracked label — the same contrast CardHeader's stat
          slot uses elsewhere, so a number reads as a number at a glance. */}
      <div
        className="truncate"
        style={{ fontSize: "0.72rem", fontWeight: 300, letterSpacing: "-0.02em", color: "var(--color-cream)" }}
      >
        {value}
      </div>
    </div>
  );
}
