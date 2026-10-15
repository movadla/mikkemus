"use client";

import { useEffect } from "react";
import { registerToastSlot, useErrorToasts, useHasToastSlot } from "@/lib/errorReporting";

/** The newest message, as one slim line. Shared by the two places it can appear. */
function ToastLine({ message, id }: { message: string; id: number }) {
  return (
    <p
      key={id}
      className="animate-toast-enter shadow-panel rounded-full px-4 py-2 text-center mx-auto"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: "3px solid var(--color-red)",
        color: "var(--color-cream)",
        fontSize: "0.8rem",
        maxWidth: "26rem",
      }}
    >
      {message}
    </p>
  );
}

/**
 * Feedback for a failed save or fetch (see lib/errorReporting.ts), mounted once in
 * app/layout.tsx so every route has it. It floats only on screens without a ToastSlot — the
 * board — where it sits under the top row of buttons. Everywhere else the slot shows it in the
 * flow, where it covers nothing. Only the newest message is shown: an outage reads as one steady
 * line, and it goes by itself.
 */
export function ErrorToastStack() {
  const toasts = useErrorToasts();
  const hasSlot = useHasToastSlot();
  const latest = toasts[toasts.length - 1];
  if (!latest || hasSlot) return null;

  return (
    <div className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none" style={{ top: "4.25rem" }} role="status" aria-live="polite">
      <ToastLine message={latest.message} id={latest.id} />
    </div>
  );
}

/** The in-flow version, rendered under the screen top. Takes no height while there is nothing to say. */
export function ToastSlot() {
  const toasts = useErrorToasts();
  useEffect(() => registerToastSlot(), []);
  const latest = toasts[toasts.length - 1];
  if (!latest) return null;
  return (
    <div className="mb-4" role="status" aria-live="polite">
      <ToastLine message={latest.message} id={latest.id} />
    </div>
  );
}
