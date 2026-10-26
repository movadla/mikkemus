"use client";

import type { ReactNode } from "react";
import { FOCUS_RING } from "./focus";

/** A choice that can be on or off, among others of its kind: a size, a level, a filter. */
export function Chip({ selected, onClick, children, label, block = false }: { selected: boolean; onClick: () => void; children: ReactNode; label?: string; /** Fill the width of the cell, left-aligned, for a grid of names. */ block?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`tactile px-4 ${block ? "w-full text-left truncate" : ""} ${FOCUS_RING}`}
      style={{
        minHeight: "var(--control)",
        borderRadius: "var(--radius-s)",
        background: selected ? "var(--teal-soft)" : "var(--color-surface)",
        color: selected ? "var(--color-teal)" : "var(--color-cream)",
        border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
        fontWeight: 600,
        fontSize: "var(--text-body)",
      }}
    >
      {children}
    </button>
  );
}
