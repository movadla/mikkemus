"use client";

import { useMemo } from "react";
import { dayLabel } from "@/lib/formatDate";
import { GAME_NAMES, tablesOf, type GameResult, type GameTable, type TableRow } from "@/lib/gameResults";
import { useGameResults } from "@/lib/gameResultsStorage";

const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");
const MEDAL = ["var(--color-gold)", "var(--color-muted)", "var(--color-bronze)"];

/** The small line under a name: the numbers that matter in this game, and only those the person has. */
function figuresOf(table: GameTable, r: TableRow): string[] {
  const parts: (string | null)[] =
    table.game === "highstriker"
      ? [r.average !== null ? `Snitt ${oneDecimal(r.average)}` : null, r.best !== null ? `Beste runde ${r.best}` : null, `${r.lostLives} liv tapt`]
      : table.game === "killer"
        ? [`${r.burned} drept`, `${r.lostLives} liv tapt`]
        : table.game === "halvit"
        ? [r.best !== null ? `Beste ${r.best} poeng` : null, `${r.lostLives} ganger halvert`]
        : table.game === "lava"
        ? [`${r.burned} brent`, `${r.lostLives} liv tapt`]
        : [
            r.average !== null ? `Snitt ${oneDecimal(r.average)}` : null,
            r.best !== null ? `Høyeste ${r.best}` : null,
            r.tons > 0 ? `100+ ${r.tons}` : null,
            r.bestFinish !== null ? `Utsjekk ${r.bestFinish}` : null,
          ];
  return parts.filter((p): p is string => p !== null);
}

function resultLine(r: GameResult) {
  const others = r.players.filter((p) => p !== r.winner);
  return `${r.winner} slo ${others.join(", ")}`;
}

/** Andre spill: 301/501, Highstriker and Lava, one card for each game that has been played. Nothing here until one has. */
export function OtherGamesTab() {
  const results = useGameResults();
  const tables = useMemo(() => tablesOf(results), [results]);
  if (tables.length === 0) {
    return (
      <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
        Ingen spill ennå
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {tables.map((t) => (
        <section key={t.game} className="card" style={{ background: "var(--color-surface)" }} aria-label={GAME_NAMES[t.game]}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="section-label">{GAME_NAMES[t.game].toUpperCase()}</h2>
            <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
              {t.played} spill · sist {dayLabel(t.last).toLowerCase()}
            </span>
          </div>
          <ol className="space-y-2">
            {t.rows.map((r, i) => (
              <li key={r.name} className="flex items-center gap-3" style={{ minHeight: "var(--control)" }}>
                <span className="font-display shrink-0 w-6 text-center" style={{ color: MEDAL[i] ?? "var(--color-muted)", fontSize: "var(--text-title)" }}>
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: i === 0 ? 700 : 500 }}>
                    {r.name}
                  </span>
                  <span className="block tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                    {figuresOf(t, r).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block" style={{ color: i === 0 ? "var(--color-gold-strong)" : "var(--color-teal-strong)", fontSize: "var(--text-body)", fontWeight: 700 }}>
                    {r.wins} {r.wins === 1 ? "seier" : "seire"}
                  </span>
                  <span className="tabular block" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                    av {r.games} · {r.winPct} %
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <ul className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid var(--color-hairline)" }} aria-label="Siste spill">
            {t.recent.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-micro)", color: "var(--color-text-2)" }}>
                <span className="truncate">{resultLine(r)}</span>
                <span className="shrink-0 tabular" style={{ color: "var(--color-muted)" }}>
                  {dayLabel(r.playedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
