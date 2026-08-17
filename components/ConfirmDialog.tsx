"use client";

import type { ReactNode } from "react";

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
 *  this frame per call site; one shared component keeps them all in sync going forward. */
export function ConfirmDialog({
  message,
  messageFontSize = "1.1rem",
  buttons,
}: {
  message: ReactNode;
  messageFontSize?: string;
  buttons: ConfirmDialogButton[];
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "var(--color-surface)" }}>
        <p className="text-center mb-6" style={{ color: "var(--color-cream)", fontSize: messageFontSize }}>
          {message}
        </p>
        <div className="space-y-3">
          {buttons.map((b, i) => (
            <button
              key={i}
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
