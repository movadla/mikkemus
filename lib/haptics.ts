import { getFxLevel } from "./fxLevel";

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    // Not in the quiet mode, and not for anyone who has asked for less movement.
    if (getFxLevel() === "simple") return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern);
  } catch {
    // Vibration can be blocked or unsupported for all sorts of platform
    // reasons (iOS Safari has no Vibration API at all) — never let it break
    // the interaction it's attached to.
  }
}

export const haptics = {
  /** A button pressed: the lightest touch. */
  tick: () => vibrate(8),
  /** A row closed. */
  close: () => vibrate([20, 40, 30]),
  hit: () => vibrate(10),
  undo: () => vibrate(8),
  confirm: () => vibrate(15),
  win: () => vibrate([40, 30, 40]),
};
