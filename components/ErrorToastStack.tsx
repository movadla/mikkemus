"use client";

import { useErrorToasts } from "@/lib/errorReporting";

/**
 * One slim line of feedback for a failed save or fetch (see lib/errorReporting.ts) — mounted once
 * in app/layout.tsx so every route gets it.
 *
 * It sits at the top, under the row of buttons, and takes no taps. It used to be a stack of
 * tappable boxes at the bottom of the screen, which is exactly where Angre and Bekreft are: a
 * message about a save that failed ended up covering the buttons for the next five seconds. Only
 * the newest message is shown — an outage reads as one steady line, and it goes by itself.
 */
export function ErrorToastStack() {
  const toasts = useErrorToasts();
  const latest = toasts[toasts.length - 1];
  if (!latest) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ top: "3.4rem" }}
      role="status"
      aria-live="polite"
    >
      <p
        key={latest.id}
        className="animate-toast-enter shadow-panel rounded-full px-3.5 py-1.5 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderLeft: "3px solid var(--color-red)",
          color: "var(--color-cream)",
          fontSize: "0.8rem",
          maxWidth: "26rem",
        }}
      >
        {latest.message}
      </p>
    </div>
  );
}
