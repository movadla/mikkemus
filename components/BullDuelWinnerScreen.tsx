"use client";

import { Fragment, startTransition, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { meanDistanceFor, type BullDuelState } from "@/lib/bullDuel";
import { generateConfetti, generateConfettiRain } from "@/lib/confetti";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { getPlayerRecord } from "@/lib/storage";
import { DartboardHeatmap } from "./DartboardHeatmap";
import { ReplayCard } from "./ReplayCard";
import { Trophy } from "./Trophy";
import { Button } from "./ui/Button";
import { ChartFrame, seriesColor } from "./ui/ChartFrame";
import { Segmented } from "./ui/Segmented";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const CONFETTI_COUNT = 40;
const RAIN_COUNT = 90;

// xG is an expected-points value (0-2, same unit the game scores in, like football xG) rather than a signed luck delta
// — always non-negative, so no "+" prefix.
function formatLuck(luck: number): string {
  return luck.toFixed(1);
}

/** A tile of the kind the statistics use everywhere: small spaced label, large tabular figure. */
function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div
      className="rounded-xl px-2 py-3 text-center"
      style={{ background: "var(--color-surface-2)", boxShadow: "inset 0 0 0 1px var(--veil), inset 0 1px 0 var(--veil), 0 1px 2px color-mix(in srgb, var(--shade) 40%, transparent)" }}
    >
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: 600, letterSpacing: "0.14em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)", lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {value}
        {unit && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: 500 }}> {unit}</span>}
      </p>
    </div>
  );
}

/** Everyone's points after each of their turns, as lines: who led when, and where it turned. */
function PointsRace({ duel, winner }: { duel: BullDuelState; winner: string }) {
  const W = 300;
  const H = 130;
  const turns = Math.max(1, ...duel.players.map((p) => duel.pointsByTurn[p].length));
  const x = (i: number) => 8 + (i / turns) * (W - 16);
  const y = (pts: number) => 8 + (1 - Math.min(1, pts / duel.target)) * (H - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H + 6}`} className="w-full h-auto" role="img" aria-label="Poeng etter hver runde">
      <line x1={8} x2={W - 8} y1={y(duel.target)} y2={y(duel.target)} stroke="color-mix(in srgb, var(--light) 14%, transparent)" strokeDasharray="3 3" />
      <line x1={8} x2={W - 8} y1={H - 8} y2={H - 8} stroke="color-mix(in srgb, var(--light) 14%, transparent)" />
      {duel.players.map((p) => {
        const series = [0, ...duel.pointsByTurn[p]];
        const color = p === winner ? "var(--color-gold-strong)" : seriesColor(p);
        const points = series.map((v, k) => `${x(k)},${y(v)}`).join(" ");
        const last = series.length - 1;
        return (
          <g key={p}>
            <polyline points={points} fill="none" stroke={color} strokeWidth={p === winner ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" opacity={p === winner ? 1 : 0.85} />
            <circle cx={x(last)} cy={y(series[last])} r={3.5} fill={color} />
          </g>
        );
      })}
    </svg>
  );
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
  const [spreadFor, setSpreadFor] = useState<string>(winner);
  const [tab, setTab] = useState<"oppsummering" | "statistikk" | "replay">("oppsummering");
  // The celebration follows the chosen level, as in the main game: none at Vanlig, the usual at Party, twice the rain at Full party.
  const fx = fxFlags(useFxLevel());
  const confettiCount = fx.confetti ? CONFETTI_COUNT * (fx.bigConfetti ? 2 : 1) : 0;
  const rainCount = fx.confetti ? RAIN_COUNT * (fx.bigConfetti ? 2 : 1) : 0;
  const confetti = useMemo(() => generateConfetti(confettiCount), [confettiCount]);
  const rain = useMemo(() => generateConfettiRain(rainCount), [rainCount]);

  const winnerStats = duel.stats[winner];
  const winnerHits = winnerStats.redHits + winnerStats.greenHits;
  const winnerPct = winnerStats.throws === 0 ? null : Math.round((winnerHits / winnerStats.throws) * 100);
  const winnerLuck = winnerStats.luckCount === 0 ? null : winnerStats.luckSum / winnerStats.luckCount;

  // The winning turn played back from where its darts really landed — only when every dart of it has a position, so the
  // replay never shows a made-up dart.
  const lastDarts = duel.turnShots.length;
  const winnerThrows = duel.throws[winner] ?? [];
  const replayThrows = fx.replay && lastDarts > 0 && winnerStats.throws === winnerThrows.length && winnerThrows.length >= lastDarts ? winnerThrows.slice(-lastDarts) : null;

  // What stood out, from the numbers kept per match.
  const best = <K extends "bestRun" | "bestTurn" | "redHits" | "perfectTurns">(key: K) =>
    duel.players.reduce((a, p) => (duel.stats[p][key] > duel.stats[a][key] ? p : a), duel.players[0]);
  const insights = [
    { title: "Lengste rekke", who: best("bestRun"), detail: `${duel.stats[best("bestRun")].bestRun} piler på rad`, show: duel.stats[best("bestRun")].bestRun >= 2 },
    { title: "Beste runde", who: best("bestTurn"), detail: `${duel.stats[best("bestTurn")].bestTurn} poeng`, show: duel.stats[best("bestTurn")].bestTurn >= 2 },
    { title: "Flest røde", who: best("redHits"), detail: `${duel.stats[best("redHits")].redHits} i midten`, show: duel.stats[best("redHits")].redHits >= 1 },
    { title: "Perfekte runder", who: best("perfectTurns"), detail: `${duel.stats[best("perfectTurns")].perfectTurns} med tre treff`, show: duel.stats[best("perfectTurns")].perfectTurns >= 1 },
  ].filter((i) => i.show);
  const measured = duel.players.some((p) => (duel.throws[p]?.length ?? 0) > 0);

  // The way on, fixed to the window. It is drawn into the body: the screen animates with a transform, and a fixed child of a
  // transformed element is fixed to that element, not to the window.
  const actionBarEl = (
    <div className="fixed left-0 right-0 bottom-0 z-40 px-4" style={{ background: "var(--glass)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--color-hairline)", paddingTop: "0.75rem", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto max-w-md grid gap-2" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <Button variant="primary" size="lg" block onClick={onPlayAgain}>
          Revansj
        </Button>
        <Button size="lg" block onClick={onHome}>
          Hjem
        </Button>
      </div>
    </div>
  );
  const actionBar = typeof document === "undefined" ? actionBarEl : createPortal(actionBarEl, document.body);

  return (
    <div className="animate-screen-enter relative min-h-screen w-full flex items-start justify-center p-4 overflow-hidden" style={{ background: "var(--color-bg)" }}>
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
      <div className="relative z-10 w-full max-w-md text-center pt-4" style={{ paddingBottom: "7rem" }}>
        {/* The trophy rises above the winner (Full party). */}
        {fx.trophy && <Trophy cannons />}
        <div className="relative">
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none" style={{ transform: "translateY(-10%)" }} aria-hidden>
            <div className="animate-idle-glow" style={{ width: "240px", height: "240px", borderRadius: "50%", background: "var(--color-gold)", filter: "blur(48px)" }} />
          </div>
          <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none z-10" aria-hidden>
            {confetti.map((c, i) => (
              <span key={i} className="confetti-piece" style={{ left: c.left, background: c.color, animationDelay: c.delay, "--r": c.rotate } as React.CSSProperties} />
            ))}
          </div>
          {/* The winner's face is the headline, as on the main winner screen. */}
          <div className="relative z-30 flex justify-center" style={{ marginBottom: "-84px" }}>
            <div className="relative" style={{ width: "168px", height: "168px" }}>
              <span aria-hidden className="animate-winner-shockwave absolute inset-0 rounded-full pointer-events-none" style={{ border: "3px solid var(--color-gold)" }} />
              <div
                className="animate-winner-photo-pulse rounded-full overflow-hidden flex items-center justify-center w-full h-full"
                style={{ border: "5px solid var(--color-gold)", background: "var(--color-surface)", boxShadow: "0 10px 30px var(--scrim-soft), 0 0 40px color-mix(in srgb, var(--color-gold) 35%, transparent)" }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={winner} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display" style={{ color: "var(--color-gold)", fontSize: "4rem" }}>
                    {winner.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="animate-winner-pop card-gold shadow-panel relative z-20 rounded-2xl pt-24 pb-8 px-8 mb-6">
            <p className="font-display" style={{ color: "var(--color-bg)", fontSize: "var(--text-body)", fontStyle: "italic", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
              Vinner
            </p>
            <h2 className="font-display" style={{ color: "var(--color-bg)", fontSize: "2.2rem" }}>
              {winner}
            </h2>
            <p className="tabular" style={{ color: "var(--color-bg)", opacity: 0.75, fontSize: "var(--text-body)", marginTop: "0.4rem", fontWeight: 600 }}>
              {duel.points[winner]} / {duel.target} poeng · {winnerStats.throws} {winnerStats.throws === 1 ? "pil" : "piler"}
              {winnerPct !== null ? ` · ${winnerPct} % treff` : ""}
            </p>
            {/* xH up here too, as in the main game: the one number that says whether the win was thrown or fell out of the sky. */}
            {winnerLuck !== null && (
              <p className="tabular" style={{ color: "var(--color-bg)", opacity: 0.65, fontSize: "var(--text-small)", marginTop: "0.2rem" }}>
                xH {formatLuck(winnerStats.luckSum)} forventet / {winnerStats.points} faktisk
              </p>
            )}
          </div>
        </div>

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
        {insights.length > 0 && (
          <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">DET SOM STAKK UT</p>
            <div className="grid grid-cols-2 gap-3">
              {insights.map((a) => (
                <div key={a.title} className="rounded-xl p-3 text-left" style={{ background: "var(--color-surface-2)", boxShadow: "inset 0 0 0 1px var(--veil), inset 0 1px 0 var(--veil)" }}>
                  <p style={{ color: "var(--color-gold)", fontSize: "var(--text-micro)", letterSpacing: "0.14em", fontWeight: 600, textTransform: "uppercase" }}>{a.title}</p>
                  <p className="font-display truncate" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>{a.who}</p>
                  <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{a.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {duel.players.some((p) => duel.pointsByTurn[p].length > 0) && (
          <ChartFrame title="POENG RUNDE FOR RUNDE" legend={duel.players.map((n) => ({ name: n, won: n === winner }))}>
            <PointsRace duel={duel} winner={winner} />
          </ChartFrame>
        )}
          </>
        )}

        {tab === "statistikk" && (
          <>
        <div className="grid grid-cols-3 gap-2 mb-6">
          <Tile label="TREFF" value={winnerPct === null ? "–" : String(winnerPct)} unit={winnerPct === null ? undefined : "%"} />
          <Tile label="REKKE" value={String(winnerStats.bestRun)} unit="piler" />
          <Tile label="MED" value={meanDistanceFor(duel, winner) === null ? "–" : String(Math.round(meanDistanceFor(duel, winner) as number))} unit={meanDistanceFor(duel, winner) === null ? undefined : "mm"} />
        </div>

        <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">BULL-DUELL — DENNE KAMPEN</p>
          <div className="grid gap-x-2 gap-y-4 text-left" style={{ gridTemplateColumns: "1fr repeat(5, auto)" }}>
            <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }} />
            {["KAST", "POENG", "%", "MED", "XG"].map((h) => (
              <span key={h} className="text-right" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                {h}
              </span>
            ))}
            {duel.players.map((p) => {
              const stats = duel.stats[p];
              const hits = stats.redHits + stats.greenHits;
              const pct = stats.throws === 0 ? null : Math.round((hits / stats.throws) * 100);
              const luck = stats.luckCount === 0 ? null : stats.luckSum / stats.luckCount;
              const med = meanDistanceFor(duel, p);
              const isExpanded = expanded === p;
              return (
                <Fragment key={p}>
                  {/* display:contents keeps these cells as direct grid items while still giving the whole row one
                      click/keyboard target for the drilldown. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(isExpanded ? null : p)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      setExpanded(isExpanded ? null : p);
                    }}
                    // Not FOCUS_RING: an outline on a display:contents element is never painted, since it generates no
                    // box. .row-focus draws the ring on the cells instead — see globals.css.
                    className="row-focus"
                    style={{ display: "contents", cursor: "pointer" }}
                  >
                    <span style={{ color: p === winner ? "var(--color-gold)" : "var(--color-cream)", fontWeight: p === winner ? 600 : 400 }}>{p}</span>
                    <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>{stats.throws}</span>
                    <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>{stats.points}</span>
                    <span className="tabular text-right" style={{ color: "var(--color-cream)" }}>{pct === null ? "–" : `${pct} %`}</span>
                    <span className="tabular text-right" style={{ color: med === null ? "var(--color-muted)" : "var(--color-cream)" }}>{med === null ? "–" : `${Math.round(med)} mm`}</span>
                    <span className="tabular text-right" style={{ color: luck === null ? "var(--color-muted)" : "var(--color-gold-strong)" }}>{luck === null ? "–" : formatLuck(luck)}</span>
                  </div>
                  {isExpanded && (
                    <div className="tabular text-left flex items-center gap-4 flex-wrap" style={{ gridColumn: "1 / -1", fontSize: "var(--text-small)", color: "var(--color-muted)", paddingBottom: "0.15rem" }}>
                      <span className="flex items-center gap-1">
                        <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: "var(--color-red)", display: "inline-block" }} />
                        {stats.redHits} rød
                      </span>
                      <span className="flex items-center gap-1">
                        <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: "var(--color-green)", display: "inline-block" }} />
                        {stats.greenHits} grønn
                      </span>
                      <span>· {stats.throws} kast</span>
                      {stats.luckCount === stats.throws && stats.throws > 0 && (
                        <span>
                          · xH {formatLuck(stats.luckSum)} av {stats.points} poeng
                        </span>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

          </>
        )}

        {tab === "replay" && (
          <>
        {measured && (
          <div className="card mb-6" style={{ background: "var(--color-surface)" }}>
            <p className="mb-3 section-label">KASTSPREDNING</p>
            {duel.players.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3 justify-center" role="radiogroup" aria-label="Spiller">
                {duel.players.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={p === spreadFor}
                    onClick={() => setSpreadFor(p)}
                    className={`tactile px-4 rounded-lg text-sm ${FOCUS_RING}`}
                    style={{ minHeight: "var(--control)", background: p === spreadFor ? "var(--teal-soft)" : "var(--color-cell)", color: p === spreadFor ? "var(--color-teal)" : "var(--color-muted)", border: p === spreadFor ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <DartboardHeatmap throws={duel.throws[spreadFor] ?? []} />
          </div>
        )}

        {replayThrows && <ReplayCard throws={replayThrows} />}

          </>
        )}

        {actionBar}
      </div>
    </div>
  );
}
