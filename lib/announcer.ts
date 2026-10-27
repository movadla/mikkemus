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

const CALLER_KEY = "mikke-mus-caller-enabled";

/** The caller (the number said out loud after a round in 301 / 501) is on by default, with its own switch. */
export function isCallerEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CALLER_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setCallerEnabled(enabled: boolean) {
  try {
    localStorage.setItem(CALLER_KEY, enabled ? "1" : "0");
  } catch {
    // Storage can be blocked; the switch then lasts for the page only.
  }
}

/** The best Norwegian voice the device has: the natural, neural and premium ones are far better than the plain default. */
function bestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => /^(nb|no|nn)([-_]|$)/i.test(v.lang));
  if (voices.length === 0) return null;
  const rank = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 0 : /premium|enhanced|google/i.test(v.name) ? 1 : v.localService ? 3 : 2);
  return [...voices].sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Says a number or a short word, clearly and at once: what was still being said is cut off, so a quick round is never read late.
 * Never throws; where there is no speech the game goes on silently.
 */
export function callOut(text: string) {
  if (typeof window === "undefined" || !isCallerEnabled() || !("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nb-NO";
    const voice = bestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech can fail for platform reasons; it must never break a round.
  }
}
