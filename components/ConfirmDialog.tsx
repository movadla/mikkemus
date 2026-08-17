"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export type ConfirmDialogButton = {
  label: string;
  onClick: () => void;
  background: string;
  /** Defaults to cream — override for a button that needs dark-on-light text (e.g. a teal button). */
  color?: string;
};

/** Shared "dark overlay + centered card + stacked buttons" modal shell — every in-app
 *  confirmation (pause, cancel tournament, triple/double redirect choice) used to copy-paste
 *  this frame per call site; one shared component keeps them all in sync going forward.
 *
 *  By convention (see call sites), buttons[0] is always the safe/cancel action — that's what
 *  gets initial focus and what Escape triggers, so a reflexive dismiss never lands on something
 *  destructive. */
export function ConfirmDialog({
  message,
  messageFontSize = "1.1rem",
  buttons,
}: {
  message: ReactNode;
  messageFontSize?: string;
  buttons: ConfirmDialogButton[];
}) {
  const messageId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    buttonRefs.current[0]?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      buttons[0]?.onClick();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = buttonRefs.current.filter((b): b is HTMLButtonElement => !!b);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-describedby={messageId}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 flex items-center justify-center p-6 z-50"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "var(--color-surface)" }}>
        <p id={messageId} className="text-center mb-6" style={{ color: "var(--color-cream)", fontSize: messageFontSize }}>
          {message}
        </p>
        <div className="space-y-3">
          {buttons.map((b, i) => (
            <button
              key={i}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              type="button"
              onClick={b.onClick}
              className={`glossy w-full py-3 rounded-lg font-medium ${FOCUS_RING}`}
              style={{ "--btn-fill": b.background, color: b.color ?? "var(--color-cream)" } as React.CSSProperties}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
