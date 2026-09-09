"use client";

import type { ScoliaState } from "@/lib/useScolia";

/** Label is deliberately binary (Online only once the board is actually ready to register
 *  throws) — the color dot still carries the finer-grained relay/board state. */
export function summarizeScolia(state: ScoliaState): { label: string; color: string } {
  const OFFLINE = "Scolia: Offline";
  if (state.relay === "connecting") {
    return { label: "Scolia: Kobler til …", color: "var(--color-muted)" };
  }
  if (state.relay === "stale") {
    return { label: "Scolia: Mistet kontakt", color: "var(--color-red)" };
  }
  switch (state.boardStatus) {
    case "Ready":
      // Which transport is carrying the darts. Push lands one in ~100ms, polling in up to a
      // quarter second — and on a laggy night this is the line that says which one you are on.
      return { label: `Scolia: Online · ${state.transport === "realtime" ? "push" : "polling"}`, color: "var(--color-green)" };
    case "Calibrating":
      return { label: "Scolia: Kalibrerer …", color: "var(--color-gold)" };
    case "Error":
      return { label: "Scolia: Feil på brettet", color: "var(--color-red)" };
    case "Initializing":
    case "Offline":
    default:
      return { label: OFFLINE, color: "var(--color-muted)" };
  }
}

export function ScoliaStatusBadge({ state }: { state: ScoliaState }) {
  const { label, color } = summarizeScolia(state);

  return (
    <div
      className="scolia-badge fixed top-2 right-2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-panel"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          background: color,
          boxShadow: `0 0 6px 1px ${color}`,
          transition: "background-color var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard)",
        }}
        aria-hidden
      />
      <span style={{ color: "var(--color-cream)", fontSize: "0.7rem" }}>{label}</span>
    </div>
  );
}
