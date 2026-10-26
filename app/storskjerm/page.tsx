"use client";

import { Fragment, useEffect, useRef } from "react";
import { STEPS, STEP_LABELS } from "@/lib/game";
import { useLiveMatch, type LiveMatchState } from "@/lib/liveMatch";
import { emitFx } from "@/lib/fxBus";
import { FxStage } from "@/components/FxStage";
import { OddsBar } from "@/components/OddsBar";
import { MomentumWave } from "@/components/MomentumWave";
import { Trophy } from "@/components/Trophy";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { useShowOdds } from "@/lib/oddsSetting";
import { RULES, baseOf } from "@/lib/rules";
import { avatarAccent } from "@/lib/avatarAccent";
import { DartboardGlyph } from "@/components/DartboardGlyph";
import { Mark } from "@/components/Mark";
import { TvFrame } from "@/components/TvFrame";
import { TvShow } from "@/components/TvShow";
import { Avatar } from "@/components/ui/Avatar";
import { useRoster } from "@/lib/storage";

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

/** The panel beside the board: who is throwing, how far each side has come, and the odds. */
function TvSide({ live, target, showOdds }: { live: LiveMatchState; target: number; showOdds: boolean }) {
  const roster = useRoster();
  const active = live.activePlayer;
  const total = STEPS.length * target;
  const done = (name: string) => STEPS.reduce((sum, st) => sum + Math.min(target, live.progress[name]?.[st] ?? 0), 0);
  return (
    <aside className="flex flex-col gap-4" aria-label="Stilling">
      {active && (
        <div className="card flex items-center gap-4">
          <Avatar name={active} photo={roster.find((r) => r.name === active)?.photo} size="l" state="active" bot={!!live.botLevels?.[active]} />
          <div className="min-w-0">
            <p className="section-label">KASTER</p>
            <p className="font-display truncate" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)", lineHeight: 1.1 }}>
              {active}
            </p>
          </div>
        </div>
      )}
      <div className="card space-y-3">
        {live.players.map((n) => (
          <div key={n}>
            <p className="flex items-baseline justify-between gap-3 mb-1">
              <span className="truncate" style={{ color: n === active ? "var(--color-cream)" : "var(--color-text-2)", fontWeight: n === active ? 700 : 500, fontSize: "var(--text-title)" }}>
                {n}
              </span>
              <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>
                {done(n)} av {total}
              </span>
            </p>
            <div className="rounded-full overflow-hidden" style={{ height: "0.5rem", background: "var(--color-cell)" }}>
              <div style={{ width: `${(done(n) / total) * 100}%`, height: "100%", background: avatarAccent(n), transition: "width 500ms var(--ease-standard)" }} />
            </div>
          </div>
        ))}
      </div>
      {showOdds && live.odds && live.odds.length > 0 && <OddsBar rows={live.odds.map((o) => ({ ...o, lo: o.p, hi: o.p, active: o.name === live.activePlayer }))} />}
    </aside>
  );
}

/**
 * Read-only spectator view, meant for a TV/second screen while the tablet at the board stays
 * the input device — polls lib/liveMatch.ts's live_match row, which MikkeMusApp publishes to on
 * every state change (see there). No taps, no Undo/Confirm; just a bigger, calmer version of
 * the same board for people watching, not playing.
 */
export default function StorskjermPage() {
  const live = useLiveMatch();
  const fxLevel = useFxLevel();
  // Vanlig leaves the odds out: they belong to Party and Full party.
  const showOdds = useShowOdds() && fxLevel !== "normal";
  // This page is not the one playing the match, so it reads the variant off the snapshot rather
  // than from the module-wide rules (which are whatever this browser last set — nothing).
  const target = RULES[baseOf(live?.variant)].target;

  // The big screen plays the same effects as the board, worked out from what changed since the last
  // poll — so they are exactly what happened: a cross that appeared is a dart that scored, a row
  // that reached the target is a closed row, a new active player is a new thrower, and a different
  // player with the fewest crosses left is a new leader. (Triples, runs and records are not in the
  // snapshot, so those stay on the board's own screen.) Which of them play is this device's level.
  const prev = useRef<LiveMatchState | null>(null);
  const leader = useRef<string | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = live;
    if (!live || live.screen !== "game") {
      leader.current = null;
      return;
    }
    const left = live.players.map((p) => ({ p, r: STEPS.reduce((sum, s) => sum + (target - Math.min(target, live.progress[p]?.[s] ?? 0)), 0) }));
    const best = Math.min(...left.map((x) => x.r));
    const ahead = left.filter((x) => x.r === best);
    const nowLeader = ahead.length === 1 && live.players.length > 1 ? ahead[0].p : null;
    const sameMatch = before && before.screen === "game" && before.players.join("|") === live.players.join("|");
    if (sameMatch) {
      for (const p of live.players) {
        for (const s of STEPS) {
          const a = before.progress[p]?.[s] ?? 0, b = live.progress[p]?.[s] ?? 0;
          if (b <= a) continue;
          if (b >= target && a < target) emitFx({ type: "rowClosed", step: s, player: p });
        }
      }
      if (live.activePlayer !== before.activePlayer || live.turnToken !== before.turnToken) emitFx({ type: "walkOn", player: live.activePlayer ?? undefined });
      if (nowLeader && leader.current && nowLeader !== leader.current) emitFx({ type: "lead", name: nowLeader });
    }
    if (nowLeader) leader.current = nowLeader;
  }, [live, target]);

  // A draw or a champion sent from the tournament takes the screen before anything else.
  if (live?.show) return <TvShow show={live.show} />;

  if (!live || live.screen === "setup" || live.players.length === 0) {
    return (
      <TvFrame label="Venter" className="items-center justify-center gap-6">
        <h1 className="sr-only">Venter på kamp</h1>
        <div className="relative flex items-center justify-center">
          <div
            className="animate-idle-glow absolute"
            style={{ width: "220px", height: "220px", borderRadius: "50%", background: "var(--color-teal)", opacity: 0.25, filter: "blur(56px)" }}
            aria-hidden
          />
          <DartboardGlyph className="relative w-24 h-24" />
        </div>
        <p className="font-display" style={{ color: "var(--color-muted)", fontSize: "var(--text-num)" }}>
          Venter på at en kamp skal starte …
        </p>
      </TvFrame>
    );
  }

  if (live.screen === "winner" && live.winner) {
    return (
      <TvFrame label="Vinner" className="items-center justify-center">
        <h1 className="sr-only">Kampvinner: {live.winner}</h1>
        <div className="relative flex flex-col items-center">
          <div
            className="absolute z-0"
            style={{ width: "440px", height: "440px", borderRadius: "50%", background: "var(--color-gold)", opacity: 0.32, filter: "blur(80px)" }}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none z-10" aria-hidden>
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={
                  {
                    left: c.left,
                    background: c.color,
                    animationDelay: c.delay,
                    "--r": c.rotate,
                    "--fall": "70vh",
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          {fxFlags(fxLevel).trophy && <div className="relative z-20 mb-2"><Trophy cannons /></div>}
          <div className="card-gold shadow-panel animate-winner-pop relative z-20 rounded-2xl px-16 py-10 text-center">
            <p className="font-display italic" style={{ fontSize: "var(--text-title)", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
              Vinner
            </p>
            <p className="font-display" style={{ fontSize: "5rem", lineHeight: 1 }}>
              {live.winner}
            </p>
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame label="Kamp" className="items-center justify-center p-4 sm:p-6 md:p-10">
      <FxStage />
      <h1 className="sr-only">Kampoversikt – storskjerm</h1>
      <div className="tv-live w-full" style={{ marginTop: "2.5rem" }}>
      <div className="shadow-panel rounded-xl overflow-x-auto overflow-y-hidden w-full relative" style={{ background: "var(--color-panel)" }}>
        {/* The win chance as a liquid border behind the board — only with two sides and odds on show. */}
        {showOdds && fxFlags(fxLevel).momentum && live.players.length === 2 && live.odds && live.odds.length === 2 && (
          <MomentumWave chance={live.odds.find((o) => o.name === live.players[0])?.p ?? 0.5} />
        )}
        <div
          className="grid p-4 relative"
          style={{
            gridTemplateColumns: `clamp(70px, 18vw, 140px) repeat(${live.players.length}, minmax(64px, 1fr))`,
            gridTemplateRows: `auto repeat(${STEPS.length}, minmax(0, 1fr))`,
            gap: "0.5rem",
          }}
        >
          <div />
          {live.players.map((p) => {
            const isActive = p === live.activePlayer;
            const isGuest = !!live.guestPlayers[p];
            return (
              <div
                key={p}
                data-col-active={isActive ? "" : undefined}
                data-col-player={p}
                className="text-center pb-4"
                style={{ borderBottom: isActive ? "4px solid var(--color-teal)" : "4px solid var(--color-border)" }}
              >
                <span className="relative inline-flex max-w-full min-w-0">
                  {isActive && (
                    <span
                      aria-hidden
                      className="animate-idle-glow absolute inset-0 rounded-full pointer-events-none"
                      style={{ boxShadow: "0 0 24px var(--teal-ring)" }}
                    />
                  )}
                  <span
                    key={isActive ? `active-${live.turnToken}` : "inactive"}
                    className={`relative block max-w-full truncate px-4 py-1 rounded-full font-display ${isActive ? "animate-column-glow" : ""}`}
                    style={
                      {
                        color: isActive ? "var(--color-teal)" : avatarAccent(p),
                        fontSize: "var(--text-num)",
                        background: isActive ? "color-mix(in srgb, var(--color-teal) 16%, transparent)" : "transparent",
                        "--glow-color": "var(--teal-ring)",
                      } as React.CSSProperties
                    }
                  >
                    {p}
                    {isGuest && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-title)" }}> (gjest)</span>}
                  </span>
                </span>
              </div>
            );
          })}

          {STEPS.map((s) => (
            <Fragment key={s}>
              <div className="flex items-center justify-center font-display" style={{ color: "var(--color-cream)", fontSize: "2.2rem" }}>
                {STEP_LABELS[s]}
              </div>
              {live.players.map((p) => {
                const count = live.progress[p]?.[s] ?? 0;
                const isActive = p === live.activePlayer;
                const isDone = count >= target;
                return (
                  <div key={`${s}-${p}`} className="flex items-center justify-center p-2">
                    <div
                      data-step={s}
                      data-player={p}
                      className="rounded-xl flex items-center justify-center"
                      style={{
                        width: "clamp(3.2rem, 12vw, 5rem)",
                        height: "clamp(3.2rem, 12vw, 5rem)",
                        background: isDone ? "linear-gradient(180deg, var(--color-cell-done-top), var(--color-cell-done-bottom))" : "var(--color-cell)",
                        boxShadow: isDone
                          ? "inset 0 0 0 1px color-mix(in srgb, var(--color-gold) 60%, transparent), inset 0 1px 0 rgba(255, 235, 190, 0.25), 0 0 22px color-mix(in srgb, var(--color-gold) 22%, transparent)"
                          : "inset 0 0 0 1px var(--veil), inset 0 1px 0 color-mix(in srgb, var(--light) 8%, transparent), 0 1px 2px color-mix(in srgb, var(--shade) 35%, transparent)",
                      }}
                    >
                      <div className="w-full h-full p-2">
                        <Mark count={count} target={target} accent={isActive ? "var(--color-teal)" : "var(--color-muted)"} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <TvSide live={live} target={target} showOdds={showOdds} />
      </div>
    </TvFrame>
  );
}