"use client";

import { useState, type ReactNode } from "react";
import { canGrow, pressDigit } from "@/lib/countdown";
import { haptics } from "@/lib/haptics";
import { uiFeedback } from "@/lib/uiSound";
import { FOCUS_RING } from "./ui/focus";

/**
 * Where the round is written in, for the games that count what three darts made (301, 501, Highstriker): what is written, a keypad, and
 * nothing to confirm when the number can only be what it says (19 and up, and 0). One that could still grow (1 can be 10 to 18 or 100
 * to 180) is confirmed with Bekreft. The key at the bottom left takes the last digit back, and with nothing written it takes the last
 * round back.
 */
export function ScoreKeypad({
  onSubmit,
  onUndo,
  canUndo,
  line,
}: {
  onSubmit: (score: number) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** The line above the number: who is up, and what the round has to be. Told what is written so far. */
  line: (typed: string) => ReactNode;
}) {
  const [typed, setTyped] = useState("");

  function press(digit: number) {
    uiFeedback("pick");
    const next = pressDigit(typed, digit);
    if (next === typed) return;
    if (canGrow(next)) {
      setTyped(next);
      return;
    }
    setTyped("");
    onSubmit(Number(next));
  }

  function back() {
    uiFeedback("pick");
    if (typed !== "") {
      setTyped(typed.slice(0, -1));
      return;
    }
    haptics.undo();
    onUndo();
  }

  const key = `tactile flex items-center justify-center font-display ${FOCUS_RING}`;
  const keyStyle = { minHeight: "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-num)", boxShadow: "var(--elevation-1)" } as const;
  const nothingToTakeBack = !canUndo && typed === "";

  return (
    <div>
      <div role="status" aria-live="polite" className="text-center mb-2" style={{ minHeight: "1.5rem", fontSize: "var(--text-small)" }}>
        {line(typed)}
      </div>
      <div
        className="flex items-center justify-center mb-3"
        style={{ minHeight: "4.5rem", borderRadius: "var(--radius-m)", background: "var(--color-panel)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-0)" }}
        aria-label={typed === "" ? "Ingen tall skrevet" : `Skrevet: ${typed}`}
      >
        <span className="num" style={{ fontSize: "3rem", color: typed === "" ? "var(--color-muted)" : "var(--color-cream)" }}>
          {typed === "" ? "–" : typed}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2" role="group" aria-label="Tastatur">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key} style={keyStyle}>
            {d}
          </button>
        ))}
        <button type="button" onClick={back} disabled={nothingToTakeBack} className={key} style={{ ...keyStyle, fontSize: "var(--text-body)", fontFamily: "var(--font-sans)", fontWeight: 600, opacity: nothingToTakeBack ? 0.4 : 1 }}>
          {typed !== "" ? "Slett" : "Angre"}
        </button>
        <button type="button" onClick={() => press(0)} className={key} style={keyStyle}>
          0
        </button>
        <button
          type="button"
          onClick={() => {
            const n = Number(typed);
            setTyped("");
            onSubmit(n);
          }}
          disabled={typed === ""}
          className={`glossy font-semibold ${FOCUS_RING}`}
          style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)", borderRadius: "var(--radius-pill)", opacity: typed === "" ? 0.4 : 1, fontSize: "var(--text-title)" } as React.CSSProperties}
        >
          Bekreft
        </button>
      </div>
      <p className="text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
        Fra 19 og opp går runden inn av seg selv.
      </p>
    </div>
  );
}
