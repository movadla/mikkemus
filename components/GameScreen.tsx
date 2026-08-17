"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  STEPS,
  STEP_LABELS,
  currentStepFor,
  isRegistrable,
  nextStepAfter,
  type PendingAmbiguous,
  type PlayerProgress,
  type Step,
  type TurnShot,
} from "@/lib/game";
import { isAnnouncerEnabled, setAnnouncerEnabled } from "@/lib/announcer";
import { ConfirmDialog } from "./ConfirmDialog";
import { Mark } from "./Mark";
import { SpeakerIcon, SpeakerMuteIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Props = {
  players: string[];
  progress: PlayerProgress;
  activePlayer: string | null;
  turnToken: number;
  dartsThrown: Record<string, number>;
  pendingByStep: Partial<Record<Step, number>>;
  turnShots: (TurnShot | null)[];
  /** Which player's just-finished-turn marks should still render in the "just placed" accent tint, and which steps. */
  recentlyConfirmed: { player: string; byStep: Partial<Record<Step, number>> } | null;
  rewound: boolean;
  pendingCount: number;
  canUndo: boolean;
  /** The most recent undecided triple/double-on-active-number hit, if any — drives the ghost preview and, once awaitingConfirmResolution, the choice dialog. */
  pendingChoice: PendingAmbiguous | null;
  awaitingConfirmResolution: boolean;
  onResolvePendingChoice: (choice: "keep" | "redirect") => void;
  onRegisterHit: (step: Step) => void;
  onUndo: () => void;
  onConfirm: () => void;
  onAbort: () => void;
};

/** The three per-dart boxes under the active player's name — green on a scored cross, red otherwise. */
function ShotIndicator({ shots }: { shots: (TurnShot | null)[] }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-1.5" aria-hidden={shots.every((s) => s === null)}>
      {shots.map((shot, i) => (
        <div
          key={i}
          className={shot ? "animate-shot-pop" : undefined}
          style={{
            width: "1.9rem",
            height: "1.9rem",
            borderRadius: "0.4rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            fontWeight: 700,
            background: shot ? (shot.hit ? "var(--color-green)" : "var(--color-red)") : "var(--color-surface)",
            border: shot ? "none" : "1px solid var(--color-border)",
            color: "var(--color-cream)",
          }}
        >
          {shot?.label ?? ""}
        </div>
      ))}
    </div>
  );
}

export function GameScreen({
  players,
  progress,
  activePlayer,
  turnToken,
  dartsThrown,
  pendingByStep,
  turnShots,
  recentlyConfirmed,
  rewound,
  pendingCount,
  canUndo,
  pendingChoice,
  awaitingConfirmResolution,
  onResolvePendingChoice,
  onRegisterHit,
  onUndo,
  onConfirm,
  onAbort,
}: Props) {
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const wasRewound = useRef(false);
  // Lazy-initialized from localStorage so the button reflects whatever the host last chose,
  // without waiting for an effect — announce() itself reads the same localStorage value
  // directly, so this state only drives the button's own icon/label.
  const [announcerOn, setAnnouncerOn] = useState(() => isAnnouncerEnabled());

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

  // What redirecting pendingChoice would look like: how many extra crosses land on
  // its number (ghost preview there) and whether that fully completes it, in which
  // case the next number's cells preview as "about to open" too.
  const activeProgress = activePlayer ? progress[activePlayer] : undefined;
  const pendingPreview = pendingChoice
    ? (() => {
        const current = activeProgress?.[pendingChoice.number] ?? 0;
        const simulated = Math.min(3, current + pendingChoice.multiplier);
        const wouldComplete = simulated >= 3;
        return { number: pendingChoice.number, ghostCount: simulated - current, opensNext: wouldComplete ? nextStepAfter(pendingChoice.number) : null };
      })()
    : null;
  const ringLabel = pendingChoice?.ringStep === "T" ? "Trippel" : "Dobbel";

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
          {!rewound && <ShotIndicator shots={turnShots} />}
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !announcerOn;
            setAnnouncerOn(next);
            setAnnouncerEnabled(next);
          }}
          aria-label={announcerOn ? "Skru av kommentator" : "Skru på kommentator"}
          className={`tactile w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: announcerOn ? "var(--color-teal)" : "var(--color-muted)" }}
        >
          {announcerOn ? <SpeakerIcon className="w-4 h-4" /> : <SpeakerMuteIcon className="w-4 h-4" />}
        </button>
      </div>

      {awaitingConfirmResolution && pendingChoice && (
        <ConfirmDialog
          message={
            <>
              Du traff {ringLabel} {STEP_LABELS[pendingChoice.number]} — hvor skal kastet telle?
            </>
          }
          messageFontSize="1.05rem"
          buttons={[
            {
              label: `Fullfør ${STEP_LABELS[pendingChoice.number]} (${pendingChoice.multiplier}x)`,
              onClick: () => onResolvePendingChoice("redirect"),
              background: "var(--color-green)",
            },
            {
              label: `Behold på ${ringLabel}`,
              onClick: () => onResolvePendingChoice("keep"),
              background: "var(--color-teal)",
              color: "var(--color-bg)",
            },
          ]}
        />
      )}

      {showHomeConfirm && (
        <ConfirmDialog
          message="Pause spillet?"
          buttons={[
            {
              label: "Avbryt spill (stats blir lagret)",
              onClick: () => {
                setShowHomeConfirm(false);
                onAbort();
              },
              background: "var(--color-red)",
            },
            { label: "Fortsett spill", onClick: () => setShowHomeConfirm(false), background: "var(--color-green)" },
          ]}
        />
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
                    style={{ color: "var(--color-cream)", opacity: 0.55, fontSize: "0.72rem" }}
                  >
                    {dartsThrown[p] ?? 0}
                  </span>
                  <span className="relative inline-flex max-w-full min-w-0">
                    {isActive && (
                      <span
                        aria-hidden
                        className="animate-idle-glow absolute inset-0 rounded-full pointer-events-none"
                        style={{ boxShadow: `0 0 16px ${glowColor}` }}
                      />
                    )}
                    <span
                      key={isActive ? `active-${turnToken}` : "inactive"}
                      className={`relative block max-w-full truncate px-2.5 py-0.5 rounded-full ${isActive ? "animate-column-glow" : ""}`}
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
                  const ghostCount = isActive && pendingPreview?.number === s ? pendingPreview.ghostCount : 0;
                  const previewOpening = isActive && pendingPreview?.opensNext === s;
                  // The active player's own in-progress turn takes priority; otherwise, this
                  // player's just-finished turn stays highlighted until the darts are taken out
                  // (see MikkeMusApp's clearTurnDisplay) rather than flipping to settled gold
                  // the instant the turn moves to someone else.
                  const heldPendingCount = isActive
                    ? pendingByStep[s] ?? 0
                    : recentlyConfirmed?.player === p
                      ? recentlyConfirmed.byStep[s] ?? 0
                      : 0;
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
                          outline: clickable
                            ? `2px solid ${accent}`
                            : previewOpening
                              ? `2px dashed ${accent}`
                              : "none",
                          cursor: clickable ? "pointer" : "default",
                          opacity: clickable || count > 0 || previewOpening ? 1 : 0.5,
                        }}
                      >
                        <div className="w-full h-full p-1">
                          <Mark count={count} pendingCount={heldPendingCount} ghostCount={ghostCount} accent={accent} />
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
            className={`glossy py-4 rounded-xl font-semibold text-lg transition-opacity ${FOCUS_RING}`}
            style={
              {
                "--btn-fill": "var(--color-surface)",
                color: "var(--color-cream)",
                border: "1px solid var(--color-border)",
                opacity: canUndo ? 1 : 0.4,
              } as React.CSSProperties
            }
          >
            Angre
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`glossy py-4 rounded-xl font-semibold text-lg ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
          >
            {pendingCount === 0 ? "Bekreft (bom)" : "Bekreft"}
          </button>
        </div>
      </div>
    </div>
  );
}
