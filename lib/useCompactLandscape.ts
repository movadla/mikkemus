import { useSyncExternalStore } from "react";

/**
 * True on a phone turned sideways — the same condition as the landscape block in globals.css,
 * deliberately duplicated as one shared constant rather than guessed at in two places.
 *
 * The board gets about 34px of row height there, and a mark drawn on a square viewBox can
 * therefore never be wider than 34px no matter how much width the row has: an SVG scales to
 * FIT its box, so the glyph was using roughly a twentieth of a 590px-wide cell. Components
 * ask this to switch to the wide variant of the glyph instead.
 */
const QUERY = "(orientation: landscape) and (max-height: 560px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// The prerendered markup is the portrait layout — there is no viewport to measure on the
// server, and claiming landscape there would hydrate into a mismatch.
function getServerSnapshot() {
  return false;
}

export function useCompactLandscape() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
