"use client";

import { Fragment } from "react";
import type { BullDuelState } from "@/lib/bullDuel";
import { getPlayerRecord } from "@/lib/storage";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const CONFETTI = [
  { left: "6%", rotate: "-18deg", delay: "0ms", color: "var(--color-gold)" },
  { left: "16%", rotate: "24deg", delay: "90ms", color: "var(--color-cream)" },
  { left: "26%", rotate: "-8deg", delay: "180ms", color: "var(--color-gold-strong)" },
  { left: "36%", rotate: "32deg", delay: "40ms", color: "var(--color-cream)" },
  { left: "46%", rotate: "-26deg", delay: "220ms", color: "var(--color-gold)" },
  { left: "56%", rotate: "14deg", delay: "120ms", color: "var(--color-gold-strong)" },
  { left: "64%", rotate: "-30deg", delay: "10ms", color: "var(--color-cream)" },
  { left: "72%", rotate: "20deg", delay: "200ms", color: "var(--color-gold)" },
  { left: "80%", rotate: "-14deg", delay: "70ms", color: "var(--color-cream)" },
  { left: "88%", rotate: "28deg", delay: "160ms", color: "var(--color-gold-strong)" },
  { left: "94%", rotate: "-22deg", delay: "260ms", color: "var(--color-gold)" },
  { left: "50%", rotate: "8deg", delay: "300ms", color: "var(--color-cream)" },
];

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

  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md text-center">
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
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{ left: c.left, background: c.color, animationDelay: c.delay, "--r": c.rotate } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="relative z-30 flex justify-center" style={{ marginBottom: "-44px" }}>
            <div
              className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
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
          <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
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
              TREFF
            </span>
            <span className="text-right" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              %
            </span>
            <span className="text-right" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              XG
            </span>
            {duel.players.map((p) => {
              const stats = duel.stats[p];
              const pct = stats.throws === 0 ? null : Math.round((stats.hits / stats.throws) * 100);
              const luck = stats.luckCount === 0 ? null : stats.luckSum / stats.luckCount;
              return (
                <Fragment key={p}>
                  <span style={{ color: p === winner ? "var(--color-gold)" : "var(--color-cream)", fontWeight: p === winner ? 600 : 400 }}>
                    {p}
                  </span>
                  <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>
                    {stats.throws}
                  </span>
                  <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>
                    {stats.hits}
                  </span>
                  <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>
                    {pct === null ? "–" : `${pct}%`}
                  </span>
                  <span className="tabular text-right" style={{ color: luck === null ? "var(--color-muted)" : "var(--color-gold-strong)" }}>
                    {luck === null ? "–" : formatLuck(luck)}
                  </span>
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
