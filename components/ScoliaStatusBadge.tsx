"use client";

import { useEffect, useState } from "react";
import type { ScoliaState } from "@/lib/useScolia";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

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

/** The badge the board screen keeps: fixed in the corner, dot and text. */
export function ScoliaStatusBadge({ state }: { state: ScoliaState }) {
  const { label, color } = summarizeScolia(state);

  return (
    <div
      className="scolia-badge fixed top-2 right-2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-panel"
      title={label}
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
      <span className="scolia-badge-label" style={{ color: "var(--color-cream)", fontSize: "var(--text-micro)" }}>{label}</span>
    </div>
  );
}

const LABEL_MS = 2500;

/**
 * The same status as a dot in the screen top (see ScreenTop), for every screen that is not the
 * board. The text used to sit over the top-right corner of every screen, where it covered titles
 * and buttons and said the same thing all evening; the colour is what people glance at. A tap
 * shows the words for a moment.
 */
export function ScoliaDot({ summary }: { summary: { label: string; color: string } }) {
  const [showLabel, setShowLabel] = useState(false);
  useEffect(() => {
    if (!showLabel) return;
    const timer = setTimeout(() => setShowLabel(false), LABEL_MS);
    return () => clearTimeout(timer);
  }, [showLabel]);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShowLabel((v) => !v)}
        aria-label={summary.label}
        className={`inline-flex items-center justify-center rounded-full ${FOCUS_RING}`}
        style={{ width: "2.75rem", height: "2.75rem" }}
      >
        <span
          className="rounded-full"
          style={{ width: "0.75rem", height: "0.75rem", background: summary.color, boxShadow: `0 0 6px 1px ${summary.color}` }}
          aria-hidden
        />
      </button>
      {showLabel && (
        <span
          role="status"
          className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-full px-3 py-1.5 shadow-panel"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-micro)", zIndex: 30 }}
        >
          {summary.label}
        </span>
      )}
    </span>
  );
}
