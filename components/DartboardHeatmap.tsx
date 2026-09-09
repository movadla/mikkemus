"use client";

// Same clockwise-from-top layout as lib/dartboard.ts, duplicated as plain
// numbers here (rather than imported) since this is pure presentation and
// doesn't need the angle/target math that file exists for.
const NUMBER_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BOARD_RADIUS = 225;
const DOUBLE_OUTER = 170;
const DOUBLE_INNER = 162;
const TRIPLE_OUTER = 107;
const TRIPLE_INNER = 99;
const BULL_OUTER = 15.9;
const BULL_INNER = 6.35;

function pointAt(radius: number, index: number): [number, number] {
  const angle = (index * 18 * Math.PI) / 180;
  return [radius * Math.sin(angle), -radius * Math.cos(angle)]; // SVG y grows downward, board "up" is negative y
}

/** A single player's thrown-dart coordinates plotted over a dartboard outline — a quick, per-match spread visual, not a precision analysis tool. */
export function DartboardHeatmap({
  throws,
  compact = false,
  recentFrom,
}: {
  throws: [number, number][];
  /** Sized for the landscape side panel (~150px). Most of the number ring is dropped there —
   *  at that size the labels render around 4px — but the four cardinals stay, because without
   *  any of them the plot has no orientation at all and a dot can't be placed on a number. */
  compact?: boolean;
  /** Index from which throws belong to the turn in progress — those are drawn bright, the
   *  rest of the match recedes. Without it every dart looks equally current. */
  recentFrom?: number;
}) {
  // Compact keeps room for its four big cardinal labels — at 14 the "11" on the left and the
  // "6" on the right were sliced by the viewBox edge and read as "1" and a fragment.
  const pad = compact ? 34 : 20;
  const size = (BOARD_RADIUS + pad) * 2;
  const half = BOARD_RADIUS + pad;
  // The triple band is 8 units wide and the double 8 — a dot has to be able to sit INSIDE one
  // for the plot to say anything about which ring was hit. The compact dot was 9 (18 across,
  // 25 for a highlighted one), which spanned three bands at once and made a double look like
  // a triple. Sized to the bands instead, and legibility comes from colour, not bulk.
  const dotRadius = compact ? 4.5 : 5;
  // Only the cardinals: 20 up, 6 right, 3 down, 11 left.
  const labelledIndices = compact ? [0, 5, 10, 15] : NUMBER_ORDER.map((_, i) => i);

  return (
    // Compact fills the box it is given in BOTH directions and lets preserveAspectRatio keep it
    // square: sized off the width alone (h-auto) it came out taller than the side panel's
    // slot and spilled under the thrower's photo above it.
    <svg
      viewBox={`${-half} ${-half} ${size} ${size}`}
      className={compact ? "block w-full h-full" : "w-full h-auto"}
      role="img"
      aria-label="Kastspredning på dartboard"
    >
      <circle r={BOARD_RADIUS} fill="var(--color-panel)" stroke="var(--color-border)" strokeWidth={1} />
      {[DOUBLE_OUTER, DOUBLE_INNER, TRIPLE_OUTER, TRIPLE_INNER, BULL_OUTER, BULL_INNER].map((r) => (
        <circle key={r} r={r} fill="none" stroke="var(--color-border)" strokeWidth={0.75} />
      ))}
      {NUMBER_ORDER.map((n, i) => {
        const [x1, y1] = pointAt(BULL_OUTER, i - 0.5);
        const [x2, y2] = pointAt(BOARD_RADIUS, i - 0.5);
        const [lx, ly] = pointAt(BOARD_RADIUS + 12, i);
        return (
          <g key={n}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-border)" strokeWidth={0.75} />
            {labelledIndices.includes(i) && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={compact ? 22 : 13}
                fill="var(--color-muted)"
              >
                {n}
              </text>
            )}
          </g>
        );
      })}
      {throws.map(([x, y], i) => {
        const isRecent = recentFrom !== undefined && i >= recentFrom;
        return (
          <circle
            key={i}
            cx={x}
            cy={-y}
            r={isRecent ? dotRadius * 1.25 : dotRadius}
            fill={isRecent ? "var(--color-cream)" : "var(--color-teal)"}
            opacity={isRecent ? 1 : 0.35}
            stroke={isRecent ? "rgba(0,0,0,0.55)" : "none"}
            strokeWidth={isRecent ? 1.5 : 0}
          />
        );
      })}
    </svg>
  );
}
