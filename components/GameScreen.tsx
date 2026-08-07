"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { STEPS, STEP_LABELS, currentStepFor, isRegistrable, type PlayerProgress, type Step } from "@/lib/game";
import { Mark } from "./Mark";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Props = {
  players: string[];
  progress: PlayerProgress;
  activePlayer: string | null;
  turnToken: number;
  dartsThrown: Record<string, number>;
  pendingByStep: Partial<Record<Step, number>>;
  rewound: boolean;
  pendingCount: number;
  canUndo: boolean;
  onRegisterHit: (step: Step) => void;
  onUndo: () => void;
  onConfirm: () => void;
  onAbort: () => void;
};

export function GameScreen({
  players,
  progress,
  activePlayer,
  turnToken,
  dartsThrown,
  pendingByStep,
  rewound,
  pendingCount,
  canUndo,
  onRegisterHit,
  onUndo,
  onConfirm,
  onAbort,
}: Props) {
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const wasRewound = useRef(false);

  useEffect(() => {
    if (rewound && !wasRewound.current) {
      setFlashKey((k) => k + 1);
    }
    wasRewound.current = rewound;
  }, [rewound]);

  const activeStep = activePlayer ? currentStepFor(progress[activePlayer]) : null;
  const accent = rewound ? "var(--color-red)" : "var(--color-teal)";
  const glowColor = rewound ? "rgba(196, 67, 46, 0.35)" : "rgba(47, 180, 194, 0.35)";
  const glowBg = rewound ? "rgba(196, 67, 46, 0.16)" : "rgba(47, 180, 194, 0.16)";

  return (
    <div className="animate-screen-enter w-full flex flex-col p-4" style={{ height: "100dvh", background: "var(--color-bg)" }}>
      <div className="flex items-center justify-between mb-3 max-w-3xl mx-auto w-full shrink-0">
        <button
          type="button"
          onClick={() => setShowHomeConfirm(true)}
          className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          ← Hjem
        </button>
        <div className="text-center">
          {rewound && (
            <p style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.15em" }}>
              REDIGERER TIDLIGERE TUR
            </p>
          )}
          <p
            key={`${activePlayer}-${turnToken}`}
            className="animate-name-swap"
            style={{ color: accent, fontSize: "1.3rem", fontWeight: 600 }}
          >
            {activePlayer}
          </p>
        </div>
        <div style={{ width: "72px" }} />
      </div>

      {showHomeConfirm && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "var(--color-surface)" }}>
            <p className="text-center mb-6" style={{ color: "var(--color-cream)", fontSize: "1.1rem" }}>
              Pause spillet?
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowHomeConfirm(false);
                  onAbort();
                }}
                className={`tactile w-full py-3 rounded-lg font-medium ${FOCUS_RING}`}
                style={{ background: "var(--color-red)", color: "var(--color-cream)" }}
              >
                Avbryt spill (stats blir lagret)
              </button>
              <button
                type="button"
                onClick={() => setShowHomeConfirm(false)}
                className={`tactile w-full py-3 rounded-lg font-medium ${FOCUS_RING}`}
                style={{ background: "var(--color-green)", color: "var(--color-cream)" }}
              >
                Fortsett spill
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="relative flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden shadow-panel max-w-3xl mx-auto w-full"
        style={{ background: "var(--color-panel)" }}
      >
        {rewound && (
          <div key={flashKey} className="animate-rewind-flash absolute inset-0 z-20 rounded-xl pointer-events-none" aria-hidden />
        )}
        <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-hidden">
          <div
            className="grid h-full"
            style={{
              gridTemplateColumns: `64px repeat(${players.length}, minmax(64px, 1fr))`,
              gridTemplateRows: `auto repeat(${STEPS.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10" style={{ background: "var(--color-panel)" }} />
            {players.map((p) => {
              const isActive = p === activePlayer;
              return (
                <div
                  key={p}
                  className="relative flex flex-col items-center justify-center gap-1 p-2 text-center transition-colors duration-300"
                  style={{
                    borderBottom: isActive ? `2px solid ${accent}` : "2px solid var(--color-border)",
                  }}
                >
                  <span
                    className="absolute top-1 right-1.5 tabular"
                    style={{ color: "var(--color-muted)", fontSize: "0.65rem" }}
                  >
                    {dartsThrown[p] ?? 0}
                  </span>
                  <span className="relative inline-flex">
                    {isActive && (
                      <span
                        aria-hidden
                        className="animate-idle-glow absolute inset-0 rounded-full pointer-events-none"
                        style={{ boxShadow: `0 0 16px ${glowColor}` }}
                      />
                    )}
                    <span
                      key={isActive ? `active-${turnToken}` : "inactive"}
                      className={`relative px-2.5 py-0.5 rounded-full ${isActive ? "animate-column-glow" : ""}`}
                      style={
                        {
                          color: isActive ? accent : "var(--color-cream)",
                          fontSize: "0.85rem",
                          fontWeight: isActive ? 700 : 500,
                          background: isActive ? glowBg : "transparent",
                          "--glow-color": glowColor,
                        } as React.CSSProperties
                      }
                    >
                      {p}
                    </span>
                    {isActive && (
                      <svg
                        key={`swoosh-${turnToken}`}
                        viewBox="0 0 100 14"
                        preserveAspectRatio="none"
                        className="absolute left-0 w-full pointer-events-none"
                        style={{ top: "100%", height: "14px" }}
                        aria-hidden
                      >
                        <path
                          d="M4 6 Q50 -2 96 6"
                          fill="none"
                          stroke="var(--color-cream)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          pathLength={1}
                          className="animate-chalk-draw"
                          style={{ strokeDasharray: 1 }}
                        />
                      </svg>
                    )}
                  </span>
                </div>
              );
            })}

            {STEPS.map((s) => {
              return (
              <Fragment key={s}>
                <div
                  className="sticky left-0 z-10 flex items-center justify-center tabular"
                  style={{
                    color: "var(--color-cream)",
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    background: "var(--color-panel)",
                  }}
                >
                  {STEP_LABELS[s]}
                </div>
                {players.map((p) => {
                  const isActive = p === activePlayer;
                  const count = progress[p]?.[s] ?? 0;
                  const clickable = isActive && activeStep !== null && isRegistrable(s, activeStep, progress[p]);
                  return (
                    <div key={p} className="relative min-h-0 min-w-0 flex items-center justify-center p-1">
                      {clickable && (
                        <span
                          aria-hidden
                          className="animate-idle-glow absolute inset-1.5 rounded-md pointer-events-none"
                          style={{ boxShadow: `0 0 14px ${glowColor}` }}
                        />
                      )}
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => onRegisterHit(s)}
                        className={`relative w-full h-full min-h-0 min-w-0 max-w-full max-h-full rounded-md flex items-center justify-center ${clickable ? "tactile" : ""} ${FOCUS_RING}`}
                        style={{
                          background: count >= 3 ? "var(--color-cell-done)" : "var(--color-cell)",
                          boxShadow:
                            count >= 3
                              ? "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -8px 14px rgba(0,0,0,0.3)"
                              : "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 8px rgba(0,0,0,0.18)",
                          outline: clickable ? `2px solid ${accent}` : "none",
                          cursor: clickable ? "pointer" : "default",
                          opacity: clickable || count > 0 ? 1 : 0.5,
                        }}
                      >
                        <div className="w-full h-full p-1">
                          <Mark count={count} pendingCount={isActive ? pendingByStep[s] ?? 0 : 0} accent={accent} />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-3 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`tactile py-4 rounded-xl font-semibold text-lg transition-opacity ${FOCUS_RING}`}
            style={{ background: "var(--color-red)", color: "var(--color-cream)", opacity: canUndo ? 1 : 0.4 }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`tactile py-4 rounded-xl font-semibold text-lg ${FOCUS_RING}`}
            style={{ background: "var(--color-green)", color: "var(--color-cream)" }}
          >
            {pendingCount === 0 ? "Confirm (bom)" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
