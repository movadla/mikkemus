"use client";

import { avatarAccent } from "@/lib/avatarAccent";
import type { TurnResult } from "@/lib/game";

/**
 * The match as a race: rounds along the bottom, crosses banked so far up the side, one line per
 * player. Where the lines cross is where the lead changed hands; the gap at the end is the
 * margin. Numbers are kept to the axes and the finishing totals — the shape is the point.
 */
export function RaceChart({
  players,
  turnLog,
  winner,
  total,
}: {
  players: string[];
  turnLog: Record<string, TurnResult[]>;
  winner: string;
  /** Crosses a full board needs — 30 in Standard, 10 in 1 treff. Sets the top of the chart. */
  total: number;
}) {
  const series = players.map((p) => {
    const turns = (turnLog[p] ?? []).filter((t): t is TurnResult => !!t);
    let running = 0;
    const points = [0, ...turns.map((t) => (running += Object.values(t.hitsByStep).reduce((a, b) => a + b, 0)))];
    return { player: p, points, colour: avatarAccent(p) };
  });
  const rounds = Math.max(1, ...series.map((s) => s.points.length - 1));

  const W = 320;
  const H = 168;
  const left = 24;
  const right = 34;
  const top = 10;
  const bottom = 20;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const x = (round: number) => left + (round / rounds) * plotW;
  const y = (hits: number) => top + plotH - (Math.min(hits, total) / total) * plotH;

  // Grid at thirds of the board (10/20/30 in Standard), rounds every 5 or every round when short.
  const yTicks = total % 3 === 0 ? [total / 3, (2 * total) / 3, total] : [total];
  const xStep = rounds <= 8 ? 1 : rounds <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let r = xStep; r <= rounds; r += xStep) xTicks.push(r);
  if (xTicks[xTicks.length - 1] !== rounds) xTicks.push(rounds);

  // End labels: nudge apart when two players finish on the same count.
  const ends = series
    .map((s) => ({ ...s, finalHits: s.points[s.points.length - 1], finalRound: s.points.length - 1 }))
    .sort((a, b) => b.finalHits - a.finalHits);
  const labelY = new Map<string, number>();
  let lastY = -Infinity;
  for (const e of ends) {
    let ly = y(e.finalHits);
    if (ly - lastY < 11) ly = lastY + 11;
    labelY.set(e.player, ly);
    lastY = ly;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Treff per runde, spiller for spiller">
        {/* Grid */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={0.6} strokeDasharray={t === total ? undefined : "2 3"} />
            <text x={left - 5} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={7.5} fill="var(--color-muted)" className="tabular">
              {t}
            </text>
          </g>
        ))}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="var(--color-border)" strokeWidth={0.8} />
        {xTicks.map((r) => (
          <g key={r}>
            <line x1={x(r)} x2={x(r)} y1={y(0)} y2={y(0) + 3} stroke="var(--color-border)" strokeWidth={0.8} />
            <text x={x(r)} y={H - 6} textAnchor="middle" fontSize={7.5} fill="var(--color-muted)" className="tabular">
              {r}
            </text>
          </g>
        ))}

        {/* Lines — the winner's carries a soft halo so it reads first. Drawn last so it sits on top. */}
        {[...series].sort((a) => (a.player === winner ? 1 : -1)).map((s) => {
          const d = s.points.map((h, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(h).toFixed(1)}`).join(" ");
          const isWinner = s.player === winner;
          return (
            <g key={s.player}>
              {isWinner && <path d={d} fill="none" stroke={s.colour} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} />}
              <path d={d} fill="none" stroke={s.colour} strokeWidth={isWinner ? 2.4 : 1.8} strokeLinejoin="round" strokeLinecap="round" opacity={isWinner ? 1 : 0.85} />
              <circle cx={x(s.points.length - 1)} cy={y(s.points[s.points.length - 1])} r={isWinner ? 3.2 : 2.6} fill={s.colour} stroke="var(--color-surface)" strokeWidth={1.2} />
              <text
                x={x(s.points.length - 1) + 6}
                y={labelY.get(s.player)}
                dominantBaseline="middle"
                fontSize={8.5}
                fontWeight={isWinner ? 700 : 500}
                fill={s.colour}
                className="tabular"
              >
                {s.points[s.points.length - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Who is which line. */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
        {series.map((s) => (
          <span key={s.player} className="inline-flex items-center gap-1.5" style={{ color: "var(--color-cream)", fontSize: "0.72rem" }}>
            <span aria-hidden className="inline-block rounded-full" style={{ width: "0.55rem", height: "0.55rem", background: s.colour }} />
            {s.player}
          </span>
        ))}
      </div>
    </div>
  );
}
