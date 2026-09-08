"use client";

// Same layout and radii as lib/dartboard.ts, in the same units, so the bull this dives into
// sits exactly where a real bull would.
const NUMBER_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BOARD_RADIUS = 225;
const DOUBLE_OUTER = 170;
const DOUBLE_INNER = 162;
const TRIPLE_OUTER = 107;
const TRIPLE_INNER = 99;
const BULL_OUTER = 15.9;
const BULL_INNER = 6.35;

function spoke(index: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = ((index - 0.5) * 18 * Math.PI) / 180;
  return {
    x1: BULL_OUTER * Math.sin(a),
    y1: -BULL_OUTER * Math.cos(a),
    x2: BOARD_RADIUS * Math.sin(a),
    y2: -BOARD_RADIUS * Math.cos(a),
  };
}

/**
 * The beat between the winning dart and the winner screen.
 *
 * A board slams into the middle of the screen on the same frame as the boom, holds for a
 * breath, then the camera accelerates into the bullseye until the red fills everything and
 * the winner screen bursts out of it. The order matters: an impact, a held moment, and only
 * then the dive. A single smooth zoom start-to-finish reads as a page transition; the stop
 * in the middle is what makes it land as a hit.
 *
 * Ends by calling `onDone` off the animation itself rather than a timeout, so the handoff
 * can't drift out of sync with what is on screen — if the animation is slowed, skipped or
 * never runs, the callback follows it exactly.
 */
export function WinDive({ onDone }: { onDone: () => void }) {
  return (
    <div className="win-dive fixed inset-0 z-[60] overflow-hidden" style={{ background: "var(--color-bg)" }} aria-hidden>
      <div className="win-dive-camera absolute inset-0 flex items-center justify-center" onAnimationEnd={onDone}>
        <svg viewBox="-240 -240 480 480" className="w-full h-full" style={{ maxWidth: "min(92vw, 92vh)", maxHeight: "min(92vw, 92vh)" }}>
          <circle r={BOARD_RADIUS} fill="var(--color-panel)" stroke="var(--color-gold)" strokeWidth={3} />
          {[DOUBLE_OUTER, DOUBLE_INNER, TRIPLE_OUTER, TRIPLE_INNER].map((r) => (
            <circle key={r} r={r} fill="none" stroke="var(--color-border)" strokeWidth={2} />
          ))}
          {/* The two scoring rings picked out, so the board still reads as a board for the
              fraction of a second it is legible at full size. */}
          <circle
            r={(DOUBLE_OUTER + DOUBLE_INNER) / 2}
            fill="none"
            stroke="var(--color-red)"
            strokeWidth={DOUBLE_OUTER - DOUBLE_INNER}
            opacity={0.55}
          />
          <circle
            r={(TRIPLE_OUTER + TRIPLE_INNER) / 2}
            fill="none"
            stroke="var(--color-green)"
            strokeWidth={TRIPLE_OUTER - TRIPLE_INNER}
            opacity={0.55}
          />
          {NUMBER_ORDER.map((n, i) => {
            const s = spoke(i);
            return <line key={n} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="var(--color-border)" strokeWidth={1.5} />;
          })}
          <circle r={BULL_OUTER} fill="var(--color-green)" />
          {/* What the camera flies into. Everything above has scrolled past the edges long
              before the dive ends, leaving the screen solid on this. */}
          <circle r={BULL_INNER} fill="var(--color-red)" />
        </svg>
      </div>
    </div>
  );
}
