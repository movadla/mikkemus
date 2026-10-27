import type { MatchHistoryEntry } from "@/lib/storage";

/** How many of the last matches the curve covers. */
const SPAN = 8;

/**
 * The form of a player as a short line: each of the last matches takes the line one step up for a win and one down for a loss, so it ends
 * high when the player is on the way up. Green when it ends above where it began, red when below, quiet when level. Nothing until there
 * are two matches to draw between. It is a picture, so the words are on the row.
 */
export function FormCurve({ history }: { history: MatchHistoryEntry[] }) {
  const last = history.slice(-SPAN);
  if (last.length < 2) return null;
  const walk = last.reduce((steps, m) => [...steps, steps[steps.length - 1] + (m.won ? 1 : -1)], [0]);
  const lo = Math.min(...walk);
  const hi = Math.max(...walk);
  const w = 44;
  const h = 18;
  const y = (v: number) => (hi === lo ? h / 2 : h - 2 - ((v - lo) / (hi - lo)) * (h - 4));
  const points = walk.map((v, i) => `${((i / (walk.length - 1)) * (w - 4) + 2).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const end = walk[walk.length - 1];
  const tone = end > 0 ? "var(--color-green)" : end < 0 ? "var(--color-red)" : "var(--color-muted)";
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" style={{ stroke: tone }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
