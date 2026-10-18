"use client";

import { useEffect, useMemo, useState } from "react";
import { expectedScore, PROVISIONAL_MATCHES } from "@/lib/rating";
import { previewRating, ratingOf, useRoster } from "@/lib/storage";

const ROW_H = 40;
const MAX_ROWS = 8;
/** A win is called an upset when the winner had less than this chance on the ratings beforehand. */
const UPSET_BELOW = 0.35;

/**
 * The rating table after a match between two sides: both start where they stood, then the winner's row
 * climbs and the loser's falls into their new places while the numbers count to their new values. Shown
 * from the same arithmetic that books the rating when the win is accepted (lib/rating.ts), so what is
 * on the screen is what ends up in the table. Only for two real sides, both with a record.
 */
export function RatingCard({ players, winner }: { players: string[]; winner: string }) {
  const roster = useRoster();
  const loser = players.length === 2 ? players.find((p) => p !== winner) : undefined;
  // The table is the people (or the teams) the two belong to. Worked out once per change of the records,
  // so the animation below is not restarted by its own re-renders.
  const model = useMemo(() => {
    const preview = loser ? previewRating(winner, loser) : null;
    if (!preview || preview.winner.kind !== preview.loser.kind) return null;
    const same = roster.filter((r) => r.kind === preview.winner.kind && (r.matchesPlayed > 0 || r.rating !== undefined || r.name === preview.winner.name || r.name === preview.loser.name));
    const rows = same.map((r) => {
      const before = ratingOf(r);
      const delta = r.name === preview.winner.name ? preview.winnerDelta : r.name === preview.loser.name ? preview.loserDelta : 0;
      return { name: r.name, before, after: before + delta, delta, provisional: (r.ratedMatches ?? 0) < PROVISIONAL_MATCHES, involved: delta !== 0 || r.name === preview.winner.name || r.name === preview.loser.name };
    });
    const byBefore = [...rows].sort((a, b) => b.before - a.before);
    const shown = byBefore.filter((r, i) => i < MAX_ROWS || r.involved);
    const rankBefore = new Map(shown.map((r, i) => [r.name, i]));
    const rankAfter = new Map([...shown].sort((a, b) => b.after - a.after).map((r, i) => [r.name, i]));
    return { shown, rankBefore, rankAfter };
  }, [roster, winner, loser]);

  const [after, setAfter] = useState(false);
  const [shownRating, setShownRating] = useState<Record<string, number>>({});

  // First the table as it was, then, a moment later, the table as it is.
  useEffect(() => {
    if (!model) return;
    const t = setTimeout(() => setAfter(true), 900);
    return () => clearTimeout(t);
  }, [model]);

  useEffect(() => {
    if (!model || !after) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      setShownRating(Object.fromEntries(model.shown.map((r) => [r.name, r.before + (r.after - r.before) * e])));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [model, after]);

  if (!model) return null;
  const { shown, rankBefore, rankAfter } = model;
  const winnerRow = shown.find((r) => r.name === winner);
  const loserRow = shown.find((r) => r.name === loser);

  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="mb-3 section-label">RATING ETTER KAMP</p>
      <div className="relative" style={{ height: shown.length * ROW_H }}>
        {shown.map((r) => {
          const rank = (after ? rankAfter : rankBefore).get(r.name) ?? 0;
          const moved = (rankBefore.get(r.name) ?? 0) - (rankAfter.get(r.name) ?? 0);
          const up = after && r.delta > 0;
          const down = after && r.delta < 0;
          return (
            <div
              key={r.name}
              className="rating-row absolute left-0 right-0 grid items-center gap-2 px-3 rounded-lg"
              style={{
                height: ROW_H - 4,
                gridTemplateColumns: "1.6rem 1fr 3.6rem 4.4rem",
                transform: `translateY(${rank * ROW_H}px)`,
                background: up ? "rgba(74,139,92,0.4)" : down ? "rgba(196,67,46,0.3)" : "rgba(0,0,0,0.2)",
                transition: "transform 800ms cubic-bezier(0.2,0.9,0.2,1), background 400ms",
              }}
            >
              <span className="font-display text-center" style={{ color: "var(--color-muted)" }}>{rank + 1}</span>
              <span className="truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>
                {r.name}
                {r.provisional && <span style={{ color: "var(--color-muted)", fontWeight: 400 }}> *</span>}
              </span>
              <span className="font-display tabular text-right" style={{ color: "var(--color-cream)" }}>
                {Math.round(shownRating[r.name] ?? r.before).toLocaleString("nb-NO").replace(/\s/g, " ")}
              </span>
              <span className="tabular text-right" style={{ fontSize: "0.8rem", fontWeight: 600, color: up ? "var(--color-green)" : down ? "var(--color-red)" : "var(--color-muted)" }}>
                {after && r.delta !== 0 ? `${r.delta > 0 ? "+" : "−"}${Math.abs(r.delta)}${moved !== 0 ? ` ${moved > 0 ? "▲" : "▼"}${Math.abs(moved)}` : ""}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {winnerRow && loserRow && (
        <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
          {winnerRow.name} +{winnerRow.delta}, {loserRow.name} −{Math.abs(loserRow.delta)}
          {expectedScore(winnerRow.before, loserRow.before) < UPSET_BELOW ? ". Uventet seier, stor gevinst" : ""}. * Foreløpig rating, den flytter seg raskere de første {PROVISIONAL_MATCHES} kampene.
        </p>
      )}
    </div>
  );
}
