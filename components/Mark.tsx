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
 */
/**
 * Landscape draws the same glyph on a 2.2:1 viewBox instead of a square one. An SVG scales to
 * fit its box, so on a phone turned sideways — where a row is ~34px tall but ~300-590px wide —
 * the square version could only ever render 34px across and looked like a speck. Same shapes,
 * same proportions, just given the row's width to use: the mark comes out about 75px wide, with
 * strokes thickened to match. The closing ring becomes an ellipse for the same reason; a circle
 * is capped by the height and would have stayed small while the crosses grew.
 */
const GEOMETRY = {
  narrow: { viewBox: "0 0 60 60", w: 60, cross: 7, ring: 6, inset: 6, rx: 27, ry: 27, dot: 7 },
  wide: { viewBox: "0 0 132 60", w: 132, cross: 9, ring: 8, inset: 9, rx: 60, ry: 26, dot: 9 },
} as const;

export function Mark({
  count,
  pendingCount = 0,
  ghostCount = 0,
  accent = "var(--color-teal)",
  slowMotion = false,
  perfect = false,
  wide = false,
}: {
  count: number;
  pendingCount?: number;
  ghostCount?: number;
  accent?: string;
  /** Draw the wide landscape variant — see GEOMETRY above. */
  wide?: boolean;
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
  const g = wide ? GEOMETRY.wide : GEOMETRY.narrow;
  const cx = g.w / 2;
  // The two diagonals, as an X spanning the whole box whatever its aspect.
  const x1 = g.inset;
  const x2 = g.w - g.inset;
  const yTop = 60 - 54;
  const yBottom = 54;
  // Only once it's actually closed — mid-turn the crosses still draw one by one, so the
  // player watches the number fill the normal way and the ring is the reward at the end.
  const showPerfect = perfect && count >= 3;

  function ghostStrokeProps(threshold: number) {
    const isGhost = threshold > count && threshold <= previewedCount;
    return { stroke: accent, opacity: isGhost ? 0.45 : 0, strokeDasharray: "5 4" };
  }

  if (showPerfect) {
    return (
      <svg viewBox={g.viewBox} className="w-full h-full" aria-hidden>
        <ellipse
          cx={cx}
          cy={30}
          rx={g.rx - 6}
          ry={g.ry - 6}
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
        <circle cx={cx} cy={30} r={g.dot} fill="var(--color-cream)" />
      </svg>
    );
  }

  return (
    <svg viewBox={g.viewBox} className="w-full h-full" aria-hidden>
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
        rx={g.rx}
        ry={g.ry}
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
        rx={g.rx}
        ry={g.ry}
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
