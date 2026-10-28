"use client";

import { useSyncExternalStore } from "react";
import { FOCUS_RING } from "./ui/focus";

/**
 * A short hint the first time something is met in the career, said once and then gone: what it is, in a sentence, and one button to get rid of
 * it. Which hints have been seen is kept on the device. This is the whole guide for a new player; it never blocks anything.
 */
const KEY = "mikke-mus-career-tips";
const listeners = new Set<() => void>();

function seen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), id])]));
  } catch {
    // The hint then comes back next time, which is harmless.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// A string snapshot, so React sees the same value until something changes.
const snapshot = () => seen().join("|");

export function CareerTip({ id, children }: { id: string; children: React.ReactNode }) {
  const done = useSyncExternalStore(subscribe, snapshot, () => id).split("|").includes(id);
  if (done) return null;
  return (
    <div role="note" className="career-tip flex items-start gap-3" style={{ padding: "0.7rem 0.85rem", borderRadius: "var(--radius-m)", background: "var(--teal-soft)", border: "1px solid var(--color-teal)", color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
      <span className="flex-1">{children}</span>
      <button type="button" onClick={() => markSeen(id)} className={`tactile shrink-0 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", padding: "0 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", color: "var(--color-teal)", border: "1px solid var(--color-teal)", fontWeight: 700 }}>
        Skjønner
      </button>
    </div>
  );
}
