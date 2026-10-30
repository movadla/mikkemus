"use client";

import { BEST_OF_CHOICES, standing, standingText, type Series } from "@/lib/series";
import { Segmented } from "./ui/Segmented";

/** «Best av»: one game, or a series where the first to the wins takes it. For Avanserte innstillinger. */
export function SeriesPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="px-4 py-3" style={{ borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <p className="section-label mb-2">BEST AV</p>
      <Segmented
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        label="Best av"
        fit
        options={BEST_OF_CHOICES.map((n) => ({ value: String(n), label: n === 1 ? "1 spill" : String(n) }))}
      />
      {value > 1 && (
        <p className="mt-2" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
          Den som vinner {Math.floor(value / 2) + 1} spill først, vinner serien og får ett poeng.
        </p>
      )}
    </div>
  );
}

/** The line about the series on the screen of a game: «Best av 3 · Lars 1–0 Vadla». */
export function seriesLine(series: Series, sides: string[], current: string | null): string {
  const s = standing(series, sides, current);
  return `Best av ${series.bestOf} · ${standingText(s, sides)}`;
}

/** On the winner screen: who has won the series, or where it stands. */
export function SeriesSummary({ series, sides, current }: { series: Series; sides: string[]; current: string }) {
  const s = standing(series, sides, current);
  return (
    <p className="text-center mb-4" role="status" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 700 }}>
      {s.decided ? `${s.decided} vant serien (best av ${series.bestOf}) · ${standingText(s, sides)}` : `Serien: ${standingText(s, sides)}`}
    </p>
  );
}
