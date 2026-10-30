import { TrophyIcon } from "./icons";

/**
 * The road to the cup before the first match: the first round with the names drawn, an empty box for every match after it, the lines
 * between them and the cup at the end. Shown under the draw, and it changes with it.
 */
export function MiniBracket({ pairs, accent }: { pairs: { a: string | null; b: string | null }[]; accent: string }) {
  if (pairs.length === 0) return null;
  // Wide and low enough for a name such as "Madhouse Mafia" to sit in its box at a size that is still read.
  const w = 140;
  const h = 40;
  const gap = 18;
  const pitch = 48;
  const cols: number[] = [];
  for (let n = pairs.length; ; n = Math.ceil(n / 2)) {
    cols.push(n);
    if (n === 1) break;
  }
  const height = pairs.length * pitch;
  const cy = (c: number, i: number) => (i + 0.5) * (height / cols[c]);
  const x = (c: number) => c * (w + gap);
  const width = cols.length * (w + gap) - gap;
  const name = (n: string | null) => (n ?? "Walkover");
  return (
    <div className="overflow-x-auto" style={{ paddingBottom: 4 }}>
      <div role="img" aria-label="Slik blir veien til pokalen" className="relative" style={{ width, height, minWidth: width }}>
        <svg width={width} height={height} className="absolute left-0 top-0 pointer-events-none" aria-hidden>
          {cols.slice(0, -1).map((count, c) =>
            Array.from({ length: count }, (_, i) => {
              const x0 = x(c) + w;
              const y = cy(c, i);
              const yt = cy(c + 1, Math.floor(i / 2));
              return <path key={`${c}-${i}`} d={`M${x0},${y} H${x0 + gap / 2} V${yt} H${x0 + gap}`} stroke="var(--color-hairline)" strokeWidth={1.5} fill="none" />;
            }),
          )}
        </svg>
        {cols.map((count, c) =>
          Array.from({ length: count }, (_, i) => {
            const pair = c === 0 ? pairs[i] : null;
            return (
              <div
                key={`${c}-${i}`}
                className="absolute flex flex-col overflow-hidden"
                style={{ left: x(c), top: cy(c, i) - h / 2, width: w, height: h, borderRadius: "var(--radius-s)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)", fontSize: "0.75rem", color: "var(--color-cream)" }}
              >
                {[pair?.a, pair?.b].map((n, k) => (
                  <span key={k} className="flex-1 flex items-center px-1.5 truncate" style={{ borderTop: k === 1 ? "1px solid var(--color-border)" : undefined, color: pair && n === null ? "var(--color-muted)" : undefined, fontStyle: pair && n === null ? "italic" : undefined }}>
                    {pair ? name(n ?? null) : ""}
                  </span>
                ))}
              </div>
            );
          }),
        )}
        <span aria-hidden className="absolute flex justify-center" style={{ left: x(cols.length - 1), top: cy(cols.length - 1, 0) - h / 2 - 28, width: w, color: accent }}>
          <TrophyIcon className="w-6 h-6" />
        </span>
      </div>
    </div>
  );
}
