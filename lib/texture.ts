"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the film grain is drawn behind the screens on this device. On by default; it can be switched off in Innstillinger
 * for an older phone or a plainer look. The page reads it from `html[data-texture]` (see TextureSetting).
 */
const STORAGE_KEY = "mikke-mus-texture";
const listeners = new Set<() => void>();

export function getTexture(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function applyTexture(on: boolean): void {
  if (typeof document !== "undefined") document.documentElement.dataset.texture = on ? "on" : "off";
}

export function setTexture(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // The choice just won't outlive this session.
  }
  applyTexture(on);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useTexture(): boolean {
  return useSyncExternalStore(subscribe, getTexture, () => true);
}
