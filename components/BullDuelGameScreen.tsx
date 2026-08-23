"use client";

import { useState } from "react";
import type { BullDuelState } from "@/lib/bullDuel";
import { activePlayerFor } from "@/lib/bullDuel";
import { ConfirmDialog } from "./ConfirmDialog";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The turn's darts so far — 3 boxes, filled in as they land. Simpler than the
 *  main game's ShotIndicator (only 3 possible outcomes here: red/green/miss). */
function ShotIndicator({ shots }: { shots: BullDuelState["turnShots"] }) {
  const boxes = [shots[0] ?? null, shots[1] ?? null, shots[2] ?? null];
  return (
    <div className="flex items-center justify-center gap-1.5 mt-1.5">
      {boxes.map((shot, i) => (
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
            fontSize: "0.65rem",
            fontWeight: 700,
            background: shot ? (shot.points > 0 ? "var(--color-green)" : "var(--color-red)") : "var(--color-surface)",
            border: shot ? "none" : "1px solid var(--color-border)",
            color: "var(--color-cream)",
          }}
        >
          {shot ? shot.points : ""}
        </div>
      ))}
    </div>
  );
}

export function BullDuelGameScreen({
  duel,
  isActiveBot,
  onManualHit,
  onConfirm,
  onAbort,
}: {
  duel: BullDuelState;
  isActiveBot: boolean;
  /** Manual reserve (no Scolia): the tapped outcome's Scolia-style sector string. */
  onManualHit: (sector: "Bull" | "25" | "None") => void;
  onConfirm: () => void;
  onAbort: () => void;
}) {
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const activePlayer = activePlayerFor(duel);
  const turnComplete = duel.dartsThisTurn >= 3;

  return (
    <div className="animate-screen-enter w-full flex flex-col p-4" style={{ height: "100dvh", background: "var(--color-bg)" }}>
      <div className="flex items-center justify-between mb-3 max-w-2xl mx-auto w-full shrink-0">
        <button
          type="button"
          onClick={() => setShowHomeConfirm(true)}
          className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          ← Hjem
        </button>
        <p style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>BULL-DUELL</p>
        <div style={{ width: "72px" }} />
      </div>

      {showHomeConfirm && (
        <ConfirmDialog
          message="Avslutte Bull-duell? Fremgangen i denne kampen går tapt — ingenting telles i statistikken før noen faktisk vinner."
          buttons={[
            { label: "Fortsett spill", onClick: () => setShowHomeConfirm(false), background: "var(--color-green)" },
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

      <div className="flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full">
        {/* Active player — deliberately the biggest, boldest element on screen: manual
           registration is easy to mis-attribute to the wrong player otherwise. */}
        <div className="text-center py-6 shrink-0">
          <p style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.15em" }}>NÅ KASTER</p>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "2.4rem", lineHeight: 1.1 }}>
            {activePlayer}
          </h1>
          <ShotIndicator shots={duel.turnShots} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl shadow-panel p-3 space-y-2" style={{ background: "var(--color-panel)" }}>
          {duel.players.map((p) => {
            const isActive = p === activePlayer;
            const points = duel.points[p];
            const pct = Math.min(100, Math.round((points / duel.target) * 100));
            return (
              <div
                key={p}
                className="flex items-center justify-between rounded-lg p-3 transition-colors duration-300"
                style={{
                  background: isActive ? "var(--color-surface)" : "transparent",
                  border: isActive ? "2px solid var(--color-teal)" : "2px solid transparent",
                }}
              >
                <span style={{ color: "var(--color-cream)", fontWeight: isActive ? 700 : 400 }}>{p}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }} aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-teal)" }} />
                  </div>
                  <span className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.1rem", minWidth: "3.5rem", textAlign: "right" }}>
                    {points} / {duel.target}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {!isActiveBot && (
          <div className="shrink-0 pt-3">
            {!turnComplete && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => onManualHit("Bull")}
                  className={`glossy py-5 rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-red)", color: "var(--color-cream)" } as React.CSSProperties}
                >
                  Rødt (2)
                </button>
                <button
                  type="button"
                  onClick={() => onManualHit("25")}
                  className={`glossy py-5 rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-green)", color: "var(--color-cream)" } as React.CSSProperties}
                >
                  Grønt (1)
                </button>
                <button
                  type="button"
                  onClick={() => onManualHit("None")}
                  className={`glossy py-5 rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" } as React.CSSProperties}
                >
                  Bom
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={!turnComplete}
              className={`glossy w-full py-5 rounded-xl font-bold text-xl transition-opacity ${FOCUS_RING}`}
              style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", opacity: turnComplete ? 1 : 0.4 } as React.CSSProperties}
            >
              Bekreft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
