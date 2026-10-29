"use client";

import { FOCUS_RING } from "./focus";

/**
 * A small round "i" for a line of explanation that is not needed every time: the button is thumb-sized (the circle is smaller than the area that
 * takes the press), and the words appear under what it belongs to when it is pressed.
 */
export function InfoDot({ label, open, onClick, className = "" }: { label: string; open: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-label={label} aria-expanded={open} onClick={onClick} className={`info-dot tactile ${FOCUS_RING} ${className}`}>
      <span aria-hidden>i</span>
    </button>
  );
}
