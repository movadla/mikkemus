"use client";

import { useState } from "react";
import { STEPS, STEP_LABELS, type Step, type TurnAggregate, type TurnResult } from "@/lib/game";
import { throwerStats } from "@/lib/turnStats";
import { rowCosts } from "@/lib/rowCosts";

type Award = { icon: string; title: string; who: string; detail: string };

/** Darts a thrower needs in a match to be named the most accurate: three darts at a hundred per cent say nothing. */
const MIN_DARTS_ACCURATE = 15;

/**
 * The prizes of a match, worked out from what was thrown: the best hit percentage, the longest run
 * of counting darts, the fewest darts to win, and — when the board reports where the darts landed —
 * who got more crosses than the darts were worth. Only prizes with something behind them are shown.
 */
export function buildAwards(args: {
  players: string[];
  winner: string;
  stats: Record<string, TurnAggregate>;
  turnLog: Record<string, TurnResult[]>;
  /** Expected crosses (xH) per side, or null where the board gave no positions. */
  expected: Record<string, number | null>;
  /** Crosses banked outside xH's accounting, per side. */
  banked: Record<string, number>;
}): Award[] {
  const { players, winner, stats, turnLog, expected, banked } = args;
  const out: Award[] = [];
  const throwers = players.flatMap((p) => throwerStats(turnLog[p] ?? [], p).map((r) => ({ ...r, side: p })));

  const accurate = throwers.filter((t) => t.darts >= MIN_DARTS_ACCURATE).sort((a, b) => b.hitPct - a.hitPct || b.hits - a.hits)[0];
  if (accurate) out.push({ icon: "🎯", title: "Mest treffsikker", who: accurate.name, detail: `${accurate.hitPct} % treff` });

  const streak = [...throwers].sort((a, b) => b.bestRun - a.bestRun)[0];
  if (streak && streak.bestRun >= 1) out.push({ icon: "🔥", title: "Lengste serie", who: streak.name, detail: `${streak.bestRun * 3} piler på rad` });

  const darts = stats[winner]?.darts ?? 0;
  if (darts > 0) out.push({ icon: "⚡", title: "Vant på", who: winner, detail: `${darts} ${darts === 1 ? "pil" : "piler"}` });

  const lucky = players
    .map((p) => {
      const xh = expected[p];
      if (xh === null || xh === undefined) return null;
      const actual = (stats[p]?.hits ?? 0) - (banked[p] ?? 0);
      return { p, diff: actual - xh, xh, actual };
    })
    .filter((x): x is { p: string; diff: number; xh: number; actual: number } => !!x)
    .sort((a, b) => b.diff - a.diff)[0];
  if (lucky && lucky.diff > 0.5) out.push({ icon: "🍀", title: "Heldigst", who: lucky.p, detail: `${lucky.actual} kryss mot ${lucky.xh.toFixed(1).replace(".", ",")} forventet` });
  return out;
}

export function AwardsCard({ awards }: { awards: Award[] }) {
  if (awards.length === 0) return null;
  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="mb-4 section-label">PRISER</p>
      <div className="grid grid-cols-2 gap-2">
        {awards.map((a) => (
          <div key={a.title} className="rounded-xl p-3" style={{ background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: "1.4rem" }} aria-hidden>
              {a.icon}
            </p>
            <p style={{ color: "var(--color-gold)", fontSize: "0.7rem", letterSpacing: "0.12em", fontWeight: 700, textTransform: "uppercase" }}>{a.title}</p>
            <p className="font-display truncate" style={{ fontSize: "1.2rem", color: "var(--color-cream)" }}>
              {a.who}
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>{a.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * Which row took the longest: one bar per row for the chosen side, with the heaviest in red. A row
 * is charged the crosses that landed on it and the misses thrown while it was the one being
 * worked on, which is how the rest of the statistics count too.
 */
export function RowCostCard({ players, turnLog }: { players: string[]; turnLog: Record<string, TurnResult[]> }) {
  const [who, setWho] = useState(players[0]);
  const [picked, setPicked] = useState<Step | null>(null);
  const costs = rowCosts(turnLog[who] ?? []);
  const max = Math.max(1, ...STEPS.map((s) => costs[s]));
  const worst = STEPS.reduce((a, s) => (costs[s] > costs[a] ? s : a), STEPS[0]);
  if (STEPS.every((s) => costs[s] === 0)) return null;
  const shown = picked ?? worst;

  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="mb-4 section-label">HVILKEN RAD TOK LENGST TID?</p>
      {players.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label="Lag">
          {players.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={p === who}
              onClick={() => {
                setWho(p);
                setPicked(null);
              }}
              className="tactile px-4 rounded-lg text-sm"
              style={{ minHeight: "2.75rem", background: p === who ? "rgba(47, 180, 194, 0.18)" : "var(--color-cell)", color: p === who ? "var(--color-teal)" : "var(--color-muted)", border: p === who ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <svg viewBox="0 0 300 150" className="w-full h-auto" role="img" aria-label="Forsøk per rad">
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
            <b style={{ color: "var(--color-cream)" }}>{STEP_LABELS[worst]}</b> var tregest for {who}: {costs[worst]} forsøk
          </>
        ) : (
          <>
            <b style={{ color: "var(--color-cream)" }}>Rad {STEP_LABELS[shown]}</b>: {costs[shown]} forsøk
          </>
        )}
      </p>
    </div>
  );
}

const SIDE_COLORS = ["#4b8be8", "#e04a3a", "#e6bd57", "#2fb4c2"];

/**
 * How the odds moved through the match: each side's chance of winning after every turn, with the
 * 50 % line. The side that won ends at the top, and the turns where the lead changed hands are the
 * ones where the match turned.
 */
export function OddsChart({ history, winner }: { history: { key: string; sides: { name: string; p: number; odds: number }[] }[]; winner: string }) {
  if (history.length < 2) return null;
  const names = history[0].sides.map((x) => x.name);
  const W = 300, H = 120, X0 = 6, X1 = W - 6;
  const x = (i: number) => X0 + (i / (history.length - 1)) * (X1 - X0);
  const y = (p: number) => 10 + (1 - p) * (H - 20);
  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="mb-4 section-label">ODDSENS FORLØP</p>
      <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full h-auto" role="img" aria-label="Vinnersjanse etter hver runde">
        <line x1={X0} x2={X1} y1={y(0.5)} y2={y(0.5)} stroke="var(--color-border)" strokeDasharray="4 4" />
        {names.map((n, si) => {
          const pts = history.map((h, i) => `${x(i)},${y(h.sides.find((s) => s.name === n)?.p ?? 0.5)}`).join(" ");
          const last = history[history.length - 1].sides.find((s) => s.name === n)?.p ?? 0.5;
          return (
            <g key={n}>
              <polyline points={pts} fill="none" stroke={SIDE_COLORS[si % 4]} strokeWidth={n === winner ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" opacity={n === winner ? 1 : 0.85} />
              <circle cx={x(history.length - 1)} cy={y(last)} r={3.5} fill={SIDE_COLORS[si % 4]} />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2" style={{ fontSize: "0.8rem" }}>
        {names.map((n, si) => (
          <span key={n} style={{ color: "var(--color-muted)" }}>
            <i className="inline-block rounded-full mr-1" style={{ width: 8, height: 8, background: SIDE_COLORS[si % 4] }} />
            {n}
            {n === winner ? " (vant)" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
