"use client";

import { useEffect, useMemo, useState } from "react";
import { STEPS, STEP_LABELS, type TurnResult } from "@/lib/game";
import { getRules } from "@/lib/rules";
import type { OddsSnapshot } from "@/lib/oddsLog";
import { buildTimeline } from "@/lib/timeMachine";
import { Mark } from "./Mark";

const COLORS = ["#4b8be8", "var(--color-red)", "#e6bd57", "var(--color-teal)"];
const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";
const STEP_MS = 700;

/**
 * The finished match, turn by turn: drag the slider (or press play) to see the board, the chance each
 * side had of winning and who threw, from the first dart to the last. The big moments (a huge turn, the
 * lead changing hands, a side one row from winning) are buttons that jump straight there.
 */
export function TimeMachine({ players, turnLog, snapshots, winner }: { players: string[]; turnLog: Record<string, TurnResult[]>; snapshots: OddsSnapshot[]; winner: string }) {
  const target = getRules().target;
  const { frames, events } = useMemo(() => buildTimeline({ players, turnLog, snapshots, target, winner }), [players, turnLog, snapshots, target, winner]);
  const last = frames.length - 1;
  const [t, setT] = useState(last);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((cur) => {
        if (cur >= last) {
          setPlaying(false);
          return cur;
        }
        return cur + 1;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing, last]);

  if (last < 2 || !players.includes(winner)) return null;
  const f = frames[t];
  const prev = frames[Math.max(0, t - 1)];
  const haveChance = frames.every((x) => x.chance !== null);
  const board = 10 * target;
  // The chart: each side's chance of winning, or when the odds were not kept, the crosses on its board.
  const value = (i: number, p: string) => (haveChance ? (frames[i].chance as Record<string, number>)[p] ?? 0.5 : frames[i].total[p] / board);
  const W = 300, H = 90;
  const x = (i: number) => (i / last) * W;
  const y = (v: number) => H - 6 - v * (H - 12);
  const who = f.thrower ?? f.side;
  const narration =
    t === 0
      ? "Før første kast"
      : `Tur ${t}: ${who} ${f.gain === 0 ? "bommet" : `+${f.gain} ${f.gain === 1 ? "kryss" : "kryss"}`}`;

  const go = (i: number) => {
    setPlaying(false);
    setT(i);
  };

  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="mb-3 section-label">KAMPEN TUR FOR TUR</p>

      <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: `2.6rem repeat(${players.length}, minmax(0, 1fr))` }}>
        <span />
        {players.map((p, i) => (
          <span key={p} className="font-display text-center truncate" style={{ color: COLORS[i % 4], fontSize: "var(--text-body)" }}>
            {p}
          </span>
        ))}
        {STEPS.map((s) => (
          <div key={s} className="contents">
            <span className="font-display flex items-center justify-center rounded" style={{ background: "rgba(0,0,0,0.2)", color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
              {STEP_LABELS[s]}
            </span>
            {players.map((p) => {
              const n = f.progress[p][s];
              const changed = n !== prev.progress[p][s];
              return (
                <span
                  key={p}
                  className="flex items-center justify-center rounded"
                  style={{ height: 30, background: n >= target ? "var(--color-cell-done)" : "var(--color-cell)", boxShadow: changed && t > 0 ? "0 0 0 2px var(--color-teal)" : "none", transition: "box-shadow 300ms, background 300ms" }}
                >
                  <span style={{ width: 22, height: 22, display: "block" }}>
                    <Mark count={n} target={target} accent="var(--color-muted)" compact />
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mb-1" role="img" aria-label={haveChance ? "Vinnersjanse gjennom kampen" : "Kryss gjennom kampen"}>
        <rect width={W} height={H} fill="rgba(0,0,0,0.18)" rx={6} />
        {haveChance && <line x1={0} x2={W} y1={y(0.5)} y2={y(0.5)} stroke="var(--color-border)" strokeDasharray="4 4" />}
        {players.map((p, si) => (
          <polyline key={p} points={frames.map((_, i) => `${x(i).toFixed(1)},${y(value(i, p)).toFixed(1)}`).join(" ")} fill="none" stroke={COLORS[si % 4]} strokeWidth={p === winner ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" opacity={p === winner ? 1 : 0.85} />
        ))}
        {events.map((e) => (
          <path key={`${e.turn}-${e.kind}-${e.text}`} d={`M${x(e.turn)} ${H} l-4 -7 h8z`} fill="var(--color-gold)">
            <title>{e.text}</title>
          </path>
        ))}
        <line x1={x(t)} x2={x(t)} y1={0} y2={H} stroke="var(--color-teal)" strokeWidth={1.6} />
        {players.map((p, si) => (
          <circle key={p} cx={x(t)} cy={y(value(t, p))} r={4} fill={COLORS[si % 4]} />
        ))}
      </svg>

      <input
        type="range"
        min={0}
        max={last}
        value={t}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="Spol kampen"
        className={`w-full ${FOCUS_RING}`}
        style={{ accentColor: "var(--color-gold)", minHeight: "var(--control)" }}
      />
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
          {narration}
          {haveChance && (
            <span style={{ color: "var(--color-muted)" }}>
              {" "}
              · {players.map((p) => `${p} ${Math.round((f.chance as Record<string, number>)[p] * 100)} %`).join(", ")}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              if (t >= last) setT(0);
              setPlaying(true);
            }
          }}
          className={`tactile shrink-0 rounded-full px-4 ${FOCUS_RING}`}
          style={{ minHeight: "var(--control)", background: "linear-gradient(180deg, var(--color-teal-strong) 0%, var(--color-teal) 55%, var(--color-teal-deep) 100%)", color: "var(--color-bg)", fontWeight: 600 }}
        >
          {playing ? "Pause" : "Spill av"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {events.map((e) => (
          <button
            key={`${e.turn}-${e.kind}-${e.text}`}
            type="button"
            onClick={() => go(e.turn)}
            className={`tactile rounded-full px-3 ${FOCUS_RING}`}
            style={{ minHeight: "var(--control)", background: t === e.turn ? "var(--color-teal)" : "var(--color-cell)", color: t === e.turn ? "var(--color-bg)" : "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "var(--text-small)" }}
          >
            {e.turn} · {e.text}
          </button>
        ))}
      </div>
    </div>
  );
}
