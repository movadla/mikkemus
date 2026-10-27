"use client";

import { useSyncExternalStore } from "react";

/** How fast the bots throw: the pause before each of their darts. A setting of the device, in Innstillinger, for every game with a bot. */
export type BotSpeed = "slow" | "normal" | "fast" | "instant";

export const BOT_SPEEDS: BotSpeed[] = ["slow", "normal", "fast", "instant"];
export const BOT_SPEED_LABELS: Record<BotSpeed, string> = { slow: "Rolig", normal: "Vanlig", fast: "Rask", instant: "Lyn" };
export const DEFAULT_BOT_SPEED: BotSpeed = "normal";

const DELAY_MS: Record<BotSpeed, number> = { slow: 1800, normal: 900, fast: 450, instant: 120 };
const STORAGE_KEY = "mikke-mus-bot-speed";
const listeners = new Set<() => void>();

export function normalizeBotSpeed(raw: unknown): BotSpeed {
  return raw === "slow" || raw === "normal" || raw === "fast" || raw === "instant" ? raw : DEFAULT_BOT_SPEED;
}

export function getBotSpeed(): BotSpeed {
  if (typeof window === "undefined") return DEFAULT_BOT_SPEED;
  try {
    return normalizeBotSpeed(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_BOT_SPEED;
  }
}

/** The pause between a bot's darts, in milliseconds, at the chosen speed. Read each time a dart is due, so a change counts at once. */
export const botDelayMs = (speed: BotSpeed = getBotSpeed()): number => DELAY_MS[speed];

export function setBotSpeed(speed: BotSpeed): void {
  try {
    localStorage.setItem(STORAGE_KEY, speed);
  } catch {
    // Private mode / quota: the choice just does not outlive this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The chosen speed as a React value; the server and the first client render agree on the default. */
export function useBotSpeed(): BotSpeed {
  return useSyncExternalStore(subscribe, getBotSpeed, () => DEFAULT_BOT_SPEED);
}
