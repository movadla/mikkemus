"use client";

import type { ScoliaState } from "@/lib/useScolia";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function summarize(state: ScoliaState): { label: string; color: string; showReconnect: boolean } {
  if (state.connection.kind === "connecting") {
    return { label: "Scolia: kobler til…", color: "var(--color-muted)", showReconnect: false };
  }
  if (state.connection.kind === "closed") {
    const label =
      state.connection.code === 4101
        ? "Scolia: allerede tilkoblet et annet sted"
        : `Scolia: frakoblet (${state.connection.code})`;
    return { label, color: "var(--color-red)", showReconnect: !state.connection.terminal };
  }
  switch (state.boardStatus) {
    case "Ready":
      return { label: "Scolia: klar", color: "var(--color-green)", showReconnect: false };
    case "Calibrating":
      return { label: "Scolia: kalibrerer…", color: "var(--color-gold)", showReconnect: false };
    case "Error":
      return { label: `Scolia: feil${state.errorType ? ` (${state.errorType})` : ""}`, color: "var(--color-red)", showReconnect: false };
    case "Initializing":
      return { label: "Scolia: starter…", color: "var(--color-muted)", showReconnect: false };
    case "Offline":
      return { label: "Scolia: offline", color: "var(--color-muted)", showReconnect: false };
    default:
      return { label: "Scolia: tilkoblet", color: "var(--color-muted)", showReconnect: false };
  }
}

export function ScoliaStatusBadge({
  state,
  onReconnect,
}: {
  state: ScoliaState;
  onReconnect: () => void;
}) {
  const { label, color, showReconnect } = summarize(state);

  return (
    <div
      className="fixed top-2 right-2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-panel"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} aria-hidden />
      <span style={{ color: "var(--color-cream)", fontSize: "0.7rem" }}>{label}</span>
      {showReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className={`tactile px-2 py-0.5 rounded-md text-xs ${FOCUS_RING}`}
          style={{ background: "var(--color-cell)", color: "var(--color-teal)" }}
        >
          Koble til
        </button>
      )}
    </div>
  );
}
