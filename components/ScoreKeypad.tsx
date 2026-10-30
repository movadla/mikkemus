"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  onTyped,
  fill = false,
  tone,
  finishLabel,
  manual = false,
  invalid,
}: {
  onSubmit: (score: number) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** The line above the number: who is up, and what the round has to be. Told what is written so far. */
  line: (typed: string) => ReactNode;
  /** Told what is written as it changes, for a screen that shows it somewhere else too (the tower in Highstriker). */
  onTyped?: (typed: string) => void;
  /** Takes all the height it is given: the number written large and the keys tall, to share the screen with the score. */
  fill?: boolean;
  /** Colours the number written: red when it is over the line, green when it takes the player out. */
  tone?: (typed: string) => "bust" | "finish" | undefined;
  /** What Bekreft says while the number written is a finish (Ut!); without it, it always says Bekreft. */
  finishLabel?: string;
  /** Nothing goes in by itself: what is written waits for Bekreft, whatever it is (Halv It, where 50 can be a sum as well as a start). */
  manual?: boolean;
  /** A sum that cannot be right: it is shown as over the line, and Bekreft is off. */
  invalid?: (typed: string) => boolean;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    onTyped?.(typed);
  }, [typed, onTyped]);

  function press(digit: number) {
    uiFeedback("pick");
    const next = pressDigit(typed, digit);
    if (next === typed) return;
    if (manual || canGrow(next)) {
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
  const keyStyle = { minHeight: fill ? "3.2rem" : "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: fill ? "clamp(1.9rem, 9vw, 2.6rem)" : "var(--text-num)", boxShadow: "var(--elevation-1)" } as const;
  const writtenColour = tone?.(typed) === "bust" ? "var(--color-red)" : tone?.(typed) === "finish" ? "var(--color-green)" : typed === "" ? "var(--color-muted)" : "var(--color-cream)";
  const nothingToTakeBack = !canUndo && typed === "";

  return (
    <div className={fill ? "flex flex-col h-full min-h-0" : undefined}>
      <div role="status" aria-live="polite" className="text-center" style={{ minHeight: fill ? 0 : "1.5rem", marginBottom: fill ? 0 : "0.5rem", fontSize: "var(--text-small)" }}>
        {line(typed)}
      </div>
      <div
        className="flex items-center justify-center mb-2"
        style={{ minHeight: fill ? "clamp(4.2rem, 11dvh, 6rem)" : "4.5rem", flex: fill ? "0 0 auto" : undefined, borderRadius: "var(--radius-m)", background: "var(--color-panel)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-0)" }}
        aria-label={typed === "" ? "Ingen tall skrevet" : `Skrevet: ${typed}`}
      >
        <span className="num" style={{ fontSize: fill ? "clamp(3.2rem, 9dvh, 4.6rem)" : "3rem", color: writtenColour }}>
          {typed === "" ? "–" : typed}
        </span>
      </div>
      <div className={`grid grid-cols-3 gap-2 ${fill ? "flex-1 min-h-0" : "mb-2"}`} style={fill ? { gridTemplateRows: "repeat(4, minmax(0, 1fr))" } : undefined} role="group" aria-label="Tastatur">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key} style={keyStyle}>
            {d}
          </button>
        ))}
        {fill ? (
          // Only ever takes the last digit back: taking a round back is a button of its own at the top of the screen.
          <button type="button" aria-label="Slett" onClick={() => { uiFeedback("pick"); setTyped(typed.slice(0, -1)); }} disabled={typed === ""} className={key} style={{ ...keyStyle, opacity: typed === "" ? 0.4 : 1 }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
              <path d="m13 9 5 5m0-5-5 5" />
            </svg>
          </button>
        ) : (
          <button type="button" onClick={back} disabled={nothingToTakeBack} className={key} style={{ ...keyStyle, fontSize: "var(--text-body)", fontFamily: "var(--font-sans)", fontWeight: 600, opacity: nothingToTakeBack ? 0.4 : 1 }}>
            {typed !== "" ? "Slett" : "Angre"}
          </button>
        )}
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
          disabled={typed === "" || !!invalid?.(typed)}
          className={`glossy font-semibold ${FOCUS_RING}`}
          style={{ "--btn-fill": tone?.(typed) === "finish" ? "var(--color-green)" : "var(--color-teal)", color: "var(--color-bg)", minHeight: fill ? "3.2rem" : "var(--control-lg)", borderRadius: fill ? "var(--radius-m)" : "var(--radius-pill)", opacity: typed === "" || invalid?.(typed) ? 0.4 : 1, fontSize: fill ? "clamp(1.2rem, 4.5vw, 1.9rem)" : "var(--text-title)" } as React.CSSProperties}
        >
          {fill && finishLabel && tone?.(typed) === "finish" ? finishLabel : "Bekreft"}
        </button>
      </div>
    </div>
  );
}
