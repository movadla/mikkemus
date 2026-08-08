/**
 * `pendingCount` is how many of the trailing crosses (out of `count`) belong
 * to the turn in progress — not yet locked in by Confirm. Those stages draw
 * in `accent` instead of the settled cream/gold, so a turn's own marks read
 * as provisional right up until they're confirmed.
 *
 * `ghostCount` previews strokes beyond `count` in a dashed, faded style —
 * used while a triple/double redirect choice is undecided, to show "this is
 * what completing it would look like" without committing to it.
 */
export function Mark({
  count,
  pendingCount = 0,
  ghostCount = 0,
  accent = "var(--color-teal)",
}: {
  count: number;
  pendingCount?: number;
  ghostCount?: number;
  accent?: string;
}) {
  const confirmedCount = count - pendingCount;
  const previewedCount = count + ghostCount;

  function ghostStrokeProps(threshold: number) {
    const isGhost = threshold > count && threshold <= previewedCount;
    return { stroke: accent, opacity: isGhost ? 0.45 : 0, strokeDasharray: "5 4" };
  }

  return (
    <svg viewBox="0 0 60 60" className="w-full h-full" aria-hidden>
      <line
        x1="6"
        y1="54"
        x2="54"
        y2="6"
        strokeWidth={7}
        strokeLinecap="round"
        style={{ transition: "opacity 190ms ease-out", ...ghostStrokeProps(1) }}
      />
      <line
        x1="6"
        y1="6"
        x2="54"
        y2="54"
        strokeWidth={7}
        strokeLinecap="round"
        style={{ transition: "opacity 190ms ease-out", ...ghostStrokeProps(2) }}
      />
      <circle
        cx="30"
        cy="30"
        r="27"
        fill="none"
        strokeWidth={6}
        style={{ transition: "opacity 150ms ease-out", ...ghostStrokeProps(3) }}
      />
      <line
        x1="6"
        y1="54"
        x2="54"
        y2="6"
        pathLength={1}
        stroke={confirmedCount >= 1 ? "var(--color-cream)" : accent}
        strokeWidth={7}
        strokeLinecap="round"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: count >= 1 ? 0 : 1,
          opacity: count >= 1 ? 1 : 0,
          transition: "stroke-dashoffset 190ms ease-out, opacity 190ms ease-out",
        }}
      />
      <line
        x1="6"
        y1="6"
        x2="54"
        y2="54"
        pathLength={1}
        stroke={confirmedCount >= 2 ? "var(--color-cream)" : accent}
        strokeWidth={7}
        strokeLinecap="round"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: count >= 2 ? 0 : 1,
          opacity: count >= 2 ? 1 : 0,
          transition: "stroke-dashoffset 190ms ease-out, opacity 190ms ease-out",
          transitionDelay: "65ms",
        }}
      />
      <circle
        cx="30"
        cy="30"
        r="27"
        pathLength={1}
        fill="none"
        stroke={confirmedCount >= 3 ? "var(--color-gold)" : accent}
        strokeWidth={6}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: count >= 3 ? 0 : 1,
          opacity: count >= 3 ? 1 : 0,
          transition: "stroke-dashoffset 150ms ease-out, opacity 150ms ease-out",
          transitionDelay: "55ms",
        }}
      />
    </svg>
  );
}
