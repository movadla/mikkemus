"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../icons";
import { FOCUS_RING } from "./focus";

/** A panel that comes up from the bottom over a dimmed screen, for what is done and then closed: editing, choosing, confirming. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Drawn on the body, not inside the screen that asked for it: a screen that slides in has a stacking context of its own, and a sheet inside it
  // ended up under the bar along the bottom (the last button, Slett, was hidden behind it).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button type="button" aria-label="Lukk" onClick={onClose} className="scrim-blur absolute inset-0 w-full h-full" style={{ background: "var(--scrim)" }} />
      <div
        className="sheet-in glass relative w-full max-w-md max-h-[90dvh] overflow-y-auto p-4"
        style={{ borderRadius: "var(--radius-l) var(--radius-l) 0 0", paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className={`tactile flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-s)", background: "var(--color-cell)", color: "var(--color-cream)" }}>
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
