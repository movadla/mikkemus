"use client";

import { Fragment, useEffect, useState } from "react";
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
import { avatarAccent } from "@/lib/avatarAccent";
import { primeAudio } from "@/lib/fanfare";
import { startWakeLock } from "@/lib/wakeLock";
import { ConfirmDialog } from "./ConfirmDialog";
import { Mark } from "./Mark";
import { SpeakerIcon, SpeakerMuteIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

// How long a just-undone cross stays in its slow-motion un-draw (see Mark's
// slowMotion prop) — long enough to be unmistakable, short enough not to
// block the next dart.
const RETRACT_MS = 650;

/** Kept just past each animation's own length, so the class is removed only after it has
 *  finished playing and the next hit re-applies it from the start. */
const SHAKE_MS = 320;
const SLAM_MS = 560;

/** Heat left on the screen by an unbroken turn, indexed by how many darts have hit. Held
 *  until the turn ends rather than fading per dart — the build across the turn is the
 *  point, mirroring how the boom's tail grows (see lib/fanfare.ts). */
const HEAT_GLOW = [
  "none",
  "inset 0 0 60px 6px rgba(201, 162, 75, 0.10)",
  "inset 0 0 90px 12px rgba(211, 132, 60, 0.20)",
  "inset 0 0 130px 20px rgba(214, 92, 58, 0.34)",
];

/** Two identical keyframes per level — see the comment where these are used for why the
 *  duplication is the mechanism rather than an oversight. */
const SHAKE_NAMES = [
  ["", ""],
  ["hit-shake-soft-a", "hit-shake-soft-b"],
  ["hit-shake-firm-a", "hit-shake-firm-b"],
  ["hit-shake-hard-a", "hit-shake-hard-b"],
];

const SLAM_NAMES = ["step-slam-a", "step-slam-b"];

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
  /** Retriggerable "a dart just landed" signal, with how many in a row have hit this turn —
   *  drives the screen shake and the heat that builds across an unbroken turn. Token rather
   *  than a boolean so two identical hits in a row still read as two separate events. */
  hitPulse: { token: number; streak: number } | null;
  /** Retriggerable "this row just reached 3/3" signal, for the closing slam. */
  closedStep: { token: number; step: Step } | null;
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
  hitPulse,
  closedStep,
  onResolvePendingChoice,
  onRegisterHit,
  onUndo,
  onConfirm,
  onAbort,
}: Props) {
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  // Lazy-initialized from localStorage so the button reflects whatever the host last chose,
  // without waiting for an effect — announce() itself reads the same localStorage value
  // directly, so this state only drives the button's own icon/label.
  const [announcerOn, setAnnouncerOn] = useState(() => isAnnouncerEnabled());

  // Retriggerable "just undid a dart" window — drives Mark's slow-motion un-draw below.
  // Replaces an earlier full-panel red flash, which read as an error state rather than
  // "this stroke was removed".
  const [retractToken, setRetractToken] = useState(0);
  const [retracting, setRetracting] = useState(false);
  useEffect(() => {
    if (retractToken === 0) return;
    const timer = setTimeout(() => setRetracting(false), RETRACT_MS);
    return () => clearTimeout(timer);
  }, [retractToken]);

  // Keeps the screen from locking while this screen is mounted — see lib/wakeLock.ts for
  // why (a hands-free Scolia match has no further tap to re-unlock audio once iOS
  // suspends it after the phone naturally times out between darts).
  useEffect(() => startWakeLock(), []);

  // Shake and slam are derived straight from the incoming tokens rather than mirrored into
  // state on a timer. A CSS animation only restarts when its animation-name actually
  // changes, so each level has two identical keyframes and the token's parity picks between
  // them — two identical hits in a row still replay, with no state, effect or timeout here.
  const shakeAnimation = hitPulse ? `${SHAKE_NAMES[Math.min(3, hitPulse.streak)][hitPulse.token % 2]} ${SHAKE_MS}ms ease-out` : undefined;
  const slamAnimation = closedStep ? `${SLAM_NAMES[closedStep.token % 2]} ${SLAM_MS}ms cubic-bezier(0.2, 0.9, 0.25, 1) both` : undefined;
  // Heat belongs to the turn, not the dart: the parent clears hitPulse when a turn ends
  // (see clearTurnDisplay), so this stays lit across an unbroken turn and drops on its own.
  const heat = hitPulse?.streak ?? 0;

  function handleUndo() {
    setRetractToken((t) => t + 1);
    setRetracting(true);
    onUndo();
  }

  const activeStep = activePlayer ? currentStepFor(progress[activePlayer]) : null;
  const accent = "var(--color-teal)";
  const glowColor = "rgba(47, 180, 194, 0.35)";

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

  /** 20-14 are the ordered run; D/T/BULL are a different kind of target and are set apart. */
  const isNumberStep = (s: Step) => !Number.isNaN(Number(s));
  /** Every player has finished this row, so it's settled history rather than live board. */
  const allClosed = (s: Step) => players.length > 0 && players.every((p) => (progress[p]?.[s] ?? 0) >= 3);

  return (
    <div
      className="animate-screen-enter motion-hit relative w-full flex flex-col p-4"
      style={{ height: "100dvh", background: "var(--color-bg)", animation: shakeAnimation }}
      // Covers resuming an in-progress match after a page reload, where startGame's own
      // primeAudio() call never ran this session — the first tap anywhere on this screen
      // unlocks audio instead, well before any win-fanfare/hit-streak sound needs it.
      onPointerDownCapture={primeAudio}
    >
      {/* Heat from an unbroken turn — sits above the board but takes no pointer events, so
          it can never swallow a tap meant for a cell. */}
      <div
        className="absolute inset-0 pointer-events-none z-30"
        style={{
          boxShadow: HEAT_GLOW[Math.min(3, heat)],
          transition: "box-shadow 320ms var(--ease-standard, ease-out)",
        }}
        aria-hidden
      />
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
            (() => {
              const ringCount = activeProgress?.[pendingChoice.ringStep] ?? 0;
              const numberCount = activeProgress?.[pendingChoice.number] ?? 0;
              const ringResult = Math.min(3, ringCount + 1);
              const numberResult = Math.min(3, numberCount + pendingChoice.multiplier);
              return (
                <>
                  <div>
                    Du traff {ringLabel} {STEP_LABELS[pendingChoice.number]} — hvor skal kastet telle?
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                    {ringLabel}: {ringCount}/3 → {ringResult}/3 · {STEP_LABELS[pendingChoice.number]}: {numberCount}/3 → {numberResult}
                    /3{numberResult >= 3 ? " (ferdig)" : ""}
                  </div>
                </>
              );
            })()
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
          message="Avslutte kampen?"
          buttons={[
            { label: "Fortsett spill", onClick: () => setShowHomeConfirm(false), background: "var(--color-green)" },
            {
              label: "Avslutt kamp (stat lagres ikke)",
              onClick: () => {
                setShowHomeConfirm(false);
                onAbort();
              },
              background: "var(--color-red)",
            },
          ]}
        />
      )}

      <div
        className="relative flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden shadow-panel max-w-3xl mx-auto w-full"
        style={{ background: "var(--color-panel)" }}
      >
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
                  className={`relative flex flex-col items-center justify-center gap-1.5 p-2 pb-2.5 text-center transition-colors duration-300 grid-rule-left ${isActive ? "column-active" : ""}`}
                  style={{
                    borderBottom: isActive ? `2px solid ${accent}` : "2px solid var(--color-border)",
                  }}
                >
                  <span
                    className="absolute top-1 right-1.5 tabular px-1.5 rounded"
                    style={{
                      color: "var(--color-muted)",
                      fontSize: "0.66rem",
                      background: "rgba(0,0,0,0.25)",
                      lineHeight: "1.35",
                    }}
                    title="Piler kastet"
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
                      className={`relative block max-w-full truncate px-3 py-0.5 rounded-full transition-all duration-300 ${isActive ? "animate-column-glow" : ""}`}
                      style={
                        {
                          color: isActive ? "var(--color-bg)" : "var(--color-cream)",
                          // One fixed size for both states. The old jump from 0.85 to 1.05rem
                          // shifted the whole header's layout on every single turn change.
                          fontSize: "0.95rem",
                          fontWeight: isActive ? 700 : 500,
                          background: isActive ? accent : "rgba(255,255,255,0.04)",
                          boxShadow: isActive
                            ? "0 1px 0 rgba(255,255,255,0.3) inset, 0 2px 8px rgba(0,0,0,0.35)"
                            : "0 1px 0 rgba(255,255,255,0.05) inset",
                          "--glow-color": glowColor,
                        } as React.CSSProperties
                      }
                    >
                      {p}
                    </span>
                  </span>
                  {/* Fixed per-player colour, always on, so the same name reads as the same
                      player turn after turn. Moved off the name pill's border, where it fought
                      with the teal active state for the same edge. */}
                  <span
                    aria-hidden
                    className="block rounded-full"
                    style={{ width: "26px", height: "3px", background: avatarAccent(p), opacity: isActive ? 1 : 0.65 }}
                  />
                </div>
              );
            })}

            {STEPS.map((s) => {
              return (
              <Fragment key={s}>
                <div
                  className="motion-slam grid-rule-top sticky left-0 z-10 flex items-center justify-center tabular"
                  style={{
                    // A step everyone has closed is done business — it fades back rather than
                    // shouting the same as the live rows above it.
                    color: closedStep?.step === s ? "var(--color-gold)" : allClosed(s) ? "var(--color-muted)" : "var(--color-cream)",
                    // Numbers are the run you work through in order; D/T/BULL are a different
                    // kind of target, so they're set apart rather than dressed identically.
                    fontFamily: isNumberStep(s) ? "var(--font-display)" : "var(--font-sans)",
                    fontSize: isNumberStep(s) ? "1.35rem" : "0.95rem",
                    fontWeight: isNumberStep(s) ? 600 : 700,
                    letterSpacing: isNumberStep(s) ? "0" : "0.08em",
                    background: "var(--color-panel)",
                    transition: "color 320ms var(--ease-standard, ease-out)",
                    animation: closedStep?.step === s ? slamAnimation : undefined,
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
                  // Ring state is one choice, not three stacked ones: playable outranks the
                  // would-open-next preview, and a settled cell carries neither.
                  const tileState = clickable ? "cell-tile--active" : previewOpening ? "cell-tile--preview" : "";
                  return (
                    <div
                      key={p}
                      className={`relative min-h-0 min-w-0 flex items-center justify-center p-1 grid-rule-top grid-rule-left ${isActive ? "column-active" : ""}`}
                    >
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
                        className={`cell-tile ${count >= 3 ? "cell-tile--done" : ""} ${tileState} relative w-full h-full min-h-0 min-w-0 max-w-full max-h-full rounded-md flex items-center justify-center ${FOCUS_RING}`}
                        style={{
                          cursor: clickable ? "pointer" : "default",
                          // Untouched, unreachable cells recede rather than disappear — still
                          // legible as part of the board, just clearly not in play.
                          opacity: clickable || count > 0 || previewOpening ? 1 : 0.55,
                          transform: clickable ? "translateY(-1px)" : undefined,
                        }}
                      >
                        <div className="w-full h-full p-1">
                          <Mark count={count} pendingCount={heldPendingCount} ghostCount={ghostCount} accent={accent} slowMotion={isActive && retracting} />
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

      <div className="action-bar shrink-0 mt-3 -mx-4 px-4 pt-3 pb-1">
        <div className="grid gap-3 max-w-3xl mx-auto w-full" style={{ gridTemplateColumns: "0.7fr 1.3fr" }}>
          <button
            type="button"
            onClick={handleUndo}
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
            className={`glossy py-5 rounded-xl font-bold text-xl ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
          >
            {pendingCount === 0 ? "Bekreft (bom)" : "Bekreft"}
          </button>
        </div>
      </div>
    </div>
  );
}
