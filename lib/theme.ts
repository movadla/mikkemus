"use client";

import { useSyncExternalStore } from "react";

/**
 * The theme of this device: Mørk (the default, and the one the matches are made for) or Dag, the same palette in daylight.
 * Kept on the device, and put on the page before it is drawn (see THEME_BOOT in the layout) so it never flashes.
 */
export type Theme = "dark" | "light";

const STORAGE_KEY = "mikke-mus-theme";
const listeners = new Set<() => void>();

/** Run in the page head before anything is drawn. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice just won't outlive this session.
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "dark");
}
