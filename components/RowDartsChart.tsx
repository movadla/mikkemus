"use client";

import { useState } from "react";
import { STEPS, STEP_LABELS, type Step } from "@/lib/game";

/**
 * Darts spent per row, as bars: the heaviest row in red, and a tap on a bar reads its figure out below. The same chart on
 * the winner screen (one match) and under a player's statistics (every match of theirs) — see rowCosts in lib/rowCosts.ts
 * for how a row is charged.
 */
export function RowDartsChart({ costs, who }: { costs: Record<Step, number>; who: string }) {
  const [picked, setPicked] = useState<Step | null>(null);
  const max = Math.max(1, ...STEPS.map((s) => costs[s]));
  const worst = STEPS.reduce((a, s) => (costs[s] > costs[a] ? s : a), STEPS[0]);
  const shown = picked ?? worst;

  return (
    <>
      <svg viewBox="0 0 300 150" className="w-full h-auto" role="img" aria-label="Piler per rad">
        {STEPS.map((s, i) => {
          const h = (costs[s] / max) * 100;
          const x = i * 30 + 5;
          const isWorst = s === worst;
          return (
            <g key={s} onClick={() => setPicked(s)} style={{ cursor: "pointer" }}>
              <rect x={x} y={20} width={24} height={110} fill="transparent" />
              <rect x={x} y={125 - h} width={20} height={Math.max(2, h)} rx={4} fill={isWorst ? "#e04a3a" : "#2fb4c2"} opacity={shown === s ? 1 : 0.8} stroke={shown === s ? "#fff" : "none"} strokeWidth={1.5} />
              <text x={x + 10} y={118 - h} textAnchor="middle" fill="var(--color-cream)" fontSize="11" fontWeight="700">
                {costs[s]}
              </text>
              <text x={x + 10} y={145} textAnchor="middle" fill="var(--color-muted)" fontSize="11">
                {STEP_LABELS[s]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
        {shown === worst ? (
          <>
            <b style={{ color: "var(--color-cream)" }}>{STEP_LABELS[worst]}</b> var tregest for {who}: {costs[worst]} piler
          </>
        ) : (
          <>
            <b style={{ color: "var(--color-cream)" }}>Rad {STEP_LABELS[shown]}</b>: {costs[shown]} piler
          </>
        )}
      </p>
    </>
  );
}
