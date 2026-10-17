"use client";

import { useState } from "react";
import type { BullDuelState } from "@/lib/bullDuel";
import { activePlayerFor } from "@/lib/bullDuel";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScreenTop } from "./ScreenTop";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The turn's darts so far — 3 boxes, filled in as they land. Simpler than the
 *  main game's ShotIndicator (only 3 possible outcomes here: red/green/miss). */
function ShotIndicator({ shots }: { shots: BullDuelState["turnShots"] }) {
  const boxes = [shots[0] ?? null, shots[1] ?? null, shots[2] ?? null];
  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      {boxes.map((shot, i) => (
        <div
          key={i}
          className={shot ? "animate-shot-pop" : undefined}
          style={{
            width: "2.4rem",
            height: "2.4rem",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.85rem",
            fontWeight: 700,
            background: shot ? (shot.points > 0 ? "var(--color-green)" : "var(--color-red)") : "transparent",
            border: shot ? "none" : "1px dashed var(--color-border)",
            color: "var(--color-cream)",
          }}
        >
          {shot ? shot.points : ""}
        </div>
      ))}
    </div>
  );
}

/**
 * Bull-duell's board. Same screen top as everywhere else; the players' scores in a panel that is
 * as tall as its content, and the three throw buttons right under it rather than at the bottom
 * of a mostly empty screen.
 */
export function BullDuelGameScreen({
  duel,
  scolia,
  isActiveBot,
  onManualHit,
  onBust,
  onConfirm,
  onAbort,
}: {
  duel: BullDuelState;
  scolia: { label: string; color: string } | null;
  isActiveBot: boolean;
  /** Manual reserve (no Scolia): the tapped outcome's Scolia-style sector string. */
  onManualHit: (sector: "Bull" | "25" | "None") => void;
  /** Bust: every dart left in the turn missed. */
  onBust: () => void;
  onConfirm: () => void;
  onAbort: () => void;
}) {
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const activePlayer = activePlayerFor(duel);
  const turnComplete = duel.dartsThisTurn >= 3;

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Bull-duell" onBack={() => setShowHomeConfirm(true)} scolia={scolia} />

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

        {/* Active player — deliberately the biggest, boldest element on screen: manual
            registration is easy to mis-attribute to the wrong player otherwise. */}
        <div className="text-center py-4">
          <p className="section-label">NÅ KASTER</p>
          <h2 className="font-display" style={{ color: "var(--color-cream)", fontSize: "2.4rem", lineHeight: 1.1 }}>
            {activePlayer}
          </h2>
          <ShotIndicator shots={duel.turnShots} />
        </div>

        <div className="rounded-xl shadow-panel p-4 space-y-2 mb-4" style={{ background: "var(--color-panel)" }}>
          {duel.players.map((p) => {
            const isActive = p === activePlayer;
            const points = duel.points[p];
            const pct = Math.min(100, Math.round((points / duel.target) * 100));
            return (
              <div
                key={p}
                className="flex items-center justify-between gap-4 rounded-lg px-4 transition-colors duration-300"
                style={{
                  minHeight: "2.75rem",
                  background: isActive ? "var(--color-surface)" : "transparent",
                  border: isActive ? "2px solid var(--color-teal)" : "2px solid transparent",
                }}
              >
                <span className="truncate" style={{ color: "var(--color-cream)", fontWeight: isActive ? 700 : 400 }}>
                  {p}
                </span>
                <div className="flex items-center gap-4 shrink-0">
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
          <>
            {!turnComplete && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => onManualHit("Bull")}
                  className={`glossy rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-red)", color: "var(--color-cream)", minHeight: "3.5rem" } as React.CSSProperties}
                >
                  Rødt (2)
                </button>
                <button
                  type="button"
                  onClick={() => onManualHit("25")}
                  className={`glossy rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-green)", color: "var(--color-cream)", minHeight: "3.5rem" } as React.CSSProperties}
                >
                  Grønt (1)
                </button>
                <button
                  type="button"
                  onClick={() => onManualHit("None")}
                  className={`glossy rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", minHeight: "3.5rem" } as React.CSSProperties}
                >
                  Bom
                </button>
                <button
                  type="button"
                  onClick={onBust}
                  aria-label="Bust: bom på alle pilene som er igjen i runden"
                  className={`glossy rounded-xl font-semibold ${FOCUS_RING}`}
                  style={{ "--btn-fill": "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-red)", minHeight: "3.5rem" } as React.CSSProperties}
                >
                  Bust
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={!turnComplete}
              className={`glossy w-full rounded-xl font-bold text-xl transition-opacity ${FOCUS_RING}`}
              style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", opacity: turnComplete ? 1 : 0.4, minHeight: "3.5rem" } as React.CSSProperties}
            >
              Bekreft
            </button>
          </>
        )}
      </div>
    </div>
  );
}
