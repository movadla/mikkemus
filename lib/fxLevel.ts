"use client";

import { useSyncExternalStore } from "react";

/**
 * How much happens on screen and in the speakers: Vanlig, Party or Full party.
 *
 * Party is the app as it has always been — the escalating boom per dart, the shake and heat, the
 * dives at the start and the win, confetti. Vanlig is the same game with the noise turned down to
 * what it takes to follow it. Full party adds the crowd under a streak and a heavier confetti.
 *
 * Darts tapped in by hand never reach the per-dart effects at all: the boom, the shake and the
 * building heat belong to real throws (a Scolia dart or a bot's), which land a second apart. A
 * person tapping a phone is slower and less even, and those effects would arrive out of step with
 * what they are doing. Hand-entered darts get the click under the finger and the slam on a row
 * they close, which do not depend on timing — see MikkeMusApp's registerHitFromUi.
 */
export type FxLevel = "normal" | "party" | "full";

export const FX_LEVELS: FxLevel[] = ["normal", "party", "full"];

export const FX_LABELS: Record<FxLevel, string> = {
  normal: "Vanlig",
  party: "Party",
  full: "Full party",
};

/** What the app did before there was a choice — so nobody's game changes by updating. */
export const DEFAULT_FX_LEVEL: FxLevel = "party";

export type FxFlags = {
  /** The loudest the hit boom may get, by how many darts in a row have scored. */
  boomMaxStreak: 1 | 2 | 3;
  /** The glow that builds across an unbroken turn. */
  heat: boolean;
  /** The screen shake on a hit (still also behind its own switch in the game's controls). */
  shake: boolean;
  /** The full-screen moment for three triples in a turn. */
  tripleOverlay: boolean;
  /** The board-dive when a match starts and when it is won. */
  dives: boolean;
  /** Confetti on the winner screen. */
  confetti: boolean;
  /** A heavier confetti, for Full party. */
  bigConfetti: boolean;
  /** Crowd noise under the third dart of a streak. */
  crowd: boolean;
  /** A dart that flies into the board for every cross that scores (also by hand). */
  dartFlight: boolean;
  /** A shockwave and the word slammed in when a triple or double lands. */
  ringSlam: boolean;
  /** The three lit darts and the glint when all three darts of a turn count. */
  perfectBurst: boolean;
  /** Flames round the thrower's picture while a run of counting darts builds. */
  fire: boolean;
  /** Spotlights and fog when a new thrower is up. */
  walkOn: boolean;
  /** Gold outline, glint and dust on a row that has just closed. */
  rowShine: boolean;
  /** The winning team's own shirts raining down on the winner screen. */
  shirtRain: boolean;
  /** The glint and the crown when a team or player takes the lead. */
  leadChange: boolean;
  /** Short lines about the match in a ticker (a run, a closed row, a triple, who is one row away). */
  commentary: boolean;
  /** The red pulsing edge and «MATCHDART» while the thrower has one row left. */
  matchDart: boolean;
  /** The last turn played back in slow motion on the winner screen, from the real dart positions. */
  replay: boolean;
  /** The gold banner and the crown when a personal record is beaten. */
  recordBanner: boolean;
  /** A team's own walk-on tune when it is up. */
  walkOnTune: boolean;
  /** A dart that misses bounces off and falls. */
  missBounce: boolean;
  /** The line-up with a count down before the first dart. */
  lineup: boolean;
};

const FLAGS: Record<FxLevel, FxFlags> = {
  normal: { boomMaxStreak: 1, heat: false, shake: false, tripleOverlay: false, dives: false, confetti: false, bigConfetti: false, crowd: false, dartFlight: false, ringSlam: false, perfectBurst: false, fire: false, walkOn: false, rowShine: false, shirtRain: false, leadChange: false, commentary: false, matchDart: false, replay: false, recordBanner: false, walkOnTune: false, missBounce: false, lineup: false },
  party: { boomMaxStreak: 3, heat: true, shake: true, tripleOverlay: true, dives: true, confetti: true, bigConfetti: false, crowd: false, dartFlight: false, ringSlam: false, perfectBurst: false, fire: false, walkOn: false, rowShine: false, shirtRain: false, leadChange: false, commentary: false, matchDart: false, replay: false, recordBanner: false, walkOnTune: false, missBounce: false, lineup: false },
  full: { boomMaxStreak: 3, heat: true, shake: true, tripleOverlay: true, dives: true, confetti: true, bigConfetti: true, crowd: true, dartFlight: true, ringSlam: true, perfectBurst: true, fire: true, walkOn: true, rowShine: true, shirtRain: true, leadChange: true, commentary: true, matchDart: true, replay: true, recordBanner: true, walkOnTune: true, missBounce: true, lineup: true },
};

export function fxFlags(level: FxLevel): FxFlags {
  return FLAGS[level] ?? FLAGS[DEFAULT_FX_LEVEL];
}

/** Anything stored — nothing, or a value from some other version — into a valid level. */
export function normalizeFxLevel(raw: unknown): FxLevel {
  return raw === "normal" || raw === "party" || raw === "full" ? raw : DEFAULT_FX_LEVEL;
}

const STORAGE_KEY = "mikke-mus-fx-level";
const listeners = new Set<() => void>();

export function getFxLevel(): FxLevel {
  if (typeof window === "undefined") return DEFAULT_FX_LEVEL;
  try {
    return normalizeFxLevel(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_FX_LEVEL;
  }
}

export function setFxLevel(level: FxLevel): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // Private mode / quota — the choice just won't outlive this session.
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The chosen level as a React value. Server render and first client render agree on the
 *  default, so a stored choice never causes a hydration mismatch. */
export function useFxLevel(): FxLevel {
  return useSyncExternalStore(subscribe, getFxLevel, () => DEFAULT_FX_LEVEL);
}
