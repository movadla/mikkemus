"use client";

import { useSyncExternalStore } from "react";
import { playCareerSound, playDrawTick, playUiSound, type CareerSoundKind } from "./fanfare";
import { getFxLevel } from "./fxLevel";
import { haptics } from "./haptics";

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
export type UiSoundKind = "click" | "pick" | "confirm" | "undo" | "record";

export function uiSound(kind: UiSoundKind): void {
  const level = getFxLevel();
  if (level !== "party" && level !== "full") return;
  if (!getUiSound()) return;
  playUiSound(kind);
}

/**
 * The sound and the touch of one action together, so a screen asks for "a choice was made" and gets both, the same way everywhere.
 * Each is held back on its own terms: the sound to Party and up and the setting, the touch from the quiet mode and from anyone who
 * has asked for less movement.
 */
export function uiFeedback(kind: UiSoundKind): void {
  const touch = { click: haptics.tick, pick: haptics.pick, confirm: haptics.confirm, undo: haptics.undo, record: haptics.record }[kind];
  touch();
  uiSound(kind);
}

/** The draw's sounds: a note for each pair and a chord at the end, on the same terms as the rest (Party and up, and the setting). */
export function drawSound(progress: number, last = false): void {
  const level = getFxLevel();
  if (level !== "party" && level !== "full") return;
  if (!getUiSound()) return;
  playDrawTick(progress, last);
}

/**
 * The files the career's sounds can be played from, in public/career/sounds/. A sound with a file there is played from the file; one without
 * (or one that cannot be played) is made by the synthesizer, so the files can be added one at a time, whenever they are ready.
 */
const SOUND_FILES: Record<CareerSoundKind, string> = {
  coin: "coin",
  unlock: "unlock",
  "crowd-1": "crowd-pub",
  "crowd-2": "crowd-hall",
  "crowd-3": "crowd-arena",
  cheer: "cheer",
};
const SOUND_VOLUME: Record<CareerSoundKind, number> = { coin: 0.6, unlock: 0.7, "crowd-1": 0.5, "crowd-2": 0.6, "crowd-3": 0.7, cheer: 0.8 };
/** Whether a file was found for a sound: not asked about until the first time it is wanted. */
const soundFound = new Map<CareerSoundKind, boolean>();

/** The career's sounds (a coin, something opened, the crowd, a cheer), on the same terms as the rest: Party and up, and the setting. */
export function careerSound(kind: CareerSoundKind): void {
  const level = getFxLevel();
  if (level !== "party" && level !== "full") return;
  if (!getUiSound()) return;
  if (soundFound.get(kind) === false || typeof Audio === "undefined") {
    playCareerSound(kind);
    return;
  }
  try {
    const audio = new Audio(`/career/sounds/${SOUND_FILES[kind]}.mp3`);
    audio.volume = SOUND_VOLUME[kind];
    void audio.play().then(
      () => soundFound.set(kind, true),
      () => {
        soundFound.set(kind, false);
        playCareerSound(kind);
      },
    );
  } catch {
    soundFound.set(kind, false);
    playCareerSound(kind);
  }
}
