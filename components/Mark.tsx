/**
 * `pendingCount` is how many of the trailing crosses (out of `count`) belong
 * to the turn in progress — not yet locked in by Confirm. Those stages draw
 * in `accent` instead of settled cream, so a turn's own marks read as
 * provisional right up until they're confirmed, and only until then: accent
 * means "not locked in yet" and nothing else.
 *
 * All three settled stages are cream, the closing circle included. It used to
 * be gold, from before a closed cell got its own gold surface (see
 * .cell-tile--done) — with the background carrying "finished", a gold ring on
 * top of it just muddies both.
 *
 * `ghostCount` previews strokes beyond `count` in a dashed, faded style —
 * used while a triple/double redirect choice is undecided, to show "this is
 * what completing it would look like" without committing to it.
 *
 * The glyph stays square in both orientations. Stretching it to use the width of a landscape
 * row was tried and looked wrong — a mark three times wider than tall reads as squashed, not
 * as bigger. What makes it legible sideways is the box being narrow enough that the mark fills
 * it (GameScreen caps the player columns in landscape), plus a slightly heavier stroke to hold
 * up at ~33px.
 */
const GEOMETRY = {
  normal: { cross: 7, ring: 6 },
  compact: { cross: 8, ring: 7 },
} as const;

const VIEW_BOX = "0 0 60 60";
const CENTRE = 30;
const RADIUS = 27;
const INSET = 6;

export function Mark({
  count,
  pendingCount = 0,
  ghostCount = 0,
  accent = "var(--color-teal)",
  slowMotion = false,
  perfect = false,
  compact = false,
}: {
  count: number;
  pendingCount?: number;
  ghostCount?: number;
  accent?: string;
  /** Landscape, where the mark is only ~33px — heavier strokes. See GEOMETRY above. */
  compact?: boolean;
  /** Closed by three separate darts inside one turn — drawn as a ring with a dot instead of
   *  the ordinary two crosses and a circle, so the hard way of closing a number is visible
   *  on the board for the rest of the match. A single triple closing it does not qualify:
   *  that is one dart, not three (see registerHit in MikkeMusApp). */
  perfect?: boolean;
  /** True for a brief window right after Angre — stretches the stroke transition below so
   *  whichever cross just got undone is unmistakable as it un-draws, instead of a global
   *  red flash (the previous way of signaling an undo happened). */
  slowMotion?: boolean;
}) {
  const confirmedCount = count - pendingCount;
  const previewedCount = count + ghostCount;
  const strokeMs = slowMotion ? 650 : 190;
  const g = compact ? GEOMETRY.compact : GEOMETRY.normal;
  const cx = CENTRE;
  const x1 = INSET;
  const x2 = 60 - INSET;
  const yTop = INSET;
  const yBottom = 60 - INSET;
  // Only once it's actually closed — mid-turn the crosses still draw one by one, so the
  // player watches the number fill the normal way and the ring is the reward at the end.
  const showPerfect = perfect && count >= 3;

  function ghostStrokeProps(threshold: number) {
    const isGhost = threshold > count && threshold <= previewedCount;
    return { stroke: accent, opacity: isGhost ? 0.45 : 0, strokeDasharray: "5 4" };
  }

  if (showPerfect) {
    return (
      <svg viewBox={VIEW_BOX} className="w-full h-full" aria-hidden>
        <ellipse
          cx={cx}
          cy={30}
          rx={RADIUS - 6}
          ry={RADIUS - 6}
          pathLength={1}
          fill="none"
          stroke="var(--color-cream)"
          strokeWidth={g.ring}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 0,
            transition: `stroke-dashoffset ${strokeMs}ms ease-out`,
          }}
        />
        <circle cx={cx} cy={30} r={7} fill="var(--color-cream)" />
      </svg>
    );
  }

  return (
    <svg viewBox={VIEW_BOX} className="w-full h-full" aria-hidden>
      <line
        x1={x1}
        y1={yBottom}
        x2={x2}
        y2={yTop}
        strokeWidth={g.cross}
        strokeLinecap="round"
        style={{ transition: "opacity 190ms ease-out", ...ghostStrokeProps(1) }}
      />
      <line
        x1={x1}
        y1={yTop}
        x2={x2}
        y2={yBottom}
        strokeWidth={g.cross}
        strokeLinecap="round"
        style={{ transition: "opacity 190ms ease-out", ...ghostStrokeProps(2) }}
      />
      <ellipse
        cx={cx}
        cy={30}
        rx={RADIUS}
        ry={RADIUS}
        fill="none"
        strokeWidth={g.ring}
        style={{ transition: "opacity 150ms ease-out", ...ghostStrokeProps(3) }}
      />
      <line
        x1={x1}
        y1={yBottom}
        x2={x2}
        y2={yTop}
        pathLength={1}
        stroke={confirmedCount >= 1 ? "var(--color-cream)" : accent}
        strokeWidth={g.cross}
        strokeLinecap="round"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: count >= 1 ? 0 : 1,
          opacity: count >= 1 ? 1 : 0,
          transition: `stroke-dashoffset ${strokeMs}ms ease-out, opacity ${strokeMs}ms ease-out`,
        }}
      />
      <line
        x1={x1}
        y1={yTop}
        x2={x2}
        y2={yBottom}
        pathLength={1}
        stroke={confirmedCount >= 2 ? "var(--color-cream)" : accent}
        strokeWidth={g.cross}
        strokeLinecap="round"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: count >= 2 ? 0 : 1,
          opacity: count >= 2 ? 1 : 0,
          transition: `stroke-dashoffset ${strokeMs}ms ease-out 65ms, opacity ${strokeMs}ms ease-out 65ms`,
        }}
      />
      <ellipse
        cx={cx}
        cy={30}
        rx={RADIUS}
        ry={RADIUS}
        pathLength={1}
        fill="none"
        stroke={confirmedCount >= 3 ? "var(--color-cream)" : accent}
        strokeWidth={g.ring}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: count >= 3 ? 0 : 1,
          opacity: count >= 3 ? 1 : 0,
          transition: `stroke-dashoffset ${strokeMs}ms ease-out 55ms, opacity ${strokeMs}ms ease-out 55ms`,
        }}
      />
    </svg>
  );
}
