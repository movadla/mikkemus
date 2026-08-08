"use client";

// Categorical palette slots 1–3 from the dataviz skill's validated default (blue,
// orange, aqua) — these are the three that clear every colorblind-separation check
// against each other (see the skill's palette.md), not the app's own teal/gold/green
// UI accents, which fail those checks when used together as chart series.
export const CHART_SERIES_COLORS = ["#3987e5", "#d95926", "#199e70"];

type Series = {
  label: string;
  color: string;
  /** One value per match, chronological, oldest first. null = no data for that match. */
  points: (number | null)[];
};

/**
 * A small hand-drawn SVG line chart for a player's "over time" trends — no
 * charting library in this project, and the data is tiny (one point per match),
 * so a bespoke component is simpler than adding a dependency for it.
 */
export function StatsLineChart({
  series,
  unit = "",
  height = 140,
}: {
  series: Series[];
  unit?: string;
  height?: number;
}) {
  const pointCount = Math.max(...series.map((s) => s.points.length), 0);
  if (pointCount < 2) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>Ikke nok kamper ennå til å vise en trend.</p>
    );
  }

  const width = 320;
  const padX = 8;
  const padY = 16;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const allValues = series.flatMap((s) => s.points).filter((v): v is number => v !== null);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 1);
  const range = max - min || 1;

  const xAt = (i: number) => padX + (plotW * i) / (pointCount - 1);
  const yAt = (v: number) => padY + plotH - ((v - min) / range) * plotH;

  function pathFor(points: (number | null)[]): string {
    let d = "";
    let drawing = false;
    points.forEach((v, i) => {
      if (v === null) {
        drawing = false;
        return;
      }
      const cmd = drawing ? "L" : "M";
      d += `${cmd}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  }

  const gridY = [min, min + range / 2, max];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Utvikling over kamper">
        {gridY.map((v) => (
          <line
            key={v}
            x1={padX}
            x2={width - padX}
            y1={yAt(v)}
            y2={yAt(v)}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}
        {series.map((s) => (
          <path key={s.label} d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {series.map((s) => {
          const lastIdx = s.points.map((v) => v !== null).lastIndexOf(true);
          if (lastIdx === -1) return null;
          const v = s.points[lastIdx] as number;
          return (
            <g key={`${s.label}-end`}>
              <circle cx={xAt(lastIdx)} cy={yAt(v)} r={5} fill={s.color} stroke="var(--color-panel)" strokeWidth={2} />
              <text
                x={Math.min(xAt(lastIdx) + 6, width - 4)}
                y={yAt(v)}
                textAnchor={xAt(lastIdx) > width - 40 ? "end" : "start"}
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--color-cream)"
              >
                {Math.round(v)}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-1">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: s.color }} />
              <span style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
