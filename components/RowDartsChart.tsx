"use client";

import { useState } from "react";
import { STEPS, STEP_LABELS, type Step } from "@/lib/game";
import { seriesColor } from "./ui/ChartFrame";

export type RowChartUnit = "darts" | "pct";

/**
 * One figure per row as bars, in darts spent or in hit percentage, with the row that stands out in red — the most darts, or
 * the lowest percentage — and a tap on a bar reads its figure out below. The same chart on the winner screen (one match) and
 * under a player's statistics (every match of theirs). A row without a figure (null) is drawn empty with «–».
 */
export function RowDartsChart({ values, unit = "darts", who }: { values: Record<Step, number | null>; unit?: RowChartUnit; who: string }) {
  const [picked, setPicked] = useState<Step | null>(null);
  const known = STEPS.filter((s) => values[s] !== null);
  const max = unit === "pct" ? 100 : Math.max(1, ...known.map((s) => values[s] as number));
  const worst = known.reduce<Step | null>((a, s) => {
    if (a === null) return s;
    const v = values[s] as number;
    const best = values[a] as number;
    return unit === "darts" ? (v > best ? s : a) : v < best ? s : a;
  }, null);
  const shown = picked ?? worst;
  const text = (v: number | null) => (v === null ? "–" : unit === "pct" ? `${Math.round(v)} %` : String(v));

  return (
    <>
      <svg viewBox="0 0 300 150" className="w-full h-auto" role="img" aria-label={unit === "pct" ? "Treff per rad" : "Piler per rad"}>
        {STEPS.map((s, i) => {
          const v = values[s];
          const h = v === null ? 0 : (v / max) * 100;
          const x = i * 30 + 5;
          const isWorst = s === worst;
          return (
            <g key={s} onClick={() => setPicked(s)} style={{ cursor: "pointer" }}>
              <rect x={x} y={20} width={24} height={110} fill="transparent" />
              <rect x={x} y={125 - h} width={20} height={Math.max(2, h)} rx={5} fill={isWorst ? "var(--color-gold)" : seriesColor(who)} opacity={shown === s ? 1 : 0.8} stroke={shown === s ? "#fff" : "none"} strokeWidth={1.5} />
              <text x={x + 10} y={118 - h} textAnchor="middle" fill="var(--color-cream)" fontSize={unit === "pct" ? "10" : "11"} fontWeight="700">
                {v === null ? "–" : unit === "pct" ? Math.round(v) : v}
              </text>
              <text x={x + 10} y={145} textAnchor="middle" fill="var(--color-muted)" fontSize="11">
                {STEP_LABELS[s]}
              </text>
            </g>
          );
        })}
      </svg>
      {shown && (
        <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          {shown === worst ? (
            <>
              <b style={{ color: "var(--color-cream)" }}>{STEP_LABELS[worst!]}</b> var {unit === "pct" ? "vanskeligst" : "tregest"} for {who}: {text(values[worst!])}
            </>
          ) : (
            <>
              <b style={{ color: "var(--color-cream)" }}>Rad {STEP_LABELS[shown]}</b>: {text(values[shown])}
            </>
          )}
        </p>
      )}
    </>
  );
}
