"use client";

import type { ReactNode } from "react";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The one big teal button of a setup screen, fixed to the bottom so it is on screen however long
 * the setup gets — a team setup with four people was 1 221 px tall, and Start sat a screen and a
 * half down. One line above it says what is about to start; when the setup is not ready the
 * button is dimmed and the line says the one thing that is missing.
 *
 * Screens that use it leave room at the bottom (see `.has-sticky-action` in globals.css) so the
 * last box can be scrolled clear of the bar.
 */
export function StickyAction({
  onClick,
  ready,
  summary,
  reason,
  below,
  children,
}: {
  onClick: () => void;
  ready: boolean;
  /** What will start: "3 spillere · 3 kryss". */
  summary?: ReactNode;
  /** The one thing that stops it, shown instead of the summary when not ready. */
  reason?: ReactNode;
  /** Something small under the button, such as a tick box about how the match is played. */
  below?: ReactNode;
  children: ReactNode;
}) {
  const line = ready ? summary : reason ?? summary;
  return (
    <div
      className="sticky-action fixed left-0 right-0 bottom-0 z-30 px-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))", paddingTop: "2rem", background: "linear-gradient(to bottom, transparent, var(--color-bg) 45%)", pointerEvents: "none" }}
    >
      <div className="max-w-md mx-auto" style={{ pointerEvents: "auto" }}>
        {line && (
          <p className="text-center mb-2 tabular" style={{ color: ready ? "var(--color-muted)" : "var(--color-red)", fontSize: "var(--text-micro)" }}>
            {line}
          </p>
        )}
        <button
          type="button"
          disabled={!ready}
          onClick={onClick}
          className={`glossy w-full rounded-xl font-semibold text-lg transition-opacity ${FOCUS_RING}`}
          style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", opacity: ready ? 1 : 0.4, minHeight: "var(--control-lg)" } as React.CSSProperties}
        >
          {children}
        </button>
        {below && <div className="mt-1 flex justify-center">{below}</div>}
      </div>
    </div>
  );
}
