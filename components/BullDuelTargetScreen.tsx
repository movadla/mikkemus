"use client";

import { useState } from "react";
import { DEFAULT_BULL_DUEL_TARGET } from "@/lib/bullDuel";
import { PrimaryActionButton } from "./PrimaryActionButton";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const MIN_TARGET = 5;
const MAX_TARGET = 101;
const STEP = 1;

/** Second setup step for Bull-duell, after picking who plays — how many
 *  points (inner bull=2, outer bull=1) are needed to win. Same −/+ stepper
 *  pattern as TournamentGroupSetupScreen's group-count picker. */
export function BullDuelTargetScreen({ onNext, onBack }: { onNext: (target: number) => void; onBack: () => void }) {
  const [target, setTarget] = useState(DEFAULT_BULL_DUEL_TARGET);

  function change(delta: number) {
    setTarget((t) => Math.min(MAX_TARGET, Math.max(MIN_TARGET, t + delta)));
  }

  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={onBack}
            className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
          >
            ← Tilbake
          </button>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.3rem" }}>
            Bull-duell
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        <p className="mb-3 text-center section-label">
          HVOR MANGE POENG FOR Å VINNE?
        </p>
        <p className="mb-8 text-center" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
          Rødt (indre bull) = 2 poeng, grønt (ytre bull/25) = 1 poeng. Første som når eller passerer målet vinner.
        </p>

        <div className="flex items-center justify-center gap-4 mb-10">
          <button
            type="button"
            onClick={() => change(-STEP)}
            disabled={target <= MIN_TARGET}
            className={`tactile w-12 h-12 rounded-full text-xl font-semibold ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)", opacity: target <= MIN_TARGET ? 0.4 : 1 }}
          >
            −
          </button>
          <span className="tabular font-display" style={{ color: "var(--color-cream)", fontSize: "2.5rem", minWidth: "6rem", textAlign: "center" }}>
            {target}
          </span>
          <button
            type="button"
            onClick={() => change(STEP)}
            disabled={target >= MAX_TARGET}
            className={`tactile w-12 h-12 rounded-full text-xl font-semibold ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)", opacity: target >= MAX_TARGET ? 0.4 : 1 }}
          >
            +
          </button>
        </div>

        <PrimaryActionButton onClick={() => onNext(target)} ready>
          Start Bull-duell
        </PrimaryActionButton>
      </div>
    </div>
  );
}
