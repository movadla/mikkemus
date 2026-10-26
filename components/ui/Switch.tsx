"use client";

import type { ReactNode } from "react";
import { FOCUS_RING } from "./focus";

/** A setting that is on or off: its name on the left, the switch on the right, the whole row one tap target. */
export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: ReactNode; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`tactile w-full flex items-center justify-between gap-4 px-4 text-left ${FOCUS_RING}`}
      style={{ minHeight: "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="flex flex-col min-w-0">
        <span style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{hint}</span>}
      </span>
      <span aria-hidden className="shrink-0 rounded-full relative" style={{ width: "2.75rem", height: "1.625rem", background: checked ? "var(--color-teal)" : "var(--color-cell)", transition: "background var(--duration-fast) var(--ease-standard)" }}>
        <span
          className="absolute rounded-full"
          style={{ top: "0.1875rem", left: checked ? "1.3125rem" : "0.1875rem", width: "1.25rem", height: "1.25rem", background: "var(--color-cream)", transition: "left var(--duration-fast) var(--ease-standard)" }}
        />
      </span>
    </button>
  );
}
