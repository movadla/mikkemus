"use client";

import { STEPS, STEP_LABELS, type Step, type TurnAggregate } from "@/lib/game";
import { getPlayerRecord } from "@/lib/storage";
import { DartboardHeatmap } from "./DartboardHeatmap";

type LuckByStep = Record<Step, { mean: number | null; count: number }>;

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

function treffPct(stat?: TurnAggregate): number {
  if (!stat) return 0;
  const total = stat.hits + stat.misses;
  return total === 0 ? 0 : Math.round((stat.hits / total) * 100);
}

/** Every turn is 3 darts, so total darts = hits + misses across all turns. */
function totalDarts(stat?: TurnAggregate): number {
  if (!stat) return 0;
  return stat.hits + stat.misses;
}

// xG is an expected-crosses value (0-3, same unit the game scores in, like
// football xG) rather than a signed luck delta — always non-negative, so no
// "+" prefix or sign-based color; a plain neutral number instead.
function formatLuck(luck: number): string {
  return luck.toFixed(1);
}

/** Overall mean across all 10 sections, recovered from their per-section
 *  means+counts (a weighted average is exact here, since mean_i already
 *  equals sum_i/count_i) — same "one summary number above the per-section
 *  grid" pattern the player profile page uses for treffprosent. */
function overallMeanLuck(luckByStep: LuckByStep): number | null {
  let sum = 0;
  let count = 0;
  STEPS.forEach((step) => {
    const { mean, count: stepCount } = luckByStep[step];
    if (mean === null) return;
    sum += mean * stepCount;
    count += stepCount;
  });
  return count === 0 ? null : sum / count;
}

export function WinnerScreen({
  winner,
  players,
  stats,
  luckByPlayer,
  throwsByPlayer,
  onHome,
  homeLabel = "Hjem",
  onPlayAgain,
}: {
  winner: string;
  players: string[];
  stats: Record<string, TurnAggregate>;
  /** Mean "Expected Goals" per player this match, broken down per section
   *  (20-14, D, T, BULL) — null/0 for a section with no real Scolia darts to
   *  judge (bots are always all-null here — see MikkeMusApp's finalizeMatch).
   *  See lib/dartboard.ts. */
  luckByPlayer: Record<string, LuckByStep>;
  /** Every physical dart landed this match, per player — only populated when Scolia detected real throws. */
  throwsByPlayer: Record<string, [number, number][]>;
  onHome: () => void;
  /** Overridden by tournament mode to "Til turnering" — see MikkeMusApp's onMatchComplete prop. */
  homeLabel?: string;
  /** Starts a fresh match with the same roster — omitted in tournament mode, where onHome/
   *  homeLabel already handles "what's next" via "Til turnering". */
  onPlayAgain?: () => void;
}) {
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
              style={{
                width: "240px",
                height: "240px",
                borderRadius: "50%",
                background: "var(--color-gold)",
                filter: "blur(48px)",
              }}
            />
          </div>
          <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none z-10" aria-hidden>
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: c.left,
                  background: c.color,
                  animationDelay: c.delay,
                  "--r": c.rotate,
                } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="relative z-30 flex justify-center" style={{ marginBottom: "-44px" }}>
            <div
              className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{
                width: "88px",
                height: "88px",
                border: "4px solid var(--color-gold)",
                background: "var(--color-surface)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
              }}
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
            <p
              className="font-display"
              style={{
                color: "var(--color-bg)",
                fontSize: "1.05rem",
                fontStyle: "italic",
                letterSpacing: "0.04em",
                marginBottom: "0.4rem",
              }}
            >
              Vinner
            </p>
            <h2 className="font-display" style={{ color: "var(--color-bg)", fontSize: "2.2rem" }}>
              {winner}
            </h2>
            <p className="tabular" style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "0.85rem", marginTop: "0.4rem" }}>
              {totalDarts(stats[winner])} piler brukt
            </p>
          </div>
        </div>

        <div className="shadow-panel rounded-xl p-5 mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
            STATISTIKK — DENNE KAMPEN
          </p>
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p} className="flex justify-between items-center">
                <span style={{ color: "var(--color-cream)" }}>{p}</span>
                <span
                  className="tabular"
                  style={{
                    color: p === winner ? "var(--color-gold)" : "var(--color-cream)",
                    fontWeight: p === winner ? 600 : 400,
                  }}
                >
                  {treffPct(stats[p])}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {players.some((p) => STEPS.some((s) => luckByPlayer[p]?.[s].count > 0)) && (
          <div className="shadow-panel rounded-xl p-5 mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
              EXPECTED GOALS
            </p>
            <div className="space-y-4">
              {players
                .filter((p) => STEPS.some((s) => luckByPlayer[p]?.[s].count > 0))
                .map((p) => {
                  const luckByStep = luckByPlayer[p];
                  const overall = overallMeanLuck(luckByStep);
                  return (
                    <div key={p}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span style={{ color: "var(--color-cream)" }}>{p}</span>
                        <span className="tabular" style={{ color: "var(--color-gold-strong)", fontWeight: 600 }}>
                          {overall === null ? "–" : formatLuck(overall)}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {STEPS.map((s) => (
                          <div
                            key={s}
                            className="rounded-md py-1.5 text-center tabular"
                            style={{ background: "var(--color-cell)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 8px rgba(0,0,0,0.18)" }}
                          >
                            <p style={{ color: "var(--color-muted)", fontSize: "0.6rem" }}>{STEP_LABELS[s]}</p>
                            <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>
                              {luckByStep[s].count === 0 ? "–" : formatLuck(luckByStep[s].mean as number)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {players.some((p) => (throwsByPlayer[p]?.length ?? 0) > 0) && (
          <div className="shadow-panel rounded-xl p-5 mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
              KASTSPREDNING
            </p>
            <div className="space-y-4">
              {players
                .filter((p) => (throwsByPlayer[p]?.length ?? 0) > 0)
                .map((p) => (
                  <div key={p}>
                    <p className="mb-1" style={{ color: "var(--color-cream)", fontSize: "0.8rem" }}>
                      {p}
                    </p>
                    <div className="max-w-[220px] mx-auto">
                      <DartboardHeatmap throws={throwsByPlayer[p]} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {onPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            className={`glossy w-full py-4 rounded-lg font-semibold text-lg mb-3 ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
          >
            Spill igjen
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className={
            onPlayAgain
              ? `tactile w-full py-4 rounded-lg font-semibold text-lg ${FOCUS_RING}`
              : `glossy w-full py-4 rounded-lg font-semibold text-lg ${FOCUS_RING}`
          }
          style={
            onPlayAgain
              ? { background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }
              : ({ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties)
          }
        >
          {homeLabel}
        </button>
      </div>
    </div>
  );
}
