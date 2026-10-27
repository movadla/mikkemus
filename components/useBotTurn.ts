"use client";

import { useEffect, useRef } from "react";

/**
 * Lets a bot play: when `active` (a bot is up, and nothing else is going on), `play` is called once after the pause. `key` changes with
 * every round or dart, so the next one gets its own pause; the pause is read when it starts, so a change of the bot speed counts at once.
 */
export function useBotTurn(active: boolean, key: unknown, pause: () => number, play: () => void) {
  const latest = useRef(play);
  useEffect(() => {
    latest.current = play;
  });
  const pauseRef = useRef(pause);
  useEffect(() => {
    pauseRef.current = pause;
  });
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => latest.current(), pauseRef.current());
    return () => clearTimeout(timer);
  }, [active, key]);
}
