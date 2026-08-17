"use client";

const STORAGE_KEY = "mikke-mus-announcer-enabled";

/** Defaults to on — most nights want the commentary; the mute toggle in GameScreen
 *  is for the rare night it gets old. */
export function isAnnouncerEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "0";
}

export function setAnnouncerEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

/**
 * Speaks a short phrase via the browser's built-in speech synthesis (Web Speech API) —
 * no external service, no API key, works offline. This game doesn't keep a running
 * point total like 501 does (see lib/game.ts), so there's no literal "180" or
 * "checkout" to call out — the callers instead announce what's actually dramatic in
 * this ruleset: a physical triple/bullseye landing, and the match winner.
 */
export function announce(text: string) {
  if (typeof window === "undefined") return;
  if (!isAnnouncerEnabled()) return;
  if (!("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nb-NO";
    utterance.pitch = 1.15;
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis can fail for all sorts of platform reasons — never let it break a turn.
  }
}
