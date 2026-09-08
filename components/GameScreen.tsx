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
import { requestRecalibration } from "@/lib/scoliaCommands";
import { reportError } from "@/lib/errorReporting";
import { useCompactLandscape } from "@/lib/useCompactLandscape";
import { LiveSidePanel } from "./LiveSidePanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { Mark } from "./Mark";
import { CalibrateIcon, DartIcon, SpeakerIcon, SpeakerMuteIcon } from "./icons";

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
  "inset 0 0 60px 6px var(--heat-1)",
  "inset 0 0 90px 12px var(--heat-2)",
  "inset 0 0 130px 20px var(--heat-3)",
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
  /** Per player, the steps closed by three separate darts in one turn — see Mark's `perfect`. */
  perfectCloses: Record<string, Partial<Record<Step, true>>>;
  /** The active player's dart coordinates this match, for the landscape side panel's board. */
  matchThrows: [number, number][];
  /** How many of those belong to the turn in progress — drawn bright, the rest recede. */
  dartsThisTurn: number;
  /** Live treff%/xH for the active player, or null when there is no active player. */
  liveStats: { hitPct: number | null; expected: number | null; actual: number } | null;
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
          className={`shot-box${shot ? " animate-shot-pop" : ""}`}
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
  rewound,
  pendingCount,
  canUndo,
  pendingChoice,
  awaitingConfirmResolution,
  hitPulse,
  closedStep,
  perfectCloses,
  onResolvePendingChoice,
  onRegisterHit,
  matchThrows,
  dartsThisTurn,
  liveStats,
  onUndo,
  onConfirm,
  onAbort,
}: Props) {
  // Picks the wide variant of the mark glyph — see lib/useCompactLandscape.ts.
  const compactLandscape = useCompactLandscape();
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

  // The board takes a few seconds to go Calibrating → Ready, and the Scolia badge already
  // reports that, so this only has to confirm the request left the building — or say it
  // didn't, rather than leaving someone watching a board that will never move.
  const [calibrating, setCalibrating] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function handleCalibrate() {
    if (calibrating !== "idle") return;
    setCalibrating("sending");
    const ok = await requestRecalibration();
    setCalibrating(ok ? "sent" : "failed");
    setTimeout(() => setCalibrating("idle"), ok ? 4000 : 5000);
    if (!ok) reportError("Fikk ikke sendt kalibrering til brettet.", { key: "calibrate" });
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
      className="game-root animate-screen-enter motion-hit relative w-full flex flex-col p-4"
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
      {/* Chrome only: navigation and settings. The turn's own darts used to sit between these
          two, mixing game state into a bar of controls — they've moved down next to Bekreft,
          where the eye already is at the end of a turn and where the button that acts on them
          lives. */}
      <div className="game-header landscape-tight flex items-center gap-2 mb-2 max-w-3xl mx-auto w-full shrink-0">
        <button
          type="button"
          onClick={() => setShowHomeConfirm(true)}
          className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          ← Hjem
        </button>
        {/* Not gold: this is a mode warning, not something earned, and gold only means the
            latter (see globals.css). Red is the app's "careful" colour. */}
        {rewound && (
          <p style={{ color: "var(--color-red)", fontSize: "var(--text-meta)", letterSpacing: "0.15em" }}>
            REDIGERER TIDLIGERE TUR
          </p>
        )}
        {/* Both of these sit on the LEFT beside Hjem. They used to be pinned right, where the
            fixed "Scolia: …" badge overlaps them the moment the screen is phone-width. */}
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
        <button
          type="button"
          onClick={handleCalibrate}
          disabled={calibrating !== "idle"}
          aria-label="Kalibrer brettet"
          title="Kalibrer brettet"
          className={`tactile w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${FOCUS_RING}`}
          style={{
            background: "var(--color-surface)",
            color:
              calibrating === "sent"
                ? "var(--color-teal)"
                : calibrating === "failed"
                  ? "var(--color-red)"
                  : "var(--color-muted)",
            opacity: calibrating === "sending" ? 0.5 : 1,
          }}
        >
          <CalibrateIcon className="w-4 h-4" />
        </button>
      </div>

      {awaitingConfirmResolution && pendingChoice && (
        <ConfirmDialog
          message={
            (() => {
              // The ring cross is applied the moment the dart lands, so the counts on screen
              // ALREADY include it. Adding one more to show the "keep" outcome counted it
              // twice; keeping simply leaves things where they are.
              const ringNow = activeProgress?.[pendingChoice.ringStep] ?? 0;
              const numberNow = activeProgress?.[pendingChoice.number] ?? 0;
              return (
                <>
                  <div>
                    Du traff {ringLabel} {STEP_LABELS[pendingChoice.number]} — hvor skal kastet telle?
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                    Nå: {STEP_LABELS[pendingChoice.number]} på {numberNow}/3, {ringLabel} på {ringNow}/3
                  </div>
                </>
              );
            })()
          }
          messageFontSize="1.05rem"
          buttons={[
            {
              // Redirecting rolls the ring cross back and puts the multiplier on the number
              // instead — so each label states where that choice actually leaves you.
              label: (() => {
                const numberNow = activeProgress?.[pendingChoice.number] ?? 0;
                const after = Math.min(3, numberNow + pendingChoice.multiplier);
                return `Fullfør ${STEP_LABELS[pendingChoice.number]} → ${after}/3${after >= 3 ? " (ferdig)" : ""}`;
              })(),
              onClick: () => onResolvePendingChoice("redirect"),
              background: "var(--color-green)",
            },
            {
              label: `Behold på ${ringLabel} (${activeProgress?.[pendingChoice.ringStep] ?? 0}/3)`,
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
        className="game-board relative flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden shadow-panel max-w-3xl mx-auto w-full"
        style={{ background: "var(--color-panel)" }}
      >
        {/* See .scroll-hint-right for why this is a player-count heuristic rather than a
            measured overflow. */}
        {players.length >= 5 && (
          <div className="scroll-hint-right absolute top-0 right-0 bottom-0 w-8 z-20 pointer-events-none" aria-hidden />
        )}
        <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto">
          <div
            className="game-grid grid h-full"
            style={{
              // Landscape caps the player columns instead of stretching them. A row is only ~34px
              // tall there, which caps how big the mark can be drawn, and a mark that size floating
              // in a 600px-wide cell reads as a speck. The box is sized to sit just around a square
              // mark instead — near enough to the row height that the cell looks like a cell rather
              // than a stretched strip. Portrait keeps 1fr: there the cell is narrow enough already.
              gridTemplateColumns: compactLandscape
                ? `48px repeat(${players.length}, minmax(0, 4.5rem))`
                : `64px repeat(${players.length}, minmax(64px, 1fr))`,
              justifyContent: compactLandscape ? "center" : undefined,
              // A floor, not a fixed height: rows still stretch to fill a tall portrait screen, but
              // never compress below something you can actually hit with a thumb. Past that the
              // grid scrolls instead, which is what makes landscape usable at all.
              gridTemplateRows: `auto repeat(${STEPS.length}, minmax(var(--row-min, 2.4rem), 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10" style={{ background: "var(--color-panel)" }} />
            {players.map((p) => {
              const isActive = p === activePlayer;
              return (
                <div
                  key={p}
                  className={`player-head relative flex flex-col items-center justify-center gap-1.5 p-2 pb-2.5 text-center transition-colors duration-300 grid-rule-left ${isActive ? "column-active" : ""}`}
                  style={{
                    borderBottom: isActive ? `2px solid ${accent}` : "2px solid var(--color-border)",
                  }}
                >
                  {/* A bare number in the corner meant nothing without knowing the app — the
                      dart icon says what's being counted in less space than a word would. */}
                  <span
                    className="darts-badge absolute top-1 right-1.5 tabular px-1.5 rounded flex items-center gap-0.5"
                    style={{
                      color: "var(--color-muted)",
                      fontSize: "0.66rem",
                      background: "rgba(0,0,0,0.25)",
                      lineHeight: "1.35",
                    }}
                    title={`${dartsThrown[p] ?? 0} piler kastet`}
                  >
                    <DartIcon className="w-2.5 h-2.5" />
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
                  className={`motion-slam grid-rule-top sticky left-0 z-10 flex items-center justify-center tabular relative ${s === activeStep ? "row-active-label" : ""}`}
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
                  // Only the active player's own unconfirmed marks are provisional. A finished
                  // turn settles to cream at Confirm rather than staying accent-coloured until
                  // the darts come out — accent then means exactly one thing, "not locked in
                  // yet", and what you just threw is still readable in the ShotIndicator up top.
                  const heldPendingCount = isActive ? pendingByStep[s] ?? 0 : 0;
                  // Ring state is one choice, not several stacked. The full ring is reserved
                  // for the cell on the player's current step; D/T are clickable at all times
                  // (pre-banking) and take the quiet ring, so they read as available without
                  // competing with the actual target.
                  const isTarget = clickable && s === activeStep;
                  const tileState = isTarget
                    ? "cell-tile--active"
                    : clickable
                      ? "cell-tile--open"
                      : previewOpening
                        ? "cell-tile--preview"
                        : "";
                  return (
                    <div
                      key={p}
                      className={`cell-wrap relative min-h-0 min-w-0 flex items-center justify-center p-1 grid-rule-top grid-rule-left ${isActive ? "column-active" : ""} ${s === activeStep ? "row-active" : ""}`}
                    >
                      {/* Only the current target breathes. It used to run on every clickable
                          cell, which meant the always-open D and T rows pulsed all match. */}
                      {isTarget && (
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
                        <div className="mark-pad w-full h-full p-1">
                          <Mark
                            count={count}
                            pendingCount={heldPendingCount}
                            ghostCount={ghostCount}
                            accent={accent}
                            slowMotion={isActive && retracting}
                            perfect={!!perfectCloses[p]?.[s]}
                            compact={compactLandscape}
                          />
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

      {/* Landscape gives the three "what you just threw" boxes their own lane beside the board,
          where they have the height to be read at a glance. Portrait keeps them in the action
          bar, which is where there is room there. */}
      {compactLandscape && !rewound && (
        <div className="shot-rail">
          <ShotIndicator shots={turnShots} />
        </div>
      )}

      {/* Landscape only — this fills the gap in the right-hand column. In portrait there is no
          gap to fill, and the same content would push the board off screen. */}
      {compactLandscape && activePlayer && liveStats && (
        <div className="live-side">
          <LiveSidePanel
            playerName={activePlayer}
            throws={matchThrows}
            recentFrom={Math.max(0, matchThrows.length - dartsThisTurn)}
            darts={(dartsThrown[activePlayer] ?? 0) + dartsThisTurn}
            hitPct={liveStats.hitPct}
            expected={liveStats.expected}
            actual={liveStats.actual}
          />
        </div>
      )}

      <div className="action-bar shrink-0 mt-3 -mx-4 px-4 pt-2 pb-1">
        {!rewound && !compactLandscape && (
          <div className="max-w-3xl mx-auto w-full mb-1">
            <ShotIndicator shots={turnShots} />
          </div>
        )}
        <div className="action-buttons grid gap-3 max-w-3xl mx-auto w-full" style={{ gridTemplateColumns: "0.7fr 1.3fr" }}>
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
