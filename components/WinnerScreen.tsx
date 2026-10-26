"use client";

import { ViewTransition, startTransition, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./ui/Avatar";
import { ChartFrame } from "./ui/ChartFrame";
import { Segmented } from "./ui/Segmented";
import { useAccess } from "@/lib/access";
import { STEPS, STEP_LABELS, totalMarks, type PlayerProgress, type Step, type TurnAggregate, type TurnResult } from "@/lib/game";
import { getRules } from "@/lib/rules";
import { buildMatchFacts } from "@/lib/matchSummary";
import { bestWinDarts } from "@/lib/bestWin";
import { throwerStats } from "@/lib/turnStats";
import { MatchSummary } from "./MatchSummary";
import { TeamKit } from "./TeamKit";
import type { Kit } from "@/lib/teamKit";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { RaceChart } from "./RaceChart";
import { getPlayerRecord } from "@/lib/storage";
import { generateConfetti, generateConfettiRain } from "@/lib/confetti";
import { DartboardHeatmap } from "./DartboardHeatmap";
import { ShirtRain } from "./ShirtRain";
import { Trophy } from "./Trophy";
import { TimeMachine } from "./TimeMachine";
import { RatingCard } from "./RatingCard";
import { ReplayCard } from "./ReplayCard";
import { AwardsCard, OddsChart, RowCostCard, buildAwards } from "./MatchInsights";
import type { OddsSnapshot } from "@/lib/oddsLog";

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
  statsOff = false,
  onToggleStats,
  archive = false,
  turnLogByPlayer,
  progressByPlayer,
  winnerKit = null,
  oddsHistory = [],
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
  /** What the odds said after every turn, for the chart of how the match turned. */
  oddsHistory?: OddsSnapshot[];
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
  /** The match does not count in the statistics. */
  statsOff?: boolean;
  /** Takes the match out of the statistics, or puts it back. Nothing is written until the screen is left. */
  onToggleStats?: () => void;
  /** An old match opened from the list: the same page, without the celebration, the rating and what belongs to the moment. */
  archive?: boolean;
}) {
  // The extra statistics under the result are not for the limited code.
  const { limited } = useAccess();
  const photo = getPlayerRecord(winner)?.photo;
  const winnerLuck = luckByPlayer[winner] ? overallSumLuck(luckByPlayer[winner]) : null;
  // The celebration follows the chosen level (see lib/fxLevel.ts): none at Vanlig, the usual at
  // Party, twice the rain at Full party. The rest of the screen is the same at every level.
  const chosenLevel = useFxLevel();
  const fx = fxFlags(archive ? "normal" : chosenLevel);
  // A winning team celebrates with its own shirts (ShirtRain) instead of the generic confetti.
  const shirts = !!winnerKit && fx.shirtRain;
  const confettiCount = fx.confetti && !shirts ? CONFETTI_COUNT * (fx.bigConfetti ? 2 : 1) : 0;
  const rainCount = fx.confetti && !shirts ? RAIN_COUNT * (fx.bigConfetti ? 2 : 1) : 0;
  // What the summary is written from — rebuilt only when the match itself changes.
  const facts = useMemo(
    () =>
      players.includes(winner)
        ? buildMatchFacts({ players, winner, turnLog: turnLogByPlayer, finalProgress: progressByPlayer, target: getRules().target })
        : null,
    [players, winner, turnLogByPlayer, progressByPlayer],
  );
  // The last turn played back from where the darts really landed — only when every dart of it has a
  // position (a board that reports them), so the replay never shows a made-up dart.
  // Every thrower of a team match side by side, highest hit percentage first (more darts first on a tie, since a
  // percentage over more darts says more). Empty unless a side is a team — a lone-player match has nothing to compare here.
  const teamRanking = useMemo(() => {
    const rows = players.flatMap((p) => {
      const throwers = throwerStats(turnLogByPlayer[p] ?? [], p);
      return throwers.map((r) => ({ team: p, name: r.name, hitPct: r.hitPct, darts: r.darts, isMember: r.name !== p }));
    });
    return rows.some((r) => r.isMember) ? rows.filter((r) => r.darts > 0).sort((a, b) => b.hitPct - a.hitPct || b.darts - a.darts) : [];
  }, [players, turnLogByPlayer]);

  const lastTurn = [...(turnLogByPlayer[winner] ?? [])].filter(Boolean).at(-1);
  const lastDarts = lastTurn?.darts ?? 0;
  const winnerThrows = throwsByPlayer[winner] ?? [];
  const replayThrows = fx.replay && lastDarts > 0 && winnerThrows.length >= lastDarts ? winnerThrows.slice(-lastDarts) : null;
  // Personal records this match beat. The stored record is only updated when the win is accepted, so
  // at this point it is still the old one to compare with — and a first-ever value is no record.
  const newRecords = fx.recordBanner
    ? players.flatMap((p) => {
        const held = getPlayerRecord(p);
        if (!held) return [];
        const out: string[] = [];
        const run = Math.max(0, ...throwerStats(turnLogByPlayer[p] ?? [], p).map((r) => r.bestRun)) * 3;
        if (held.bestRun && run > held.bestRun) out.push(`${p}: lengste serie, ${run} piler`);
        const bestWin = bestWinDarts(held);
        if (p === winner && bestWin && stats[p] && stats[p].darts < bestWin) out.push(`${p}: færrest piler, ${stats[p].darts}`);
        return out;
      })
    : [];
  const awards = buildAwards({
    players,
    winner,
    stats,
    turnLog: turnLogByPlayer,
    expected: Object.fromEntries(players.map((p) => [p, luckByPlayer[p] ? overallSumLuck(luckByPlayer[p]) : null])),
    banked: Object.fromEntries(players.map((p) => [p, (preBankedByPlayer[p]?.D ?? 0) + (preBankedByPlayer[p]?.T ?? 0)])),
  });
  const confetti = useMemo(() => generateConfetti(confettiCount), [confettiCount]);
  const rain = useMemo(() => generateConfettiRain(rainCount), [rainCount]);
  // The finer statistics (xH per row, where the darts landed) only exist with a board that
  // reports coordinates, and even then they are for the ones who scroll for them: the screen
  // was 2 198 px tall with everything open.
  const hasScoliaData =
    players.some((p) => STEPS.some((s) => (luckByPlayer[p]?.[s].count ?? 0) > 0)) ||
    players.some((p) => (throwsByPlayer[p]?.length ?? 0) > 0);
  const [showMore, setShowMore] = useState(false);
  const [tab, setTab] = useState<"oppsummering" | "statistikk" | "replay">("oppsummering");
  const compact = tab !== "oppsummering";

  // The way on, fixed to the window. It is drawn into the body: the screen above animates with a transform, and a fixed child of a
  // transformed element is fixed to that element, not to the window.
  const actionBarEl = (
    <div className="fixed left-0 right-0 bottom-0 z-40 px-4" style={{ background: "var(--glass)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--color-hairline)", paddingTop: "0.75rem", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto max-w-md grid gap-2" style={{ gridTemplateColumns: [onPlayAgain, onNewMatch, true].filter(Boolean).length === 3 ? "1.5fr 1fr 1fr" : [onPlayAgain, onNewMatch, true].filter(Boolean).length === 2 ? "1.5fr 1fr" : "1fr" }}>
    {onPlayAgain && (
      <button
        type="button"
        onClick={onPlayAgain}
        className={`glossy w-full rounded-xl font-semibold text-lg  ${FOCUS_RING}`}
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}
      >
        Revansj
      </button>
    )}
    {onNewMatch && (
      <button
        type="button"
        onClick={onNewMatch}
        className={`tactile w-full rounded-xl font-semibold text-lg  ${FOCUS_RING}`}
        style={{ minHeight: "var(--control-lg)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
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
          ? { minHeight: "var(--control-lg)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }
          : ({ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties)
      }
    >
      {homeLabel}
    </button>
      </div>
    </div>
  );
  const actionBar = typeof document === "undefined" ? actionBarEl : createPortal(actionBarEl, document.body);

  return (
    <div className="animate-winner-slam relative min-h-screen w-full flex items-start justify-center p-4 overflow-hidden"  style={{ background: "var(--color-bg)" }}>
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
            minHeight: "var(--control)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
            fontSize: "var(--text-micro)",
          }}
        >
          ↩ Angre
        </button>
      )}
      {/* Rain across the whole screen, behind the card — the burst above the winner card
          stays as its own accent on top of this. */}
      {shirts && winnerKit && <ShirtRain kit={winnerKit} heavy={fx.bigConfetti} />}
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
      <div className="relative z-10 w-full max-w-md text-center" style={{ paddingBottom: "7rem" }}>
        {/* The winner's card is one thing that changes size: all of it on the first tab, and a slim bar once the numbers or the replay
            are open, so they get the room. Both carry the same transition name, so the card is seen shrinking into the bar. */}
        {compact ? (
          <ViewTransition name="winner-card" share="morph" default="none">
            <div className="card-gold card-gold-pad flex items-center gap-3 mb-4 text-left">
              {winnerKit ? <TeamKit kit={winnerKit} size={44} title={`Drakten til ${winner}`} /> : <Avatar name={winner} photo={photo} size="m" state="winner" />}
              <div className="min-w-0 flex-1">
                <p style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "var(--text-micro)", fontWeight: 700, letterSpacing: "0.12em" }}>VINNER</p>
                <p className="font-display truncate" style={{ color: "var(--color-bg)", fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                  {winner}
                </p>
              </div>
              <span className="tabular shrink-0" style={{ color: "var(--color-bg)", opacity: 0.75, fontSize: "var(--text-small)" }}>
                {totalDarts(stats[winner])} {totalDarts(stats[winner]) === 1 ? "pil" : "piler"}
              </span>
            </div>
          </ViewTransition>
        ) : (
          <ViewTransition name="winner-card" share="morph" default="none">
            <div>
            {/* The trophy rises above the winner; a team's own shirts rain instead of confetti cannons. */}
            {fx.trophy && <Trophy cannons={!shirts} />}
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
                      boxShadow: "0 10px 30px var(--scrim-soft), 0 0 40px color-mix(in srgb, var(--color-gold) 35%, transparent)",
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
                    fontSize: "var(--text-body)",
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
                <p className="tabular" style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "var(--text-small)", marginTop: "0.4rem" }}>
                  {/* Singular is reachable now that a leg won on the first dart of a turn counts one. */}
                  {totalDarts(stats[winner])} {totalDarts(stats[winner]) === 1 ? "pil" : "piler"} brukt
                  {winnerLuck !== null && <> · xH {formatLuck(winnerLuck)} /{" "}
                {(stats[winner]?.hits ?? 0) - (preBankedByPlayer[winner]?.D ?? 0) - (preBankedByPlayer[winner]?.T ?? 0)}</>}
                </p>
              </div>
            </div>
            </div>
          </ViewTransition>
        )}

        {newRecords.length > 0 && (
          <div className="animate-winner-pop rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "linear-gradient(90deg, #e6bd57, #f3d98a)", color: "#2b2000" }} role="status">
            <svg viewBox="0 0 32 24" width="36" height="28" aria-hidden>
              <path d="M2 20 L5 6 L11 13 L16 3 L21 13 L27 6 L30 20Z" fill="#2b2000" />
            </svg>
            <div>
              <p style={{ fontSize: "var(--text-micro)", letterSpacing: "0.14em", fontWeight: 700 }}>NY REKORD</p>
              {newRecords.map((r) => (
                <p key={r} style={{ fontWeight: 700 }}>
                  {r}
                </p>
              ))}
            </div>
          </div>
        )}










        {/* Three tabs, with what people want first: who won and why. The numbers are the second, the replay the third. */}
        <div className="mb-4">
          <Segmented
            value={tab}
            onChange={(next) => startTransition(() => setTab(next))}
            label="Kampen"
            options={[
              { value: "oppsummering", label: "Oppsummering" },
              { value: "statistikk", label: "Statistikk" },
              { value: "replay", label: "Replay" },
            ]}
          />
        </div>

        {tab === "oppsummering" && (
          <>
        <AwardsCard awards={awards} />
        {/* A match that has just been played: the ratings, and the match turn by turn. */}
        {stats[winner] && !statsOff && !archive && <RatingCard players={players} winner={winner} />}
        <MatchSummary facts={facts} />
        {/* The match as a race — who led when, and by how much. */}
        <ChartFrame title="LEDELSE RUNDE FOR RUNDE" legend={players.map((n) => ({ name: n, won: n === winner }))}>
          <RaceChart players={players} turnLog={turnLogByPlayer} winner={winner} total={totalMarks()} />
        </ChartFrame>
          </>
        )}

        {tab === "statistikk" && (
          <>
        {/* What people read first, and often all they read: hit percentage and darts, side by side
            for everyone. The charts and the finer statistics are further down, for those who
            keep scrolling. */}
        <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">
            STATISTIKK — DENNE KAMPEN
          </p>
          <div role="table" aria-label="Statistikk for kampen">
            <div
              role="row"
              className="grid items-end pb-1"
              style={{ gridTemplateColumns: "minmax(0, 1fr) 4.2rem 4.2rem", color: "var(--color-label)", fontSize: "var(--text-micro)", letterSpacing: "0.1em" }}
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
                  <span role="cell" className="tabular text-right font-display" style={{ fontSize: "var(--text-title)" }}>
                    {treffPct(stats[p])} %
                  </span>
                  <span role="cell" className="tabular text-right font-display" style={{ fontSize: "var(--text-title)" }}>
                    {totalDarts(stats[p])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Per thrower: in team play the members' own numbers, which the table above cannot show;
            for everyone, the turns where all three darts counted — and how many of those in a row. */}
        <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">PER KASTER</p>
          <div role="table" aria-label="Per kaster">
            <div
              role="row"
              className="grid items-end pb-1"
              style={{ gridTemplateColumns: "minmax(0, 1fr) 4rem 3.5rem 6rem", color: "var(--color-label)", fontSize: "var(--text-micro)", letterSpacing: "0.1em" }}
            >
              <span role="columnheader" />
              <span role="columnheader" className="text-right">TREFF</span>
              <span role="columnheader" className="text-right">PILER</span>
              <span role="columnheader" className="text-right whitespace-nowrap">3 TELLENDE</span>
            </div>
            <div className="space-y-2">
              {players.map((p) => {
                const rows = throwerStats(turnLogByPlayer[p] ?? [], p);
                const isTeam = rows.some((r) => r.name !== p);
                return (
                  <div key={p}>
                    {isTeam && (
                      <p className="truncate text-left" style={{ color: p === winner ? "var(--color-gold)" : "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-small)" }}>
                        {p}
                      </p>
                    )}
                    {rows.map((r) => (
                      <div
                        key={r.name}
                        role="row"
                        className="grid items-baseline"
                        style={{ gridTemplateColumns: "minmax(0, 1fr) 4rem 3.5rem 6rem", color: p === winner ? "var(--color-gold)" : "var(--color-cream)", paddingLeft: isTeam ? "0.75rem" : 0 }}
                      >
                        <span role="cell" className="truncate text-left">{r.name}</span>
                        <span role="cell" className="tabular text-right font-display" style={{ fontSize: "var(--text-title)" }}>
                          {r.hitPct} %
                        </span>
                        <span role="cell" className="tabular text-right font-display" style={{ fontSize: "var(--text-title)" }}>
                          {r.darts}
                        </span>
                        <span role="cell" className="tabular text-right font-display whitespace-nowrap" style={{ fontSize: "var(--text-title)" }}>
                          {r.perfectTurns}
                          {r.bestRun >= 1 && (
                            <span className="font-sans" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", marginLeft: "0.35rem" }}>{r.bestRun * 3} piler på rad</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Team matches: every thrower of every side in one list, best hit percentage on top. */}
        {teamRanking.length > 1 && (
          <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">TREFF % PÅ TVERS AV LAGENE</p>
            <div role="table" aria-label="Treffprosent per spiller">
              <div
                role="row"
                className="grid items-end pb-1"
                style={{ gridTemplateColumns: "1.5rem minmax(0, 1fr) 3.2rem 3.2rem", color: "var(--color-label)", fontSize: "var(--text-micro)", letterSpacing: "0.1em" }}
              >
                <span role="columnheader" />
                <span role="columnheader" />
                <span role="columnheader" className="text-right">TREFF</span>
                <span role="columnheader" className="text-right">PILER</span>
              </div>
              <div className="space-y-2">
                {teamRanking.map((r, i) => (
                  <div key={`${r.team}-${r.name}`} role="row">
                    <div className="grid items-baseline" style={{ gridTemplateColumns: "1.5rem minmax(0, 1fr) 3.2rem 3.2rem", color: r.team === winner ? "var(--color-gold)" : "var(--color-cream)" }}>
                      <span role="cell" className="tabular text-left" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{i + 1}</span>
                      <span role="cell" className="truncate text-left">
                        {r.name}
                        <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", marginLeft: "0.4rem" }}>{r.team}</span>
                      </span>
                      <span role="cell" className="tabular text-right font-display" style={{ fontSize: "var(--text-title)" }}>{r.hitPct} %</span>
                      <span role="cell" className="tabular text-right font-display" style={{ fontSize: "var(--text-title)" }}>{r.darts}</span>
                    </div>
                    <div aria-hidden className="rounded-full mt-1" style={{ height: "0.25rem", marginLeft: "1.5rem", background: "var(--color-cell)" }}>
                      <div className="rounded-full" style={{ height: "100%", width: `${Math.max(2, r.hitPct)}%`, background: r.team === winner ? "var(--color-gold)" : "var(--color-teal)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <RowCostCard players={players} turnLog={turnLogByPlayer} />
        {hasScoliaData && !showMore && !limited && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={`tactile w-full rounded-lg text-sm mb-4 ${FOCUS_RING}`}
            style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            Mer statistikk
          </button>
        )}
        {hasScoliaData && showMore && !limited && (
          <>
        <div className="card mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">FORVENTEDE TREFF</p>
          {!players.some((p) => STEPS.some((s) => luckByPlayer[p]?.[s].count > 0)) ? (
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)", lineHeight: 1.45 }}>
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
                              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{STEP_LABELS[s]}</p>
                              <p style={{ color: "var(--color-cream)", fontSize: "var(--text-micro)", fontWeight: 600 }}>
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
          <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">
              KASTSPREDNING
            </p>
            <div className="space-y-4">
              {players
                .filter((p) => (throwsByPlayer[p]?.length ?? 0) > 0)
                .map((p) => (
                  <div key={p}>
                    <p className="mb-1" style={{ color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
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
        {onToggleStats && (
          <div className="mb-4 text-center">
            {statsOff && (
              <p role="status" className="mb-2" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-small)" }}>
                Denne kampen teller ikke i statistikken.
              </p>
            )}
            <button
              type="button"
              onClick={onToggleStats}
              className={`tactile w-full rounded-xl ${FOCUS_RING}`}
              style={{ minHeight: "var(--control)", background: "transparent", color: statsOff ? "var(--color-cream)" : "var(--color-red)", border: `1px solid ${statsOff ? "var(--color-border)" : "var(--color-red)"}`, fontSize: "var(--text-body)" }}
            >
              {statsOff ? "Ta kampen med i statistikken likevel" : "Fjern denne kampen fra statistikken"}
            </button>
          </div>
        )}
          </>
        )}

        {tab === "replay" && (
          <>
        <OddsChart history={oddsHistory} winner={winner} />
        <TimeMachine players={players} turnLog={turnLogByPlayer} snapshots={oddsHistory} winner={winner} />
        {replayThrows && <ReplayCard throws={replayThrows} />}
          </>
        )}

        {/* The way on, fixed at the bottom: the same people again, other people, or leave. In a tournament there is only one,
            back to the tournament, and it is the main button. */}
        {actionBar}
      </div>
    </div>
  );
}
