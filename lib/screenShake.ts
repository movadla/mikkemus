"use client";

const STORAGE_KEY = "mikke-mus-shake-enabled";

/**
 * Whether the board shakes when darts land. Defaults to on — the escalating jolt across an
 * unbroken turn is half of what makes a streak feel like one. Off is for the nights it grates,
 * or for anyone the motion bothers; the sound, the heat and the marks all still play.
 *
 * Same shape as the announcer preference next door, deliberately: two settings that behave
 * identically should read identically.
 */
export function isShakeEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setShakeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode / quota — the toggle just won't persist past this session.
  }
}
