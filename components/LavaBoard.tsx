"use client";

import { BULL, sectionLabel, type LavaDart } from "@/lib/lava";

/** Clockwise from the top, as on a real board (same order as lib/dartboard.ts). */
const NUMBER_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const R_SLAB_IN = 46;
const R_SLAB_OUT = 214;
const R_HIT_OUT = 246;
const R_NUMBER = 235;
const R_BULL = 40;
const EMBERS = [0, 1, 2, 3, 4, 5, 6, 7];

function pointAt(radius: number, index: number): [number, number] {
  const angle = (index * 18 * Math.PI) / 180;
  return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

/** The bed between radii r0..r1 in wedge `i`, as an SVG path. */
function bedPath(r0: number, r1: number, i: number): string {
  const [ax, ay] = pointAt(r1, i - 0.5);
  const [bx, by] = pointAt(r1, i + 0.5);
  const [cx, cy] = pointAt(r0, i + 0.5);
  const [dx, dy] = pointAt(r0, i - 0.5);
  return `M ${ax} ${ay} A ${r1} ${r1} 0 0 1 ${bx} ${by} L ${cx} ${cy} A ${r0} ${r0} 0 0 0 ${dx} ${dy} Z`;
}

/** Where a section is on the board: the middle of its slab. */
function centreOf(section: number, radius = 130): [number, number] {
  if (section === BULL) return [0, 0];
  return pointAt(radius, NUMBER_ORDER.indexOf(section));
}

/**
 * The lava board: a pool of lava with a slab of stone over each section. A section that is hit sinks into the lava and stays gone, so
 * what is left standing is what is still safe. The board is also the keypad: touch a section to say a dart landed in it. What a dart just
 * did is told by `effect` (embers going up from a section that caught fire, a ring from one that was already lava), and `darts` are the
 * ones of the round now going on, as crosses where they landed.
 */
export function LavaBoard({
  burned,
  effect,
  effectKey,
  darts,
  onPick,
  disabled,
  big,
}: {
  burned: Map<number, string>;
  effect: LavaDart | null;
  effectKey: number;
  darts: LavaDart[];
  onPick: (section: number) => void;
  disabled?: boolean;
  /** Party and up: the board shakes when a life goes, and there are embers drifting up. */
  big: boolean;
}) {
  const hit = effect && effect.section !== 0 ? effect : null;
  const [ex, ey] = hit ? centreOf(hit.section, 140) : [0, 0];

  return (
    <div className={`lava-stage ${hit?.outcome === "lava" ? "lava-stage--hit" : ""}`} key={hit?.outcome === "lava" ? `hit-${effectKey}` : "calm"}>
      {big && (
        <span className="lava-drift" aria-hidden>
          {EMBERS.map((i) => (
            <span key={i} style={{ "--x": `${8 + i * 12}%`, "--d": `${(i * 1.3) % 6}s`, "--t": `${5 + (i % 4)}s` } as React.CSSProperties} />
          ))}
        </span>
      )}
      <div className="lava-board">
        <div className="lava-glow" aria-hidden />
        <div className="lava-pool" aria-hidden />
        <svg viewBox="-262 -262 524 524" className="lava-svg" role="group" aria-label="Brettet: trykk på feltet pila traff">
          <circle r={R_SLAB_OUT + 14} className="lava-rim" />
          {NUMBER_ORDER.map((n, i) => {
            const gone = burned.has(n);
            const [tx, ty] = pointAt(R_NUMBER, i);
            return (
              <g key={n}>
                <path d={bedPath(R_SLAB_IN, R_SLAB_OUT, i)} className={`lava-slab ${i % 2 ? "lava-slab--alt" : ""} ${gone ? "lava-slab--gone" : ""}`} />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className={`lava-num ${gone ? "lava-num--burned" : ""}`}>
                  {n}
                </text>
              </g>
            );
          })}
          <circle r={R_BULL} className={`lava-slab lava-slab--bull ${burned.has(BULL) ? "lava-slab--gone" : ""}`} />
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central" className={`lava-num lava-num--bull ${burned.has(BULL) ? "lava-num--burned" : ""}`}>
            B
          </text>

          {hit?.outcome === "burn" && (
            <g key={`burn-${effectKey}`} transform={`translate(${ex} ${ey})`} aria-hidden>
              {EMBERS.map((i) => {
                const a = (i / EMBERS.length) * Math.PI * 2;
                return <circle key={i} r={5} className="lava-ember" style={{ "--dx": `${Math.cos(a) * 70}px`, "--dy": `${Math.sin(a) * 70 - 30}px`, animationDelay: `${i * 18}ms` } as React.CSSProperties} />;
              })}
            </g>
          )}
          {hit?.outcome === "lava" && (
            <g key={`shock-${effectKey}`} transform={`translate(${ex} ${ey})`} aria-hidden>
              <circle r={14} className="lava-shock" />
              <circle r={14} className="lava-shock lava-shock--late" />
            </g>
          )}

          {darts.map((d, k) =>
            d.section === 0 ? null : (
              <g key={`${k}-${d.section}`} transform={`translate(${centreOf(d.section, 160 - k * 18)[0]} ${centreOf(d.section, 160 - k * 18)[1]})`} aria-hidden>
                <g className="lava-dart">
                  <path d="M -9 -9 L 9 9 M 9 -9 L -9 9" className={d.outcome === "lava" ? "lava-dart-mark lava-dart-mark--lava" : "lava-dart-mark"} />
                </g>
              </g>
            ),
          )}

          {NUMBER_ORDER.map((n, i) => (
            <path
              key={`hit-${n}`}
              d={bedPath(R_SLAB_IN - 6, R_HIT_OUT, i)}
              className="lava-hit"
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={burned.has(n) ? `${sectionLabel(n)}, lava` : sectionLabel(n)}
              aria-disabled={disabled || undefined}
              onClick={() => !disabled && onPick(n)}
              onKeyDown={(e) => {
                if (!disabled && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onPick(n);
                }
              }}
            />
          ))}
          <circle
            r={R_SLAB_IN - 6}
            className="lava-hit"
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={burned.has(BULL) ? "Bull, lava" : "Bull"}
            aria-disabled={disabled || undefined}
            onClick={() => !disabled && onPick(BULL)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onPick(BULL);
              }
            }}
          />
        </svg>
      </div>
    </div>
  );
}
