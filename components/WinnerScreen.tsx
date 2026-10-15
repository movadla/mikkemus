"use client";

import { useMemo, useState } from "react";
import { STEPS, STEP_LABELS, totalMarks, type PlayerProgress, type Step, type TurnAggregate, type TurnResult } from "@/lib/game";
import { getRules } from "@/lib/rules";
import { buildMatchFacts } from "@/lib/matchSummary";
import { MatchSummary } from "./MatchSummary";
import { TeamKit } from "./TeamKit";
import type { Kit } from "@/lib/teamKit";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { RaceChart } from "./RaceChart";
import { getPlayerRecord } from "@/lib/storage";
import { generateConfetti, generateConfettiRain } from "@/lib/confetti";
import { DartboardHeatmap } from "./DartboardHeatmap";

type LuckByStep = Record<Step, { sum: number; count: number }>;

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const CONFETTI_COUNT = 40;
const RAIN_COUNT = 90;

function treffPct(stat?: TurnAggregate): number {
  if (!stat) return 0;
  const total = stat.hits + stat.misses;
  return total === 0 ? 0 : Math.round((stat.hits / total) * 100);
}

/** Darts actually thrown. Not hits + misses: hits counts crosses, so a triple inflated that by
 *  two throws that never happened, and a leg won on the first dart of a turn still billed three. */
function totalDarts(stat?: TurnAggregate): number {
  if (!stat) return 0;
  return stat.darts;
}

// xG is an expected-crosses value (0-3, same unit the game scores in, like
// football xG) rather than a signed luck delta — always non-negative, so no
// "+" prefix or sign-based color; a plain neutral number instead.
function formatLuck(luck: number): string {
  return luck.toFixed(1);
}

/** Sum across all 10 sections' own sums — a total, not an average, so it's directly
 *  comparable to the match's actual total crosses (see the "forventet / faktisk" display
 *  below) the same way the career stat's own sum is comparable to `overall.hits`. */
function overallSumLuck(luckByStep: LuckByStep): number | null {
  let sum = 0;
  let count = 0;
  STEPS.forEach((step) => {
    sum += luckByStep[step].sum;
    count += luckByStep[step].count;
  });
  return count === 0 ? null : sum;
}

export function WinnerScreen({
  winner,
  players,
  stats,
  luckByPlayer,
  throwsByPlayer,
  preBankedByPlayer,
  onHome,
  homeLabel = "Hjem",
  onPlayAgain,
  onNewMatch,
  onUndoWin,
  turnLogByPlayer,
  progressByPlayer,
  winnerKit = null,
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
  /**
   * D/T crosses each player banked as slengere, i.e. while a number was the active step. xH
   * judges every dart against the active step, so those crosses fall outside its accounting
   * and the faktisk side leaves them out too: "xH 2,4 / 1" on T means the player needed one
   * more triple once they got there, and that is what 2,4 is compared against.
   */
  preBankedByPlayer: Record<string, { D: number; T: number }>;
  /** Every confirmed turn per player, in order — the race chart is drawn from these. */
  turnLogByPlayer: Record<string, TurnResult[]>;
  /** Where every player's board stood when the match ended — what the summary says about who got stuck. */
  progressByPlayer: PlayerProgress;
  /** The winning team's shirt, when the winner is a team — shown where a person's photo would be. */
  winnerKit?: Kit | null;
  onHome: () => void;
  /** Overridden by tournament mode to "Til turnering" — see MikkeMusApp's onMatchComplete prop. */
  homeLabel?: string;
  /** Starts a fresh match with the same roster — omitted in tournament mode, where onHome/
   *  homeLabel already handles "what's next" via "Til turnering". */
  onPlayAgain?: () => void;
  /** A new match with other people, through the setup screen — also omitted in tournament mode. */
  onNewMatch?: () => void;
  /** Takes the last cross back and returns to the board — for when Scolia read a bounce-out or a
   *  wire as the winning dart. Omitted where there is nothing to go back to. */
  onUndoWin?: () => void;
}) {
  const photo = getPlayerRecord(winner)?.photo;
  const winnerLuck = luckByPlayer[winner] ? overallSumLuck(luckByPlayer[winner]) : null;
  // The celebration follows the chosen level (see lib/fxLevel.ts): none at Vanlig, the usual at
  // Party, twice the rain at Full party. The rest of the screen is the same at every level.
  const fx = fxFlags(useFxLevel());
  const confettiCount = fx.confetti ? CONFETTI_COUNT * (fx.bigConfetti ? 2 : 1) : 0;
  const rainCount = fx.confetti ? RAIN_COUNT * (fx.bigConfetti ? 2 : 1) : 0;
  // What the summary is written from — rebuilt only when the match itself changes.
  const facts = useMemo(
    () =>
      players.includes(winner)
        ? buildMatchFacts({ players, winner, turnLog: turnLogByPlayer, finalProgress: progressByPlayer, target: getRules().target })
        : null,
    [players, winner, turnLogByPlayer, progressByPlayer],
  );
  const confetti = useMemo(() => generateConfetti(confettiCount), [confettiCount]);
  const rain = useMemo(() => generateConfettiRain(rainCount), [rainCount]);
  // The finer statistics (xH per row, where the darts landed) only exist with a board that
  // reports coordinates, and even then they are for the ones who scroll for them: the screen
  // was 2 198 px tall with everything open.
  const hasScoliaData =
    players.some((p) => STEPS.some((s) => (luckByPlayer[p]?.[s].count ?? 0) > 0)) ||
    players.some((p) => (throwsByPlayer[p]?.length ?? 0) > 0);
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="animate-winner-slam relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* The blown-out first frame. Above everything, pointer-transparent, gone in 620ms. */}
      <div
        className="animate-winner-flash absolute inset-0 pointer-events-none z-50"
        style={{ background: "var(--color-gold)" }}
        aria-hidden
      />

      {/* Deliberately small and out of the way. A misread bounce-out shouldn't cost the leg,
          but this is also the one control here that throws the celebration away — it should
          take looking for, not sit next to "Spill igjen" where a thumb finds it by accident. */}
      {onUndoWin && (
        <button
          type="button"
          onClick={onUndoWin}
          title="Angre siste pil og gå tilbake til brettet"
          className={`absolute top-4 right-4 z-40 px-4 rounded-lg ${FOCUS_RING}`}
          style={{
            minHeight: "2.75rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
            fontSize: "0.75rem",
          }}
        >
          ↩ Angre
        </button>
      )}
      {/* Rain across the whole screen, behind the card — the burst above the winner card
          stays as its own accent on top of this. */}
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
            {confetti.map((c, i) => (
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
          {/* The winner's face is the headline, not a token next to their name — at 88px it was
              smaller than the name under it. Its lower half overlaps the card below, so the
              card's top padding has to clear the same 84px the negative margin pulls up. */}
          <div className="relative z-30 flex justify-center" style={{ marginBottom: "-84px" }}>
            <div className="relative" style={{ width: "168px", height: "168px" }}>
              <span
                aria-hidden
                className="animate-winner-shockwave absolute inset-0 rounded-full pointer-events-none"
                style={{ border: "3px solid var(--color-gold)" }}
              />
              <div
                className="animate-winner-photo-pulse rounded-full overflow-hidden flex items-center justify-center w-full h-full"
                style={{
                  border: "5px solid var(--color-gold)",
                  background: "var(--color-surface)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.55), 0 0 40px rgba(201, 162, 75, 0.35)",
                }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={winner} className="w-full h-full object-cover" />
                ) : winnerKit ? (
                  // A winning team has no face of its own: its shirt is the headline instead.
                  <TeamKit kit={winnerKit} size={112} title={`Drakten til ${winner}`} />
                ) : (
                  <span className="font-display" style={{ color: "var(--color-gold)", fontSize: "4rem" }}>
                    {winner.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="animate-winner-pop card-gold shadow-panel relative z-20 rounded-2xl pt-24 pb-8 px-8 mb-6">
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
            {/* xH belongs up here, not only in a card three scrolls down — it is the one number
                that says whether the win was thrown or fell out of the sky. Omitted rather than
                dashed when no dart could be judged; a "–" beside the headline reads as broken. */}
            <p className="tabular" style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "0.85rem", marginTop: "0.4rem" }}>
              {/* Singular is reachable now that a leg won on the first dart of a turn counts one. */}
              {totalDarts(stats[winner])} {totalDarts(stats[winner]) === 1 ? "pil" : "piler"} brukt
              {winnerLuck !== null && <> · xH {formatLuck(winnerLuck)} /{" "}
            {(stats[winner]?.hits ?? 0) - (preBankedByPlayer[winner]?.D ?? 0) - (preBankedByPlayer[winner]?.T ?? 0)}</>}
            </p>
          </div>
        </div>

        {/* What people read first, and often all they read: hit percentage and darts, side by side
            for everyone. The charts and the finer statistics are further down, for those who
            keep scrolling. */}
        <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">
            STATISTIKK — DENNE KAMPEN
          </p>
          <div role="table" aria-label="Statistikk for kampen">
            <div
              role="row"
              className="grid items-end pb-1"
              style={{ gridTemplateColumns: "minmax(0, 1fr) 4.2rem 4.2rem", color: "var(--color-label)", fontSize: "0.75rem", letterSpacing: "0.1em" }}
            >
              <span role="columnheader" />
              <span role="columnheader" className="text-right">TREFF</span>
              <span role="columnheader" className="text-right">PILER</span>
            </div>
            <div className="space-y-2">
              {players.map((p) => (
                <div
                  key={p}
                  role="row"
                  className="grid items-baseline"
                  style={{
                    gridTemplateColumns: "minmax(0, 1fr) 4.2rem 4.2rem",
                    color: p === winner ? "var(--color-gold)" : "var(--color-cream)",
                    fontWeight: p === winner ? 600 : 400,
                  }}
                >
                  <span role="cell" className="truncate">{p}</span>
                  <span role="cell" className="tabular text-right font-display" style={{ fontSize: "1.4rem" }}>
                    {treffPct(stats[p])}%
                  </span>
                  <span role="cell" className="tabular text-right font-display" style={{ fontSize: "1.4rem" }}>
                    {totalDarts(stats[p])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <MatchSummary facts={facts} />

        {/* The match as a race — who led when, and by how much. */}
        <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">LEDELSE RUNDE FOR RUNDE</p>
          <RaceChart players={players} turnLog={turnLogByPlayer} winner={winner} total={totalMarks()} />
        </div>

        {hasScoliaData && !showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={`tactile w-full rounded-lg text-sm mb-4 ${FOCUS_RING}`}
            style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            Mer statistikk
          </button>
        )}
        {hasScoliaData && showMore && (
          <>
        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">FORVENTEDE TREFF</p>
          {!players.some((p) => STEPS.some((s) => luckByPlayer[p]?.[s].count > 0)) ? (
            <p style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.45 }}>
              Ingen piler i denne kampen kunne bedømmes. xH regnes ut fra koordinatene til
              hvert kast, så manuelt registrerte piler teller ikke — det kreves at Scolia var
              tilkoblet.
            </p>
          ) : (
            <div className="space-y-4">
              {players
                .filter((p) => STEPS.some((s) => luckByPlayer[p]?.[s].count > 0))
                .map((p) => {
                  const luckByStep = luckByPlayer[p];
                  const overall = overallSumLuck(luckByStep);
                  const actualTotal =
                    (stats[p]?.hits ?? 0) - (preBankedByPlayer[p]?.D ?? 0) - (preBankedByPlayer[p]?.T ?? 0);
                  return (
                    <div key={p}>
                      <div className="flex justify-between items-center mb-2">
                        <span style={{ color: "var(--color-cream)" }}>{p}</span>
                        <span className="tabular" style={{ color: "var(--color-gold-strong)", fontWeight: 600 }}>
                          {overall === null ? "–" : `${formatLuck(overall)} / ${actualTotal}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {STEPS.map((s) => {
                          // What the row compares against: crosses won while ON this step. For D
                          // and T that is the total minus the slengere banked beforehand, and the
                          // denominator shrinks to match — "/1" when the player arrived needing one.
                          const pre = s === "D" || s === "T" ? (preBankedByPlayer[p]?.[s] ?? 0) : 0;
                          const phaseGained = (stats[p]?.hitsByStep[s] ?? 0) - pre;
                          const needed = getRules().target - pre;
                          return (
                            <div
                              key={s}
                              className="cell-tile rounded-md py-2 text-center tabular section-label">
                              <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{STEP_LABELS[s]}</p>
                              <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>
                                {/* The actual count is only worth printing when it isn't the
                                    3 that closing a field always means — for the winner that
                                    is every field, so it was pure noise. A loser's unfinished
                                    fields still show theirs, where the number says something. */}
                                {luckByStep[s].count === 0
                                  ? "–"
                                  : phaseGained >= needed
                                    ? needed === getRules().target
                                      ? formatLuck(luckByStep[s].sum)
                                      : `${formatLuck(luckByStep[s].sum)}/${needed}`
                                    : `${formatLuck(luckByStep[s].sum)}/${phaseGained}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {players.some((p) => (throwsByPlayer[p]?.length ?? 0) > 0) && (
          <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">
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
          </>
        )}

        {/* After a single match there are three things to do next, in the order people want them:
            the same people again, other people, or leave. In tournament mode there is only one —
            back to the tournament — and it is the main button. */}
        {onPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            className={`glossy w-full rounded-xl font-semibold text-lg mb-2 ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "3.25rem" } as React.CSSProperties}
          >
            Revansj
          </button>
        )}
        {onNewMatch && (
          <button
            type="button"
            onClick={onNewMatch}
            className={`tactile w-full rounded-xl font-semibold text-lg mb-2 ${FOCUS_RING}`}
            style={{ minHeight: "3.25rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            Ny kamp
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className={
            onPlayAgain
              ? `tactile w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`
              : `glossy w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`
          }
          style={
            onPlayAgain
              ? { minHeight: "3.25rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }
              : ({ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "3.25rem" } as React.CSSProperties)
          }
        >
          {homeLabel}
        </button>
      </div>
    </div>
  );
}
