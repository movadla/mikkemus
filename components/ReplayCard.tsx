"use client";

import { useEffect, useState } from "react";
import { DartboardHeatmap } from "./DartboardHeatmap";

const FLIGHT_MS = 1300;
const LAND_MS = 400;
/** Half the board's SVG: the board radius (225) and the padding DartboardHeatmap gives it (20). */
const HALF = 245;

/**
 * The last turn of the match played back in slow motion, dart by dart, from where the darts really
 * landed (the Scolia coordinates) — never from a made-up position. Each dart's path is drawn
 * from outside the board to its point before the dart lands there; the last one is the win.
 * A phone set to reduced motion gets the finished picture at once.
 */
export function ReplayCard({ throws }: { throws: [number, number][] }) {
  const [shown, setShown] = useState(0);
  const [flying, setFlying] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const calm = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (calm) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      setShown(0);
      setFlying(null);
      await wait(500);
      for (let i = 0; i < throws.length && !cancelled; i++) {
        setFlying(i);
        await wait(FLIGHT_MS);
        if (cancelled) return;
        setShown(i + 1);
        await wait(LAND_MS);
      }
      if (!cancelled) setFlying(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [throws, run, calm]);

  const visible = calm ? throws.length : shown;
  const done = calm || (shown === throws.length && flying === null);

  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="section-label">REPRISE · SISTE RUNDE</p>
        {!calm && (
          <span className="tabular" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.14em", fontWeight: 700 }}>
            ×0,25
          </span>
        )}
      </div>
      <div className="relative mx-auto" style={{ maxWidth: "20rem" }}>
        <DartboardHeatmap throws={throws.slice(0, visible)} recentFrom={0} />
        {/* The paths, in the same coordinates as the board so each ends exactly on its dart. */}
        <svg viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {throws.map(([x, y], i) => {
            if (!calm && flying !== i && i >= visible) return null;
            const ex = x, ey = -y;
            const sx = HALF + 40, sy = HALF + 40;
            return (
              <path
                key={`${run}-${i}`}
                d={`M ${sx} ${sy} Q ${(sx + ex) / 2 + 40} ${(sy + ey) / 2 - 120} ${ex} ${ey}`}
                pathLength={100}
                fill="none"
                stroke="rgba(230,189,87,0.75)"
                strokeWidth={3}
                strokeLinecap="round"
                className={calm ? undefined : "replay-trail"}
                style={calm ? { strokeDasharray: 100, strokeDashoffset: 0, opacity: 0.45 } : i < visible ? { opacity: 0.35 } : undefined}
              />
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between mt-4" style={{ minHeight: "2.75rem" }}>
        <p className="font-display" style={{ color: "var(--color-gold)", fontSize: "1.1rem" }}>
          {done ? `Pil ${throws.length} ga seieren` : `Pil ${Math.min(throws.length, (flying ?? shown) + 1)} av ${throws.length}`}
        </p>
        {!calm && done && (
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="tactile px-4 rounded-lg text-sm"
            style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            Spill av igjen
          </button>
        )}
      </div>
    </div>
  );
}
