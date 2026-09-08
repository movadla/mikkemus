"use client";

import { Fragment, useMemo, useState } from "react";
import type { BullDuelState } from "@/lib/bullDuel";
import { getPlayerRecord } from "@/lib/storage";
import { generateConfetti, generateConfettiRain } from "@/lib/confetti";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const CONFETTI_COUNT = 40;
const RAIN_COUNT = 90;

// xG is an expected-points value (0-2, same unit the game scores in, like
// football xG) rather than a signed luck delta — always non-negative, so
// no "+" prefix.
function formatLuck(luck: number): string {
  return luck.toFixed(1);
}

export function BullDuelWinnerScreen({
  duel,
  onHome,
  onPlayAgain,
}: {
  duel: BullDuelState;
  onHome: () => void;
  onPlayAgain: () => void;
}) {
  const winner = duel.winner as string;
  const photo = getPlayerRecord(winner)?.photo;
  const [expanded, setExpanded] = useState<string | null>(null);
  const confetti = useMemo(() => generateConfetti(CONFETTI_COUNT), []);
  const rain = useMemo(() => generateConfettiRain(RAIN_COUNT), []);

  return (
    <div className="animate-screen-enter relative min-h-screen w-full flex items-center justify-center p-6 overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* Full-screen rain behind the card — see WinnerScreen for the same treatment. */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
        {rain.map((c, i) => (
          <span
            key={i}
            className="confetti-rain"
            style={
              {
                left: c.left,
                width: c.width,
                height: c.height,
                background: c.color,
                animationDelay: c.delay,
                animationDuration: c.duration,
                "--r": c.rotate,
                "--fall": c.fall,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="relative">
          <div
            className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
            style={{ transform: "translateY(-10%)" }}
            aria-hidden
          >
            <div
              className="animate-idle-glow"
              style={{ width: "240px", height: "240px", borderRadius: "50%", background: "var(--color-gold)", filter: "blur(48px)" }}
            />
          </div>
          <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none z-10" aria-hidden>
            {confetti.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{ left: c.left, background: c.color, animationDelay: c.delay, "--r": c.rotate } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="relative z-30 flex justify-center" style={{ marginBottom: "-44px" }}>
            <div
              className="animate-winner-photo-pulse rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ width: "88px", height: "88px", border: "4px solid var(--color-gold)", background: "var(--color-surface)", boxShadow: "0 6px 16px rgba(0,0,0,0.45)" }}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display" style={{ color: "var(--color-gold)", fontSize: "2rem" }}>
                  {winner.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div className="animate-winner-pop card-gold shadow-panel relative z-20 rounded-2xl pt-14 pb-8 px-8 mb-6">
            <p className="font-display" style={{ color: "var(--color-bg)", fontSize: "1.05rem", fontStyle: "italic", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
              Vinner
            </p>
            <h2 className="font-display" style={{ color: "var(--color-bg)", fontSize: "2.2rem" }}>
              {winner}
            </h2>
            <p className="tabular" style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "0.85rem", marginTop: "0.4rem" }}>
              {duel.points[winner]} / {duel.target} poeng
            </p>
          </div>
        </div>

        <div className="shadow-panel rounded-xl p-5 mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-3 section-label">
            BULL-DUELL — DENNE KAMPEN
          </p>
          <div
            className="grid gap-x-2 gap-y-3 text-left"
            style={{ gridTemplateColumns: "1fr repeat(4, auto)" }}
          >
            <span style={{ color: "var(--color-muted)", fontSize: "0.7rem" }} />
            <span className="text-right" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              KAST
            </span>
            <span className="text-right" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              POENG
            </span>
            <span className="text-right" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              %
            </span>
            <span className="text-right" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              XG
            </span>
            {duel.players.map((p) => {
              const stats = duel.stats[p];
              const hits = stats.redHits + stats.greenHits;
              const pct = stats.throws === 0 ? null : Math.round((hits / stats.throws) * 100);
              const luck = stats.luckCount === 0 ? null : stats.luckSum / stats.luckCount;
              const isExpanded = expanded === p;
              return (
                <Fragment key={p}>
                  {/* display:contents keeps these cells as direct grid items while still
                      giving the whole row one click/keyboard target for the drilldown. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(isExpanded ? null : p)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      setExpanded(isExpanded ? null : p);
                    }}
                    // Not FOCUS_RING: an outline on a display:contents element is never
                    // painted, since it generates no box. .row-focus draws the ring on the
                    // cells instead — see globals.css.
                    className="row-focus"
                    style={{ display: "contents", cursor: "pointer" }}
                  >
                    <span style={{ color: p === winner ? "var(--color-gold)" : "var(--color-cream)", fontWeight: p === winner ? 600 : 400 }}>
                      {p}
                    </span>
                    <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>
                      {stats.points}
                    </span>
                    <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>
                      {pct === null ? "–" : `${pct}%`}
                    </span>
                    <span className="tabular text-right" style={{ color: luck === null ? "var(--color-muted)" : "var(--color-gold-strong)" }}>
                      {luck === null ? "–" : formatLuck(luck)}
                    </span>
                  </div>
                  {isExpanded && (
                    <div
                      className="tabular text-left flex items-center gap-3"
                      style={{ gridColumn: "1 / -1", fontSize: "0.78rem", color: "var(--color-muted)", paddingBottom: "0.15rem" }}
                    >
                      <span className="flex items-center gap-1">
                        <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: "var(--color-red)", display: "inline-block" }} />
                        {stats.redHits} rød
                      </span>
                      <span className="flex items-center gap-1">
                        <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: "var(--color-green)", display: "inline-block" }} />
                        {stats.greenHits} grønn
                      </span>
                      <span>· {stats.throws} kast</span>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          className={`glossy w-full py-4 rounded-lg font-semibold text-lg mb-3 ${FOCUS_RING}`}
          style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
        >
          Spill igjen
        </button>
        <button
          type="button"
          onClick={onHome}
          className={`tactile w-full py-4 rounded-lg font-semibold text-lg ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
        >
          Hjem
        </button>
      </div>
    </div>
  );
}
