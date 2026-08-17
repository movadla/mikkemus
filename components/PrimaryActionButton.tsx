"use client";

import type { ReactNode } from "react";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The "big teal call-to-action that dims and explains why when not ready yet" pattern
 *  repeated across every setup screen (Start spill, Neste: juster grupper, Generer
 *  turnering) — one shared component instead of copy-pasting the button + hint pair. */
export function PrimaryActionButton({
  onClick,
  ready,
  hint,
  children,
}: {
  onClick: () => void;
  ready: boolean;
  /** Shown centered below the button whenever `ready` is false. Omit if there's nothing to explain. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        disabled={!ready}
        onClick={onClick}
        className={`glossy w-full py-4 rounded-lg font-semibold text-lg transition-opacity ${FOCUS_RING}`}
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", opacity: ready ? 1 : 0.4 } as React.CSSProperties}
      >
        {children}
      </button>
      {!ready && hint && (
        <p className="text-center mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
          {hint}
        </p>
      )}
    </>
  );
}
