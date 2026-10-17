"use client";

import { formatOdds, formatPct } from "@/lib/odds/price";

export type OddsRow = {
  name: string;
  odds: number;
  p: number;
  lo: number;
  hi: number;
  /** The win chance one turn ago, for the arrow. */
  before?: number;
  /** Whose turn it is. */
  active?: boolean;
  /** The colour of the team's shirt or the player's accent. */
  color?: string;
  /** With two sides: the chance of winning with the other short by k crosses, at index k. For /bet. */
  margin?: number[];
};

/** The odds are shaky when the band the win chance could be in is wide: a new player, an early match. */
export const isUnsure = (rows: OddsRow[]) => rows.some((r) => r.hi - r.lo > 0.28);

/**
 * The odds on the match, one box per side: the price big, the win chance and an arrow for how it
 * moved since the last turn beneath. Updates after every turn (three darts), never mid-turn.
 * The arrow follows the chance, not the price: up is a side getting stronger.
 */
export function OddsBar({ rows, compact = false }: { rows: OddsRow[]; compact?: boolean }) {
  if (rows.length === 0) return null;
  const unsure = isUnsure(rows);
  return (
    <div role="group" aria-label={unsure ? "Odds på kampen, usikre fordi få piler er målt" : "Odds på kampen"} title={unsure ? "Usikre odds: få piler målt" : undefined} className="w-full">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, minmax(0, 1fr))` }}>
        {rows.slice(0, 4).map((r) => {
          const delta = r.before === undefined ? 0 : r.p - r.before;
          const up = delta > 0.004;
          const down = delta < -0.004;
          return (
            <div
              key={r.name}
              className="rounded-lg px-2 min-w-0"
              style={{ background: "var(--color-surface)", border: `1px ${unsure ? "dashed" : "solid"} ${r.active ? "var(--color-teal)" : "var(--color-border)"}`, borderTop: r.color ? `3px solid ${r.color}` : undefined }}
            >
              <p className="truncate" style={{ color: "var(--color-muted)", fontSize: compact ? "0.66rem" : "0.72rem", lineHeight: 1.2, paddingTop: 2 }}>
                {r.name}
              </p>
              <p className="flex items-baseline gap-2">
                <span className="font-display tabular" style={{ fontSize: compact ? "1.05rem" : "1.3rem", color: "var(--color-cream)", lineHeight: 1.1 }}>
                  {formatOdds(r.odds)}
                </span>
                <span className="tabular" style={{ fontSize: "0.7rem", color: up ? "#3fc06a" : down ? "#e04a3a" : "var(--color-muted)", fontWeight: 700 }} title={`Vinnersjanse ${formatPct(r.p)}`}>
                  {up ? "▲" : down ? "▼" : "–"} {formatPct(r.p)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
