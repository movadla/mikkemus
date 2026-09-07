type WakeLockNavigator = Navigator & {
  wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
};

let sentinel: { release: () => Promise<void> } | null = null;

async function acquire() {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    sentinel = await (navigator as WakeLockNavigator).wakeLock.request("screen");
  } catch {
    // Denied, unsupported in this context, or the page isn't visible right now —
    // never let this break the match in progress.
    sentinel = null;
  }
}

/**
 * Keeps the screen from locking/dimming while a match is in progress. Without this, once
 * the phone naturally times out and locks between darts, iOS suspends the page's
 * AudioContext (see lib/fanfare.ts's playFanfare/playHitStreakSound) — and with Scolia
 * auto-scoring the match hands-free, there's no further tap available to re-unlock audio
 * before the next hit needs it, so the match goes permanently silent. Call this when a
 * game screen mounts; call the returned cleanup when it unmounts.
 */
export function startWakeLock(): () => void {
  acquire();
  function onVisibilityChange() {
    // The OS releases the lock whenever the tab is hidden — re-request once it's back,
    // per the Wake Lock API's own documented behavior (a lock can't be pre-emptively renewed).
    if (document.visibilityState === "visible") acquire();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    sentinel?.release().catch(() => {});
    sentinel = null;
  };
}
