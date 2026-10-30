"use client";

import { BULL, fieldKind, fieldNumber, sectionLabel, type LavaDart } from "@/lib/lava";

/** Clockwise from the top, as on a real board (same order as lib/dartboard.ts). */
const NUMBER_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const R_SLAB_IN = 46;
const R_SLAB_OUT = 214;
const R_HIT_OUT = 246;
const R_NUMBER = 235;
const R_BULL = 40;
const EMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const DROPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** Cracks in the rock round the pool: a main line out from the rim, and a thin branch, turned to where they sit. */
const CRACKS = [
  { a: 8, d: "M 0 -252 L 7 -266 L -4 -278 L 6 -291", b: "M 0 -270 L -14 -279" },
  { a: 47, d: "M 0 -252 L -6 -264 L 5 -276 L -2 -289", b: "M 2 -268 L 15 -276" },
  { a: 86, d: "M 0 -252 L 5 -262 L -5 -274 L 4 -288", b: "M -1 -266 L -13 -272" },
  { a: 128, d: "M 0 -252 L -7 -267 L 4 -279 L -3 -291", b: "M 3 -272 L 16 -283" },
  { a: 171, d: "M 0 -252 L 6 -265 L -5 -277 L 5 -290", b: "M -2 -269 L -15 -278" },
  { a: 214, d: "M 0 -252 L -5 -263 L 6 -275 L -4 -289", b: "M 1 -266 L 14 -272" },
  { a: 257, d: "M 0 -252 L 7 -266 L -3 -279 L 5 -291", b: "M -2 -271 L -16 -282" },
  { a: 301, d: "M 0 -252 L -6 -264 L 4 -277 L -2 -290", b: "M 2 -267 L 13 -275" },
  { a: 338, d: "M 0 -252 L 5 -265 L -6 -276 L 3 -289", b: "M -1 -270 L -14 -279" },
];
const BUBBLES = [
  { x: "34%", y: "30%", s: "9%", d: "0.4s", t: "5.6s" },
  { x: "58%", y: "62%", s: "7%", d: "2.1s", t: "6.4s" },
  { x: "24%", y: "58%", s: "6%", d: "3.4s", t: "5.2s" },
  { x: "66%", y: "26%", s: "8%", d: "1.2s", t: "7s" },
  { x: "46%", y: "74%", s: "6%", d: "4.6s", t: "6s" },
  { x: "74%", y: "50%", s: "7%", d: "0.9s", t: "6.8s" },
];

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

/** With doubles and trebles as sections: a wedge is four bands, the single (twice), the treble and the double. Without, one slab. */
const BANDS_RINGS: [number, number, "s" | "t" | "d"][] = [
  [R_SLAB_IN, 108, "s"],
  [108, 144, "t"],
  [144, 182, "s"],
  [182, R_SLAB_OUT, "d"],
];
const BANDS_PLAIN: [number, number, "s" | "t" | "d"][] = [[R_SLAB_IN, R_SLAB_OUT, "s"]];

/** The outline of a section (the bands it is made of, as one path). */
function fieldPath(section: number, rings: boolean): string {
  const i = NUMBER_ORDER.indexOf(fieldNumber(section));
  const kind = fieldKind(section);
  return (rings ? BANDS_RINGS.filter((b) => b[2] === kind) : BANDS_PLAIN).map(([a, b]) => bedPath(a, b, i)).join(" ");
}

/** Where a section is on the board: the middle of its slab. */
function centreOf(section: number, radius = 130, rings = false): [number, number] {
  if (section === BULL) return [0, 0];
  const kind = fieldKind(section);
  const r = rings ? (kind === "d" ? 198 : kind === "t" ? 126 : radius) : radius;
  return pointAt(r, NUMBER_ORDER.indexOf(fieldNumber(section)));
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
  rings = false,
}: {
  burned: Map<number, string>;
  effect: LavaDart | null;
  effectKey: number;
  darts: LavaDart[];
  onPick: (section: number) => void;
  disabled?: boolean;
  /** Party and up: the board shakes when a life goes, and there are embers drifting up. */
  big: boolean;
  /** Doubles and trebles are sections of their own: the wedges are drawn in bands. */
  rings?: boolean;
}) {
  const hit = effect && effect.section !== 0 ? effect : null;
  const [ex, ey] = hit ? centreOf(hit.section, 140, rings) : [0, 0];
  const bands = rings ? BANDS_RINGS : BANDS_PLAIN;
  const fieldIn = (n: number, kind: "s" | "t" | "d") => (kind === "t" ? 200 + n : kind === "d" ? 100 + n : n);

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
        <div className="lava-pool" aria-hidden>
          <div className="lava-tex lava-tex--a">
            <svg viewBox="-300 -300 600 600" preserveAspectRatio="none">
              <defs>
                <filter id="lava-tex-a" filterUnits="userSpaceOnUse" x="-300" y="-300" width="600" height="600">
                  <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="4" seed="11" />
                  <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
                  <feComponentTransfer>
                    <feFuncR type="table" tableValues="0.28 0.7 1 1 1" />
                    <feFuncG type="table" tableValues="0.02 0.12 0.5 0.85 1" />
                    <feFuncB type="table" tableValues="0 0 0.04 0.2 0.6" />
                  </feComponentTransfer>
                </filter>
              </defs>
              <rect x="-300" y="-300" width="600" height="600" filter="url(#lava-tex-a)" />
            </svg>
          </div>
          <div className="lava-tex lava-tex--b">
            <svg viewBox="-300 -300 600 600" preserveAspectRatio="none">
              <defs>
                <filter id="lava-tex-b" filterUnits="userSpaceOnUse" x="-300" y="-300" width="600" height="600">
                  <feTurbulence type="turbulence" baseFrequency="0.02 0.012" numOctaves="4" seed="4" />
                  <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
                  <feComponentTransfer>
                    <feFuncR type="table" tableValues="0 0.5 1 1" />
                    <feFuncG type="table" tableValues="0 0.1 0.6 1" />
                    <feFuncB type="table" tableValues="0 0 0.05 0.35" />
                  </feComponentTransfer>
                </filter>
              </defs>
              <rect x="-300" y="-300" width="600" height="600" filter="url(#lava-tex-b)" />
            </svg>
          </div>
        </div>
        {big && (
          <div className="lava-bubbles" aria-hidden>
            {BUBBLES.map((b, i) => (
              <span key={i} style={{ "--x": b.x, "--y": b.y, "--s": b.s, "--d": b.d, "--t": b.t } as React.CSSProperties} />
            ))}
          </div>
        )}
        <svg viewBox="-300 -300 600 600" className="lava-svg" role="group" aria-label="Brettet: trykk på feltet pila traff">
          <defs>
            <filter id="lava-grain" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1" result="g" />
              <feComposite in="g" in2="SourceGraphic" operator="in" result="gc" />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="gc" />
              </feMerge>
            </filter>
            <filter id="lava-rough" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="w" />
              <feDisplacementMap in="SourceGraphic" in2="w" scale="12" />
            </filter>
          </defs>
          <circle r={R_SLAB_OUT + 20} className="lava-rim" filter="url(#lava-rough)" />
          <circle r={R_SLAB_OUT + 4} className="lava-rim-edge" />
          {CRACKS.map((c, i) => (
            <g key={i} transform={`rotate(${c.a})`} aria-hidden>
              <path d={c.d} className="lava-crack" style={{ "--d": `${(i * 0.7) % 3.4}s` } as React.CSSProperties} />
              <path d={c.b} className="lava-crack lava-crack--thin" style={{ "--d": `${(i * 0.5 + 1) % 3.4}s` } as React.CSSProperties} />
            </g>
          ))}
          <g filter="url(#lava-grain)">
          {NUMBER_ORDER.map((n, i) => {
            const numberGone = burned.has(n);
            const [tx, ty] = pointAt(R_NUMBER, i);
            return (
              <g key={n}>
                {bands.map(([r0, r1, kind], b) => (
                  <path key={b} d={bedPath(r0, r1, i)} className={`lava-slab ${i % 2 ? "lava-slab--alt" : ""} ${burned.has(fieldIn(n, kind)) ? "lava-slab--gone" : ""} ${rings ? "lava-slab--band" : ""} ${kind !== "s" ? "lava-slab--ring" : ""}`} />
                ))}
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className={`lava-num ${numberGone ? "lava-num--burned" : ""}`}>
                  {n}
                </text>
              </g>
            );
          })}
          <circle r={R_BULL} className={`lava-slab lava-slab--bull ${burned.has(BULL) ? "lava-slab--gone" : ""}`} />
          </g>
          {!burned.has(BULL) && (
            <g aria-hidden>
              <circle r={26} className="lava-bull-ring" />
              <circle r={9} className="lava-bull-dot" />
            </g>
          )}
          {[...burned.keys()].filter((s) => s !== BULL).map((s) => (
            <path key={`edge-${s}`} d={fieldPath(s, rings)} className="lava-edge" aria-hidden />
          ))}
          {burned.has(BULL) && <circle r={R_BULL} className="lava-edge" aria-hidden />}

          {hit?.outcome === "burn" && (
            <g key={`burn-${effectKey}`} aria-hidden>
              {hit.section === BULL ? <circle r={R_BULL} className="lava-burst" /> : <path d={fieldPath(hit.section, rings)} className="lava-burst" />}
              <g transform={`translate(${ex} ${ey})`}>
                {EMBERS.map((i) => {
                  const a = (i / EMBERS.length) * Math.PI * 2 + 0.3;
                  const far = 60 + (i % 3) * 28;
                  return <circle key={i} r={i % 3 === 0 ? 7 : 4.5} className={`lava-ember ${i % 3 === 0 ? "lava-ember--big" : ""}`} style={{ "--dx": `${Math.cos(a) * far}px`, "--dy": `${Math.sin(a) * far - 55}px`, animationDelay: `${i * 22}ms` } as React.CSSProperties} />;
                })}
              </g>
            </g>
          )}
          {hit?.outcome === "lava" && (
            <g key={`shock-${effectKey}`} aria-hidden>
              <g transform={`translate(${ex} ${ey})`}>
                <circle r={14} className="lava-shock" />
                <circle r={14} className="lava-shock lava-shock--late" />
                {DROPS.map((i) => {
                  const a = -Math.PI / 2 + ((i - 5.5) / 12) * Math.PI * 1.5;
                  const far = 70 + (i % 4) * 22;
                  return <circle key={i} r={4 + (i % 3) * 1.6} className="lava-drop" style={{ "--dx": `${Math.cos(a) * far}px`, "--dy": `${Math.sin(a) * far}px`, animationDelay: `${(i % 4) * 25}ms` } as React.CSSProperties} />;
                })}
              </g>
              {big && (
                <text x={0} y={8} textAnchor="middle" dominantBaseline="central" className="lava-slam">
                  {hit.knockedOut ? "UTE!" : "LAVA!"}
                </text>
              )}
            </g>
          )}

          {/* A section that opened again as safe: a pulse of cool light where it is. */}
          {hit?.opened !== undefined && (
            <g key={`open-${effectKey}`} aria-hidden>
              {hit.opened === BULL ? <circle r={R_BULL} className="lava-reopen" /> : <path d={fieldPath(hit.opened, rings)} className="lava-reopen" />}
            </g>
          )}

          {darts.map((d, k) =>
            d.section === 0 ? null : (
              <g key={`${k}-${d.section}`} transform={`translate(${centreOf(d.section, 160 - k * 18, rings)[0]} ${centreOf(d.section, 160 - k * 18, rings)[1]})`} aria-hidden>
                <g className="lava-dart">
                  <path d="M -9 -9 L 9 9 M 9 -9 L -9 9" className={d.outcome === "lava" ? "lava-dart-mark lava-dart-mark--lava" : "lava-dart-mark"} />
                </g>
              </g>
            ),
          )}

          {NUMBER_ORDER.map((n, i) =>
            (rings
              ? ([
                  [R_SLAB_IN - 6, 108, "s", true],
                  [108, 144, "t", false],
                  [144, 182, "s", false],
                  [182, R_HIT_OUT, "d", false],
                ] as [number, number, "s" | "t" | "d", boolean][])
              : ([[R_SLAB_IN - 6, R_HIT_OUT, "s", false]] as [number, number, "s" | "t" | "d", boolean][])
            ).map(([r0, r1, kind, inner]) => {
              const field = fieldIn(n, kind);
              return (
                <path
                  key={`hit-${field}-${r0}`}
                  d={bedPath(r0, r1, i)}
                  className="lava-hit"
                  role="button"
                  // The inner single is the same section as the outer one: the outer carries the name.
                  tabIndex={disabled || inner ? -1 : 0}
                  aria-hidden={inner || undefined}
                  aria-label={burned.has(field) ? `${sectionLabel(field)}, lava` : sectionLabel(field)}
                  aria-disabled={disabled || undefined}
                  onClick={() => !disabled && onPick(field)}
                  onKeyDown={(e) => {
                    if (!disabled && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onPick(field);
                    }
                  }}
                />
              );
            }),
          )}
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
