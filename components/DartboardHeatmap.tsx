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

/** The bed between radii r0..r1 in wedge `i` (centred on NUMBER_ORDER[i]), as an SVG path. */
function bedPath(r0: number, r1: number, i: number): string {
  const [ax, ay] = pointAt(r1, i - 0.5);
  const [bx, by] = pointAt(r1, i + 0.5);
  const [cx, cy] = pointAt(r0, i + 0.5);
  const [dx, dy] = pointAt(r0, i - 0.5);
  return `M ${ax} ${ay} A ${r1} ${r1} 0 0 1 ${bx} ${by} L ${cx} ${cy} A ${r0} ${r0} 0 0 0 ${dx} ${dy} Z`;
}

/**
 * A real board's colours, slightly dimmed to sit in this UI: black and cream beds alternating
 * around the board, red and green on the doubles and triples of the same wedges (20 is a black
 * wedge with red rings), red inner bull, green outer. The wires are pewter. Dots on top carry
 * their own dark outline so they read on cream and black alike.
 */
const BOARD = {
  black: "#1a1d1a",
  cream: "#e6dcc3",
  red: "#b5392c",
  green: "#2f7c48",
  wire: "#8d918c",
  surround: "#111412",
} as const;

/** A single player's thrown-dart coordinates plotted over a dartboard outline — a quick, per-match spread visual, not a precision analysis tool. */
export function DartboardHeatmap({
  throws,
  compact = false,
  recentFrom,
}: {
  throws: [number, number][];
  /** Sized for the landscape side panel (~190px). The full number ring stays — all twenty, so a
   *  dot can be placed on its number without counting wedges from the cardinals — in a type
   *  size that just fits twenty labels around the rim. */
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
  // Twenty labels share a rim of ~1490 units, 74 each; at 19 units a two-digit label is ~21
  // wide, so they sit clear of one another and still read at the panel's size.
  const labelledIndices = NUMBER_ORDER.map((_, i) => i);
  const labelSize = compact ? 19 : 13;

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
      {/* The board itself: the black surround with the numbers, then every bed in its colour. */}
      <circle r={BOARD_RADIUS} fill={BOARD.surround} />
      {NUMBER_ORDER.map((n, i) => {
        // Even wedges (20, 18, 13, …) are the dark ones with red rings; odd wedges cream with green.
        const dark = i % 2 === 0;
        const single = dark ? BOARD.black : BOARD.cream;
        const ring = dark ? BOARD.red : BOARD.green;
        return (
          <g key={n}>
            <path d={bedPath(BULL_OUTER, TRIPLE_INNER, i)} fill={single} />
            <path d={bedPath(TRIPLE_INNER, TRIPLE_OUTER, i)} fill={ring} />
            <path d={bedPath(TRIPLE_OUTER, DOUBLE_INNER, i)} fill={single} />
            <path d={bedPath(DOUBLE_INNER, DOUBLE_OUTER, i)} fill={ring} />
          </g>
        );
      })}
      <circle r={BULL_OUTER} fill={BOARD.green} />
      <circle r={BULL_INNER} fill={BOARD.red} />
      {/* Wires on top of the beds. */}
      {[DOUBLE_OUTER, DOUBLE_INNER, TRIPLE_OUTER, TRIPLE_INNER, BULL_OUTER, BULL_INNER].map((r) => (
        <circle key={r} r={r} fill="none" stroke={BOARD.wire} strokeWidth={0.8} />
      ))}
      {NUMBER_ORDER.map((n, i) => {
        const [x1, y1] = pointAt(BULL_OUTER, i - 0.5);
        const [x2, y2] = pointAt(DOUBLE_OUTER, i - 0.5);
        const [lx, ly] = pointAt(BOARD_RADIUS + 12, i);
        return (
          <g key={n}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BOARD.wire} strokeWidth={0.8} />
            {labelledIndices.includes(i) && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={labelSize}
                fill="var(--color-cream)"
                opacity={0.85}
              >
                {n}
              </text>
            )}
          </g>
        );
      })}
      {/* Every dart gets a dark outline: a plain teal dot vanished on the cream beds, and a plain
          cream one on the cream beds too. */}
      {throws.map(([x, y], i) => {
        const isRecent = recentFrom !== undefined && i >= recentFrom;
        return (
          <circle
            key={i}
            cx={x}
            cy={-y}
            r={isRecent ? dotRadius * 1.25 : dotRadius}
            fill={isRecent ? "var(--color-cream)" : "var(--color-teal)"}
            opacity={isRecent ? 1 : 0.8}
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={isRecent ? 1.5 : 1}
          />
        );
      })}
    </svg>
  );
}
