"use client";

import { Fragment } from "react";
import Link from "next/link";
import { STEPS, STEP_LABELS } from "@/lib/game";
import { useLiveMatch } from "@/lib/liveMatch";
import { avatarAccent } from "@/lib/avatarAccent";
import { DartboardGlyph } from "@/components/DartboardGlyph";
import { Mark } from "@/components/Mark";

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

/** Deliberately understated — this page's whole point is to fill a TV/room, so a normal nav
 *  chrome would compete with that. Stays nearly invisible until someone actually reaches for it. */
function HomeLink() {
  return (
    <Link
      href="/"
      className="fixed top-2 left-2 z-40 text-xs opacity-20 hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)] transition-opacity"
      style={{ color: "var(--color-cream)" }}
    >
      ← Hjem
    </Link>
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

  if (!live || live.screen === "setup" || live.players.length === 0) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6" style={{ background: "var(--color-bg)" }}>
        <HomeLink />
        <h1 className="sr-only">Venter på kamp</h1>
        <div className="relative flex items-center justify-center">
          <div
            className="animate-idle-glow absolute"
            style={{ width: "220px", height: "220px", borderRadius: "50%", background: "var(--color-teal)", opacity: 0.25, filter: "blur(56px)" }}
            aria-hidden
          />
          <DartboardGlyph className="relative w-24 h-24" />
        </div>
        <p className="font-display" style={{ color: "var(--color-muted)", fontSize: "1.6rem" }}>
          Venter på at en kamp skal starte …
        </p>
      </div>
    );
  }

  if (live.screen === "winner" && live.winner) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <HomeLink />
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
          <div className="card-gold shadow-panel animate-winner-pop relative z-20 rounded-2xl px-16 py-10 text-center">
            <p className="font-display italic" style={{ fontSize: "1.4rem", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
              Vinner
            </p>
            <p className="font-display" style={{ fontSize: "5rem", lineHeight: 1 }}>
              {live.winner}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-10" style={{ background: "var(--color-bg)" }}>
      <HomeLink />
      <h1 className="sr-only">Kampoversikt – storskjerm</h1>
      <div className="shadow-panel rounded-xl overflow-x-auto overflow-y-hidden w-full" style={{ background: "var(--color-panel)" }}>
        <div
          className="grid p-4"
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
                className="text-center pb-4"
                style={{ borderBottom: isActive ? "4px solid var(--color-teal)" : "4px solid var(--color-border)" }}
              >
                <span className="relative inline-flex max-w-full min-w-0">
                  {isActive && (
                    <span
                      aria-hidden
                      className="animate-idle-glow absolute inset-0 rounded-full pointer-events-none"
                      style={{ boxShadow: "0 0 24px rgba(47, 180, 194, 0.35)" }}
                    />
                  )}
                  <span
                    key={isActive ? `active-${live.turnToken}` : "inactive"}
                    className={`relative block max-w-full truncate px-4 py-1 rounded-full font-display ${isActive ? "animate-column-glow" : ""}`}
                    style={
                      {
                        color: isActive ? "var(--color-teal)" : avatarAccent(p),
                        fontSize: "2rem",
                        background: isActive ? "rgba(47, 180, 194, 0.16)" : "transparent",
                        "--glow-color": "rgba(47, 180, 194, 0.35)",
                      } as React.CSSProperties
                    }
                  >
                    {p}
                    {isGuest && <span style={{ color: "var(--color-muted)", fontSize: "1.1rem" }}> (gjest)</span>}
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
                const isDone = count >= 3;
                return (
                  <div key={`${s}-${p}`} className="flex items-center justify-center p-2">
                    <div
                      className="rounded-md flex items-center justify-center"
                      style={{
                        width: "clamp(3.2rem, 12vw, 5rem)",
                        height: "clamp(3.2rem, 12vw, 5rem)",
                        background: isDone ? "var(--color-cell-done)" : "var(--color-cell)",
                        boxShadow: isDone
                          ? "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -8px 14px rgba(0,0,0,0.3)"
                          : "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 8px rgba(0,0,0,0.18)",
                      }}
                    >
                      <div className="w-full h-full p-2">
                        <Mark count={count} accent={isActive ? "var(--color-teal)" : "var(--color-muted)"} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
