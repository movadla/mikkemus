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
/** A recording that is longer than the moment it is for is faded out after this long (ms): the cheer is 16 seconds long, and a win needs about six. */
const SOUND_LIMIT_MS: Partial<Record<CareerSoundKind, number>> = { cheer: 6000 };
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
      () => {
        soundFound.set(kind, true);
        const limit = SOUND_LIMIT_MS[kind];
        if (limit) fadeOutAfter(audio, limit);
      },
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

/** Lets a sound play for `ms`, then turns it down over a second and stops it. */
function fadeOutAfter(audio: HTMLAudioElement, ms: number): void {
  const start = audio.volume;
  setTimeout(() => {
    const steps = 10;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      audio.volume = Math.max(0, start * (1 - i / steps));
      if (i >= steps || audio.ended) {
        clearInterval(timer);
        audio.pause();
      }
    }, 100);
  }, ms);
}

/* ---------------------------------------------------------------------------------------------------------------------------------
 * The music of a tournament's opening (public/sounds/intro.mp3): it starts when the opening comes up and is turned down and stopped when the
 * opening is left. One song at a time, so an opening that is drawn twice (a development build does that) does not play it twice.
 * ------------------------------------------------------------------------------------------------------------------------------- */
const INTRO_VOLUME = 0.6;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
let musicEl: HTMLAudioElement | null = null;
let effectEl: HTMLAudioElement | null = null;

/**
 * A phone (iOS above all) lets a page start a sound only from a touch. The opening and the win come a moment after the touch, so two players are
 * made at the first touch of the page and played in silence once: they are then free to play what is asked of them later.
 */
function unlockPlayers(): void {
  if (musicEl || typeof Audio === "undefined") return;
  musicEl = new Audio();
  effectEl = new Audio();
  for (const el of [musicEl, effectEl]) {
    el.src = SILENCE;
    void el.play().then(() => el.pause()).catch(() => {});
  }
}
if (typeof window !== "undefined") window.addEventListener("pointerdown", unlockPlayers, { once: true, capture: true });
let introAudio: HTMLAudioElement | null = null;
let introTrack = "";
/** The song of each opening: the world championship and the Grand Slam have their own, every other tournament the first. */
export type IntroTrack = "intro" | "intro-vm" | "intro-gs";
let introFade: ReturnType<typeof setInterval> | null = null;

/** Starts the music of an opening (heard in every level of effects; only "Lyd i appen" turns it off). Returns what ends it: it fades out over a second. */
export function startIntroMusic(track: IntroTrack = "intro"): () => void {
  if (!getUiSound() || typeof Audio === "undefined") return () => {};
  // Still playing from a moment ago (it was being turned down): it is turned up again, not started over.
  if (introFade) clearInterval(introFade);
  introFade = null;
  if (introAudio && !introAudio.paused && introTrack === track) {
    introAudio.volume = INTRO_VOLUME;
  } else {
    // Another song was still being turned down: it is stopped now.
    introAudio?.pause();
    try {
      introTrack = track;
      introAudio = musicEl ?? new Audio();
      introAudio.src = `/sounds/${track}.mp3`;
      introAudio.currentTime = 0;
      introAudio.volume = INTRO_VOLUME;
      introAudio.loop = true;
      void introAudio.play().catch(() => {
        introAudio = null;
      });
    } catch {
      introAudio = null;
    }
  }
  const mine = introAudio;
  return () => {
    if (!mine || mine !== introAudio) return;
    let i = 0;
    introFade = setInterval(() => {
      i += 1;
      mine.volume = Math.max(0, INTRO_VOLUME * (1 - i / 10));
      if (i >= 10) {
        if (introFade) clearInterval(introFade);
        introFade = null;
        mine.pause();
        if (introAudio === mine) introAudio = null;
      }
    }, 100);
  };
}
