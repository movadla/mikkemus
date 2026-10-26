"use client";

import { useState } from "react";
import { DEFAULT_BULL_DUEL_TARGET } from "@/lib/bullDuel";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const MIN_TARGET = 5;
const MAX_TARGET = 101;
const STEP = 1;

/** Second setup step for Bull-duell, after picking who plays — how many points (inner bull = 2,
 *  outer bull = 1) are needed to win. Same −/+ stepper as the group-count picker. The buttons in
 *  the game say «Rødt (2)» and «Grønt (1)», so the scoring is not explained here as well. */
export function BullDuelTargetScreen({ onNext, onBack }: { onNext: (target: number) => void; onBack: () => void }) {
  const [target, setTarget] = useState(DEFAULT_BULL_DUEL_TARGET);

  function change(delta: number) {
    setTarget((t) => Math.min(MAX_TARGET, Math.max(MIN_TARGET, t + delta)));
  }

  const stepper = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label === "−" ? "Færre poeng" : "Flere poeng"}
      className={`tactile rounded-full text-xl font-semibold ${FOCUS_RING}`}
      style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", opacity: disabled ? 0.4 : 1 }}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-screen-push screen has-sticky-action" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Bull-duell" onBack={onBack} backLabel="← Tilbake" />

        <p className="mb-4 text-center section-label">POENG FOR Å VINNE</p>

        <div className="flex items-center justify-center gap-4 mb-8">
          {stepper("−", () => change(-STEP), target <= MIN_TARGET)}
          <span className="tabular font-display" style={{ color: "var(--color-cream)", fontSize: "2.5rem", minWidth: "6rem", textAlign: "center" }}>
            {target}
          </span>
          {stepper("+", () => change(STEP), target >= MAX_TARGET)}
        </div>

        <StickyAction onClick={() => onNext(target)} ready summary={`Første til ${target} poeng`}>
          Start Bull-duell
        </StickyAction>
      </div>
    </div>
  );
}
