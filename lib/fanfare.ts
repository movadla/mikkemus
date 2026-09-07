let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  // `new Ctor()` itself can throw — e.g. an installed iOS PWA (standalone display mode,
  // no browser chrome) has been seen refusing AudioContext construction outright in some
  // iOS versions. Every caller (primeAudio/playFanfare/playHitStreakSound) relies on this
  // returning null on failure rather than throwing, since primeAudio is called directly
  // from startGame's click handler with nothing else catching it.
  if (!sharedContext) {
    try {
      sharedContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedContext;
}

/**
 * Unlocks the shared AudioContext — call this from a real user gesture (a button tap)
 * well before a sound needs to actually play. A fresh AudioContext starts "suspended"
 * and browsers only let `.resume()` succeed when it's called (synchronously, in the same
 * event-handler stack) from a genuine click/tap — a later win/hit-detected callback fires
 * from a Scolia/Supabase event, not a click, so priming here is what makes playFanfare/
 * playHitStreakSound actually audible instead of silently blocked by autoplay policy.
 */
export function primeAudio() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    // Never let a synth glitch break the interaction that triggered priming.
  }
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, peakGain: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * A short synthesized victory fanfare (ascending major arpeggio) — no audio asset to
 * source/license/ship, just a few oscillators with a brassy-ish envelope. Never throws;
 * silently no-ops if Web Audio is unavailable — see primeAudio's own comment for why a
 * call site should also prime this well before it fires.
 */
export function playFanfare() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const notes: [number, number][] = [
      [523.25, 0.16],
      [659.25, 0.16],
      [783.99, 0.16],
      [1046.5, 0.32],
    ]; // C5 E5 G5 C6 — the last note held longer, the "tuddeli-TU!" landing note.
    let t = ctx.currentTime;
    notes.forEach(([freq, duration], i) => {
      const peak = i === notes.length - 1 ? 0.24 : 0.17;
      tone(ctx, freq, t, duration, peak, "sawtooth");
      t += duration * 0.6;
    });
  } catch {
    // Never let a synth glitch break the win flow.
  }
}

/**
 * A calm two-note "dunk-pling" cue marking a hit-streak within one turn (see
 * lib/game.ts's DARTS_PER_TURN) — quiet for the first dart of the turn, louder once the
 * second dart also hits, loudest plus a short extra flourish once all three do (a
 * "perfect round"). Callers only invoke this while the streak is unbroken from dart 1 —
 * see MikkeMusApp's processDart, which resets/breaks the streak on any miss.
 */
export function playHitStreakSound(streak: 1 | 2 | 3) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const gain = streak === 1 ? 0.09 : streak === 2 ? 0.16 : 0.24;
    const dunkFreq = 110 + (streak - 1) * 20;
    const plingFreq = 660 + (streak - 1) * 110;
    tone(ctx, dunkFreq, now, 0.09, gain, "triangle");
    tone(ctx, plingFreq, now + 0.06, 0.14, gain, "sine");
    if (streak === 3) {
      // Small flourish for a perfect 3-dart round — shorter/quieter than playFanfare's own.
      const notes = [783.99, 1046.5]; // G5 C6
      notes.forEach((freq, i) => tone(ctx, freq, now + 0.22 + i * 0.11, 0.16, 0.18, "sawtooth"));
    }
  } catch {
    // Never let a synth glitch break a turn.
  }
}
