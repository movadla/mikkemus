"use client";

import { useEffect, useState } from "react";
import type { BullDuelState } from "@/lib/bullDuel";
import { activePlayerFor, finishStateFor, remainingFor } from "@/lib/bullDuel";
import { FX_LABELS, useFxLevel } from "@/lib/fxLevel";
import { isAnnouncerEnabled, setAnnouncerEnabled } from "@/lib/announcer";
import { isShakeEnabled, setShakeEnabled } from "@/lib/screenShake";
import { requestRecalibration } from "@/lib/scoliaCommands";
import { reportError } from "@/lib/errorReporting";
import { primeAudio } from "@/lib/fanfare";
import { startWakeLock } from "@/lib/wakeLock";
import { ChromeControls, HEAT_GLOW, SHAKE, SHAKE_NAMES } from "./GameScreen";
import { ConfirmDialog } from "./ConfirmDialog";
import { FxMenu } from "./FxMenu";
import { ThrowerBar, type Thrower } from "./ThrowerBar";
import { ArrowLeftIcon, MoreIcon } from "./icons";
import { Sheet } from "./ui/Sheet";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The turn's darts so far — three boxes, filled in as they land: red for the inner bull (2), green for a hit (1). */
function ShotIndicator({ shots }: { shots: BullDuelState["turnShots"] }) {
  const boxes = [shots[0] ?? null, shots[1] ?? null, shots[2] ?? null];
  return (
    <div className="flex items-center justify-center gap-1.5 mt-1.5" aria-hidden={shots.length === 0}>
      {boxes.map((shot, i) => (
        <div
          key={i}
          className={shot ? "shot-box animate-shot-pop" : "shot-box"}
          style={{
            width: "2.4rem",
            height: "2.4rem",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "var(--text-small)",
            fontWeight: 700,
            background: shot ? (shot.points === 2 ? "var(--color-red)" : shot.points === 1 ? "var(--color-green)" : "var(--color-cell)") : "transparent",
            border: shot ? "none" : "1px dashed var(--color-border)",
            color: "var(--color-cream)",
          }}
        >
          {shot ? (shot.points > 0 ? shot.points : "–") : ""}
        </div>
      ))}
    </div>
  );
}

/**
 * Bull-duell's board, built the way the main game's is: the controls across the top, the thrower's bar with
 * the picture and the run, the scores, the three darts and the docked action bar with Angre and Bekreft. A hit shakes
 * the screen and builds heat across an unbroken turn, as it does there (and as the chosen animation level allows).
 */
export function BullDuelGameScreen({
  duel,
  isActiveBot,
  thrower,
  run,
  turnToken,
  hitPulse,
  canUndo,
  awaitingTakeout,
  animate,
  fxHeat,
  fxShake,
  fxFire,
  onManualHit,
  onBust,
  onConfirm,
  onUndo,
  onAbort,
}: {
  duel: BullDuelState;
  isActiveBot: boolean;
  thrower: Thrower;
  /** Darts in a row that scored, as the thrower's bar shows them. */
  run: number;
  turnToken: number;
  /** Retriggerable: a new token is a new hit, `streak` is how many have hit in this turn (1–3). */
  hitPulse: { token: number; streak: number } | null;
  canUndo: boolean;
  /** Three darts are in, and the board's takeout (or Bekreft) confirms the turn. */
  awaitingTakeout: boolean;
  animate: boolean;
  fxHeat: boolean;
  fxShake: boolean;
  fxFire: boolean;
  /** Manual reserve (no Scolia): the tapped outcome's Scolia-style sector string. */
  onManualHit: (sector: "Bull" | "25" | "None") => void;
  /** Bust: every dart left in the turn missed. */
  onBust: () => void;
  onConfirm: () => void;
  onUndo: () => void;
  onAbort: () => void;
}) {
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [fxMenuOpen, setFxMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcerOn, setAnnouncerOn] = useState(() => isAnnouncerEnabled());
  const [shakeOn, setShakeOn] = useState(() => isShakeEnabled());
  const [calibrating, setCalibrating] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const fxLevelNow = useFxLevel();
  const activePlayer = activePlayerFor(duel);
  const turnComplete = duel.dartsThisTurn >= 3 || duel.winner !== null;

  // The screen stays awake across a hands-free match, as in the main game.
  useEffect(() => startWakeLock(), []);

  async function handleCalibrate() {
    if (calibrating !== "idle") return;
    setCalibrating("sending");
    const ok = await requestRecalibration();
    setCalibrating(ok ? "sent" : "failed");
    setTimeout(() => setCalibrating("idle"), ok ? 4000 : 5000);
    if (!ok) reportError("Fikk ikke sendt kalibrering til brettet.", { key: "calibrate" });
  }

  // Shake and heat, the same way the main board does them (two identical keyframes per level, picked by the token's
  // parity, so two hits in a row both play).
  const shakeLevel = hitPulse && shakeOn && fxShake ? Math.min(3, Math.max(1, hitPulse.streak)) : 0;
  const shakeStep = SHAKE[shakeLevel];
  const shakeAnimation =
    hitPulse && shakeStep ? `${SHAKE_NAMES[shakeLevel][hitPulse.token % 2]} ${shakeStep.ms}ms ${shakeStep.ease}` : undefined;
  const heat = fxHeat ? hitPulse?.streak ?? 0 : 0;

  const btn = (fill: string, extra: React.CSSProperties = {}): React.CSSProperties =>
    ({ "--btn-fill": fill, color: "var(--color-cream)", minHeight: "var(--control-lg)", ...extra }) as React.CSSProperties;

  // The settings of the match, in the sheet behind the "⋯", as on the main board.
  const chromeProps = {
    onHome: () => setShowHomeConfirm(true),
    announcerOn,
    onToggleAnnouncer: () => {
      const next = !announcerOn;
      setAnnouncerOn(next);
      setAnnouncerEnabled(next);
    },
    shakeOn,
    onToggleShake: () => {
      const next = !shakeOn;
      setShakeOn(next);
      setShakeEnabled(next);
    },
    onCalibrate: handleCalibrate,
    calibrating,
    standAvailable: false,
    standOn: false,
    onToggleStand: () => {},
    fxLabel: FX_LABELS[fxLevelNow],
    onOpenFx: () => setFxMenuOpen(true),
  };

  return (
    <div
      className="game-root animate-screen-enter motion-hit relative w-full flex flex-col p-4"
      style={{ height: "100dvh", background: "var(--color-bg)", animation: shakeAnimation }}
      onPointerDownCapture={primeAudio}
    >
      <div
        className="absolute inset-0 pointer-events-none z-30"
        style={{ boxShadow: HEAT_GLOW[Math.min(3, heat)], transition: "box-shadow var(--pull)" }}
        aria-hidden
      />

      <div className="game-header landscape-tight flex items-center gap-2 mb-2 max-w-3xl mx-auto w-full shrink-0">
        <button
          type="button"
          onClick={() => setShowHomeConfirm(true)}
          className={`tactile rounded-lg text-sm inline-flex items-center justify-center gap-2 px-3 h-11 ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Hjem
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Meny"
          className={`tactile w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          <MoreIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto w-full mb-2 shrink-0">
        <ThrowerBar key={turnToken} thrower={thrower} team={null} stood={false} run={run} fire={fxFire} animate={animate} />
      </div>

      {fxMenuOpen && <FxMenu onClose={() => setFxMenuOpen(false)} />}
      {menuOpen && (
        <Sheet title="Kamp" onClose={() => setMenuOpen(false)}>
          <div className="grid gap-2">
            <ChromeControls {...chromeProps} stacked hideHome />
          </div>
        </Sheet>
      )}
      {showHomeConfirm && (
        <ConfirmDialog
          message="Avslutte Bull-duell? Kampen telles ikke."
          buttons={[
            { label: "Fortsett", onClick: () => setShowHomeConfirm(false), background: "var(--color-green)" },
            {
              label: "Avslutt kamp",
              onClick: () => {
                setShowHomeConfirm(false);
                onAbort();
              },
              background: "var(--color-red)",
            },
          ]}
        />
      )}

      <div className="max-w-3xl mx-auto w-full flex-1 min-h-0 overflow-y-auto">
        {duel.mode === "best3" && (
          <p className="text-center mb-2" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-body)", fontWeight: 600 }} role="status">
            {(duel.round ?? 1) > 1 ? `Likt. Omkast mellom ${(duel.contenders ?? []).join(" og ")}` : "Best av 3 piler"}
          </p>
        )}
        <div className="rounded-xl shadow-panel p-4 space-y-2" style={{ background: "var(--color-panel)" }}>
          {duel.players.map((p) => {
            const isActive = p === activePlayer;
            const points = duel.points[p];
            const pct = Math.min(100, Math.round((points / duel.target) * 100));
            const finish = finishStateFor(duel, p);
            const left = remainingFor(duel, p);
            const best3 = duel.mode === "best3";
            // Best of three darts: out of the round after a tie that others were not part of.
            const out = best3 && !(duel.contenders ?? duel.players).includes(p);
            return (
              <div
                key={p}
                data-col-player={p}
                {...(isActive ? { "data-col-active": "" } : {})}
                className="rounded-xl px-4 py-3 transition-all duration-300"
                style={{
                  background: isActive ? "var(--color-surface-2)" : "transparent",
                  boxShadow: isActive ? "var(--glow-teal), inset 0 1px 0 color-mix(in srgb, var(--light) 8%, transparent)" : "inset 0 0 0 1px color-mix(in srgb, var(--light) 5%, transparent)",
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate" style={{ color: isActive ? "var(--color-teal-strong)" : "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-body)" }}>
                    {p}
                  </span>
                  <span className="tabular shrink-0" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>
                    {points}
                    {!best3 && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)", fontWeight: 500 }}> / {duel.target}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--veil)", boxShadow: "inset 0 1px 1px var(--scrim-soft)" }} aria-hidden>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: finish ? "linear-gradient(90deg, #b8862e, var(--color-gold-strong))" : "linear-gradient(180deg, var(--color-teal-strong), var(--color-teal-deep))",
                        boxShadow: finish ? "0 0 12px color-mix(in srgb, var(--color-gold-strong) 50%, transparent)" : undefined,
                        transition: "width var(--weight)",
                      }}
                    />
                  </div>
                  <span className="tabular shrink-0" style={{ color: finish ? "var(--color-gold-strong)" : "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: 600, letterSpacing: "0.1em", minWidth: "4.5rem", textAlign: "right" }}>
                    {best3 ? (out ? "UTE" : isActive ? `${3 - duel.dartsThisTurn} PILER` : "") : finish === "matchdart" ? "MATCHDART" : finish === "out" ? "OUT" : `${left} IGJEN`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full shrink-0">
        <ShotIndicator shots={duel.turnShots} />
        {!isActiveBot && awaitingTakeout && turnComplete && (
          <p className="text-center mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
            Ta ut pilene for å bekrefte turen
          </p>
        )}
      </div>

      <div className="action-bar shrink-0 mt-3 -mx-4 px-4 pt-2 pb-1">
        {!isActiveBot && !turnComplete && (
          <div className="grid grid-cols-4 gap-2 max-w-3xl mx-auto w-full mb-3">
            <button type="button" onClick={() => onManualHit("Bull")} className={`glossy rounded-xl font-semibold ${FOCUS_RING}`} style={btn("var(--color-red)")}>
              Rødt (2)
            </button>
            <button type="button" onClick={() => onManualHit("25")} className={`glossy rounded-xl font-semibold ${FOCUS_RING}`} style={btn("var(--color-green)")}>
              Grønt (1)
            </button>
            <button type="button" onClick={() => onManualHit("None")} className={`glossy rounded-xl font-semibold ${FOCUS_RING}`} style={btn("var(--color-surface-2)", { border: "1px solid var(--color-hairline)" })}>
              Bom
            </button>
            <button
              type="button"
              onClick={onBust}
              aria-label="Bust: bom på alle pilene som er igjen i runden"
              className={`glossy rounded-xl font-semibold ${FOCUS_RING}`}
              style={btn("var(--color-surface)", { color: "var(--color-red)", border: "1px solid var(--color-red)" })}
            >
              Bust
            </button>
          </div>
        )}
        <div className="action-buttons grid gap-3 max-w-3xl mx-auto w-full" style={{ gridTemplateColumns: "0.7fr 1.3fr" }}>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || isActiveBot}
            className={`glossy py-4 rounded-xl font-semibold text-lg transition-opacity ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: canUndo && !isActiveBot ? 1 : 0.4 } as React.CSSProperties}
          >
            Angre
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!turnComplete || isActiveBot}
            className={`glossy py-5 rounded-xl font-bold text-xl transition-opacity ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", opacity: turnComplete && !isActiveBot ? 1 : 0.4 } as React.CSSProperties}
          >
            Bekreft
          </button>
        </div>
      </div>
    </div>
  );
}
