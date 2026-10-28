"use client";

import { FOCUS_RING } from "./ui/focus";

/**
 * The one big button of a screen: a single word in large capitals, and under it a small line for where it leads. It is the biggest and the
 * brightest thing on the screen, full width and at the bottom, and every main action of the career is made with it, so it is the same
 * everywhere. Teal is for going on; gold is for collecting.
 */
export function PlayButton({ label, sub, onClick, tone = "teal", disabled = false }: { label: string; sub?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; tone?: "teal" | "gold"; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`play-btn tactile ${tone === "gold" ? "play-btn-gold" : ""} ${FOCUS_RING}`}>
      <strong>{label}</strong>
      {sub && <small>{sub}</small>}
    </button>
  );
}
