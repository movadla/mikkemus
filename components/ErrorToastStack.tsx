"use client";

import { dismissToast, useErrorToasts } from "@/lib/errorReporting";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * Bottom-center toast stack for surfacing failed saves/fetches (see lib/errorReporting.ts) —
 * mounted once in app/layout.tsx so every route gets it. Deliberately the opposite corner/edge
 * from ScoliaStatusBadge, which already owns top-right.
 */
export function ErrorToastStack() {
  const toasts = useErrorToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center px-4" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`animate-toast-enter shadow-panel flex items-center pl-3 pr-4 py-2.5 rounded-lg text-left transition-opacity hover:opacity-90 ${FOCUS_RING}`}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderLeft: "3px solid var(--color-red)",
          }}
        >
          <span style={{ color: "var(--color-cream)", fontSize: "0.85rem" }}>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
