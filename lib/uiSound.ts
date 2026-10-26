"use client";

import { useSyncExternalStore } from "react";
import { playDrawTick, playUiSound } from "./fanfare";
import { getFxLevel } from "./fxLevel";

/**
 * Whether the interface itself makes sounds on this device (a click on a button, a pair of notes on a confirmed turn, a thud on
 * undo). On by default, but only ever heard in Party and Full party: Vanlig and Enkel are quiet however it is set.
 */
const STORAGE_KEY = "mikke-mus-ui-sound";
const listeners = new Set<() => void>();

export function getUiSound(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setUiSound(on: boolean): void {
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

export function useUiSound(): boolean {
  return useSyncExternalStore(subscribe, getUiSound, () => true);
}

/** Plays the sound if the device wants it and the level allows it. */
export function uiSound(kind: "click" | "confirm" | "undo"): void {
  const level = getFxLevel();
  if (level !== "party" && level !== "full") return;
  if (!getUiSound()) return;
  playUiSound(kind);
}

/** The draw's sounds: a note for each pair and a chord at the end, on the same terms as the rest (Party and up, and the setting). */
export function drawSound(progress: number, last = false): void {
  const level = getFxLevel();
  if (level !== "party" && level !== "full") return;
  if (!getUiSound()) return;
  playDrawTick(progress, last);
}
