"use client";

import { useSyncExternalStore } from "react";

/**
 * The whole guide to the career: a small bubble with an arrow that points at the one thing to press, the first time, and is gone as soon as it is
 * pressed. Which ones have been seen is kept on the device. Nothing is read and nothing is closed.
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

/** The pointer for this id has been dealt with: it does not come back. */
export function markTipSeen(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), id])]));
  } catch {
    // The pointer then comes back next time, which is harmless.
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

/** Whether the pointer for this id has been seen. Server side it counts as seen, so nothing flashes in. */
export function useTipSeen(id: string): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => id).split("|").includes(id);
}

/** The bubble and arrow, placed above the (relatively placed) thing it points at. */
export function TipPointer({ id, label }: { id: string; label: string }) {
  if (useTipSeen(id)) return null;
  return (
    <div className="tip-pointer" role="note">
      <span>{label}</span>
      <i aria-hidden />
    </div>
  );
}
