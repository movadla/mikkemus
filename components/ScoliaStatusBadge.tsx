"use client";

import type { ScoliaState } from "@/lib/useScolia";

/** Label is deliberately binary (Online only once the board is actually ready to register
 *  throws) — the color dot still carries the finer-grained relay/board state. */
function summarize(state: ScoliaState): { label: string; color: string } {
  const OFFLINE = "Scolia: Offline";
  if (state.relay === "connecting") {
    return { label: OFFLINE, color: "var(--color-muted)" };
  }
  if (state.relay === "stale") {
    return { label: OFFLINE, color: "var(--color-red)" };
  }
  switch (state.boardStatus) {
    case "Ready":
      return { label: "Scolia: Online", color: "var(--color-green)" };
    case "Calibrating":
      return { label: OFFLINE, color: "var(--color-gold)" };
    case "Error":
      return { label: OFFLINE, color: "var(--color-red)" };
    case "Initializing":
    case "Offline":
    default:
      return { label: OFFLINE, color: "var(--color-muted)" };
  }
}

export function ScoliaStatusBadge({ state }: { state: ScoliaState }) {
  const { label, color } = summarize(state);

  return (
    <div
      className="fixed top-2 right-2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-panel"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} aria-hidden />
      <span style={{ color: "var(--color-cream)", fontSize: "0.7rem" }}>{label}</span>
    </div>
  );
}
