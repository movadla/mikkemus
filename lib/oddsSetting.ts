"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the odds are shown on this device. On by default: they are for the players as much as for
 * anyone watching. A device can switch them off in Innstillinger, and the screens simply leave the
 * line out; the odds are still worked out and logged either way.
 */
const STORAGE_KEY = "mikke-mus-show-odds";
const listeners = new Set<() => void>();

export function getShowOdds(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setShowOdds(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // The choice just won't outlive this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useShowOdds(): boolean {
  return useSyncExternalStore(subscribe, getShowOdds, () => true);
}
