"use client";

import { useSyncExternalStore } from "react";

/**
 * The theme of this device. The choice is Auto (follow the phone, the default), Mørk (the one the matches are made for) or Dag, the
 * same palette in daylight. What is drawn is always one of the last two: Auto resolves to whichever the phone is in at the moment,
 * and follows it when it changes. Kept on the device, and put on the page before it is drawn (see THEME_BOOT in the layout) so it
 * never flashes.
 */
export type ThemeChoice = "auto" | "dark" | "light";
export type Theme = "dark" | "light";

const STORAGE_KEY = "mikke-mus-theme";
const listeners = new Set<() => void>();

/** Run in the page head before anything is drawn. Keep the colours in step with THEME_COLOR below. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${STORAGE_KEY}");var l=t==="light"||(t!=="dark"&&window.matchMedia("(prefers-color-scheme: light)").matches);if(l){document.documentElement.dataset.theme="light";var m=document.querySelectorAll("meta[name=theme-color]");for(var i=0;i<m.length;i++)m[i].content="#f3f0e6"}}catch(e){}`;

export function getThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light" ? v : "auto";
  } catch {
    return "auto";
  }
}

function systemPrefersLight(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
}

/** The theme that is drawn: the choice, or the phone's own when the choice is Auto. */
export function resolveTheme(choice: ThemeChoice = getThemeChoice()): Theme {
  if (choice === "auto") return systemPrefersLight() ? "light" : "dark";
  return choice;
}

/** The colour of the browser's own bar (the status bar of the installed app) follows the ground of the theme. */
const THEME_COLOR: Record<Theme, string> = { dark: "#0c110e", light: "#f3f0e6" };

function paint(theme: Theme): void {
  document.querySelectorAll<HTMLMetaElement>("meta[name=\"theme-color\"]").forEach((m) => (m.content = THEME_COLOR[theme]));
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}

/** Puts the theme on the page. With `soft`, the change is a short cross-fade of the whole page instead of a jump, where the browser can. */
export function applyTheme(choice: ThemeChoice = getThemeChoice(), soft = false): void {
  if (typeof document === "undefined") return;
  const next = resolveTheme(choice);
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  if (next === current) {
    paint(next);
    return;
  }
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
  if (soft && !calm && typeof start === "function") start.call(document, () => paint(next));
  else paint(next);
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // The choice just won't outlive this session.
  }
  applyTheme(choice, true);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Auto follows the phone: when it goes to night or day, so does the page.
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
  const onSystem = () => {
    if (getThemeChoice() !== "auto") return;
    applyTheme("auto", true);
    l();
  };
  mq?.addEventListener("change", onSystem);
  return () => {
    listeners.delete(l);
    mq?.removeEventListener("change", onSystem);
  };
}

/** The choice (Auto, Mørk or Dag), for the setting. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getThemeChoice, () => "auto");
}

/** The theme that is drawn, for what needs to know (a preview, a chart's colours). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => resolveTheme(), () => "dark");
}
