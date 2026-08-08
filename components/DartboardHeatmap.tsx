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
export function DartboardHeatmap({ throws }: { throws: [number, number][] }) {
  const pad = 20;
  const size = (BOARD_RADIUS + pad) * 2;
  const half = BOARD_RADIUS + pad;

  return (
    <svg viewBox={`${-half} ${-half} ${size} ${size}`} className="w-full h-auto" role="img" aria-label="Kastspredning på dartboard">
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
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="var(--color-muted)">
              {n}
            </text>
          </g>
        );
      })}
      {throws.map(([x, y], i) => (
        <circle key={i} cx={x} cy={-y} r={5} fill="var(--color-teal)" opacity={0.35} />
      ))}
    </svg>
  );
}
