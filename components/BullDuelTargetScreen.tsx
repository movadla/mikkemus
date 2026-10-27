"use client";

import { useState } from "react";
import { DEFAULT_BULL_DUEL_TARGET, MAX_BULL_DUEL_TARGET, MIN_BULL_DUEL_TARGET, type BullDuelMode } from "@/lib/bullDuel";
import { Segmented } from "./ui/Segmented";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const MIN_TARGET = MIN_BULL_DUEL_TARGET;
const MAX_TARGET = MAX_BULL_DUEL_TARGET;

/** Second setup step for Bull-duell, after picking who plays: «Først til» a number of points (inner bull = 2, outer bull = 1; it starts at
 *  10 and goes to 99), or «Best av 3 piler»: everyone throws three darts and the most points wins, a tie thrown off between the ones who are
 *  level. The buttons in the game say «Rødt (2)» and «Grønt (1)», so the scoring is not explained here as well. */
export function BullDuelTargetScreen({ onNext, onBack }: { onNext: (target: number, mode: BullDuelMode) => void; onBack: () => void }) {
  const [target, setTarget] = useState(DEFAULT_BULL_DUEL_TARGET);
  const [mode, setMode] = useState<BullDuelMode>("first");

  function change(delta: number) {
    setTarget((t) => Math.min(MAX_TARGET, Math.max(MIN_TARGET, t + delta)));
  }

  const stepper = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label.startsWith("−") ? "Færre" : "Flere"} poeng (${label})`}
      className={`tactile rounded-full text-xl font-semibold ${FOCUS_RING}`}
      style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", opacity: disabled ? 0.4 : 1 }}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-screen-push screen has-sticky-action">
      <div className="screen-inner">
        <ScreenTop title="Bull-duell" onBack={onBack} backLabel="← Tilbake" />

        <div className="mb-6">
          <Segmented
            value={mode}
            onChange={setMode}
            label="Hvordan Bull-duellen vinnes"
            options={[
              { value: "first", label: "Først til" },
              { value: "best3", label: "Best av 3 piler" },
            ]}
          />
        </div>

        {mode === "first" ? (
          <>
            <p className="mb-4 text-center section-label">POENG FOR Å VINNE</p>
            <div className="flex items-center justify-center gap-2 mb-8">
              {stepper("−10", () => change(-10), target <= MIN_TARGET)}
              {stepper("−", () => change(-1), target <= MIN_TARGET)}
              <span className="tabular font-display" style={{ color: "var(--color-cream)", fontSize: "2.5rem", minWidth: "5rem", textAlign: "center" }}>
                {target}
              </span>
              {stepper("+", () => change(1), target >= MAX_TARGET)}
              {stepper("+10", () => change(10), target >= MAX_TARGET)}
            </div>
          </>
        ) : (
          <p className="mb-8 text-center" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Alle kaster tre piler. Flest poeng vinner, og er det likt kaster de som er like tre piler til.
          </p>
        )}

        <StickyAction onClick={() => onNext(target, mode)} ready summary={mode === "first" ? `Først til ${target} poeng` : "Best av 3 piler"}>
          Start Bull-duell
        </StickyAction>
      </div>
    </div>
  );
}
