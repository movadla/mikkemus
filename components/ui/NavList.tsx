"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { nextIndex } from "@/lib/arrowNav";

/**
 * A list the arrow keys move through: Up and Down (and Home and End) put focus on the next row, Enter opens it as it always does.
 * A row says it can be moved to with `data-nav` (every Row that opens does). Nothing changes for touch.
 */
export function NavList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // A text field inside keeps its own arrow keys.
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    const rows = Array.from(box.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? []).filter((r) => r.offsetParent !== null);
    const to = nextIndex(e.key, rows.indexOf(target.closest<HTMLElement>("[data-nav]") as HTMLElement), rows.length);
    if (to === null) return;
    e.preventDefault();
    rows[to]?.focus();
  }
  return (
    <div ref={box} className={className} onKeyDown={onKeyDown} role={label ? "group" : undefined} aria-label={label}>
      {children}
    </div>
  );
}
