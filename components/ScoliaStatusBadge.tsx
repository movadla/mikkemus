"use client";

import type { ScoliaState } from "@/lib/useScolia";

function summarize(state: ScoliaState): { label: string; color: string } {
  if (state.relay === "connecting") {
    return { label: "Scolia: kobler til…", color: "var(--color-muted)" };
  }
  if (state.relay === "stale") {
    return { label: "Scolia: relay ikke tilgjengelig", color: "var(--color-red)" };
  }
  switch (state.boardStatus) {
    case "Ready":
      return { label: "Scolia: klar", color: "var(--color-green)" };
    case "Calibrating":
      return { label: "Scolia: kalibrerer…", color: "var(--color-gold)" };
    case "Error":
      return { label: `Scolia: feil${state.errorType ? ` (${state.errorType})` : ""}`, color: "var(--color-red)" };
    case "Initializing":
      return { label: "Scolia: starter…", color: "var(--color-muted)" };
    case "Offline":
      return { label: "Scolia: brett offline", color: "var(--color-muted)" };
    default:
      return { label: "Scolia: venter på status…", color: "var(--color-muted)" };
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
