function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration can be blocked or unsupported for all sorts of platform
    // reasons (iOS Safari has no Vibration API at all) — never let it break
    // the interaction it's attached to.
  }
}

export const haptics = {
  hit: () => vibrate(10),
  undo: () => vibrate(8),
  confirm: () => vibrate(15),
  win: () => vibrate([40, 30, 40]),
};
