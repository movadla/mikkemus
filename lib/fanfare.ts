let sharedContext: AudioContext | null = null;
let masterBus: GainNode | null = null;
let reverbBus: ConvolverNode | null = null;
let brassWave: PeriodicWave | null = null;

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
 * A synthesized room: a stereo noise burst with an exponential decay is all a convolution
 * reverb needs for an impulse response. This is the single biggest thing separating "beeps
 * from a computer" from "an instrument played somewhere" — bare oscillators with no space
 * around them are what read as cheap and synthetic.
 */
function buildImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/**
 * A trumpet-ish harmonic spectrum — strong fundamental with slowly falling upper
 * harmonics, which is roughly what makes brass read as brass rather than as a synth
 * sawtooth. One oscillator carries the whole spectrum instead of stacking ten of them.
 */
function getBrassWave(ctx: AudioContext): PeriodicWave | null {
  if (brassWave) return brassWave;
  try {
    const harmonics = [0, 1, 0.85, 0.75, 0.6, 0.45, 0.3, 0.2, 0.13, 0.08, 0.05];
    const real = new Float32Array(harmonics.length);
    const imag = Float32Array.from(harmonics);
    brassWave = ctx.createPeriodicWave(real, imag);
    return brassWave;
  } catch {
    return null;
  }
}

type Buses = { master: GainNode; reverb: ConvolverNode };

function getBuses(ctx: AudioContext): Buses | null {
  if (masterBus && reverbBus) return { master: masterBus, reverb: reverbBus };
  try {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = buildImpulse(ctx, 1.8, 3);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet);
    wet.connect(master);

    masterBus = master;
    reverbBus = reverb;
    return { master, reverb };
  } catch {
    return null;
  }
}

/**
 * Unlocks the shared AudioContext and builds the reverb/bus graph up front — call this
 * from a real user gesture (a button tap) well before a sound needs to actually play.
 * A fresh AudioContext starts "suspended" and browsers only let `.resume()` succeed when
 * it's called (synchronously, in the same event-handler stack) from a genuine click/tap —
 * a later win/hit-detected callback fires from a Scolia/Supabase event, not a click, so
 * priming here is what makes the sounds audible rather than silently blocked. Building the
 * impulse response here too keeps its one-off cost off the first note.
 */
export function primeAudio() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    getBuses(ctx);
    getBrassWave(ctx);
  } catch {
    // Never let a synth glitch break the interaction that triggered priming.
  }
}

/**
 * One brass-ish note: two slightly detuned oscillators (two players never sit at exactly
 * the same pitch — that tiny spread is most of the "real ensemble" impression), a soft
 * attack rather than an instant one, a filter that opens as the note is "blown", and a
 * send into the shared reverb.
 */
function brassNote(ctx: AudioContext, buses: Buses, freq: number, start: number, duration: number, peak: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(Math.max(400, freq * 1.1), start);
  filter.frequency.linearRampToValueAtTime(Math.min(9000, freq * 7), start + 0.07);
  filter.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2.2), start + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(peak, start + 0.035);
  env.gain.linearRampToValueAtTime(peak * 0.78, start + Math.min(0.14, duration * 0.4));
  env.gain.setValueAtTime(peak * 0.78, start + duration * 0.72);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  filter.connect(env);
  env.connect(buses.master);
  env.connect(buses.reverb);

  const wave = getBrassWave(ctx);
  for (const cents of [-6, 6]) {
    const osc = ctx.createOscillator();
    if (wave) osc.setPeriodicWave(wave);
    else osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}

/** A soft percussive tone (no brass spectrum) — the "dunk"/"pling" halves of the hit cue. */
function softTone(ctx: AudioContext, buses: Buses, freq: number, start: number, duration: number, peak: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(peak, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(buses.master);
  env.connect(buses.reverb);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

// Note frequencies (equal temperament).
const G4 = 392.0;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1568.0;

/**
 * Match won — the full fanfare: a rising bugle-style call into a held top note with a
 * major triad under it, left to ring out in the reverb. Roughly two seconds, which is
 * what makes it read as a fanfare rather than as a notification chime.
 */
export function playFanfare() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const t = ctx.currentTime + 0.03;

    // "tud-de-li-TUUU" — three short rising notes into the held one.
    brassNote(ctx, buses, G5, t, 0.15, 0.17);
    brassNote(ctx, buses, C6, t + 0.15, 0.14, 0.17);
    brassNote(ctx, buses, E6, t + 0.29, 0.15, 0.18);

    // The landing: top note held, with the triad underneath carrying the harmony.
    brassNote(ctx, buses, G6, t + 0.46, 0.95, 0.19);
    brassNote(ctx, buses, E6, t + 0.46, 0.9, 0.1);
    brassNote(ctx, buses, C6, t + 0.46, 0.9, 0.1);
    brassNote(ctx, buses, G5, t + 0.46, 0.9, 0.08);

    // Final accent, so it ends on a punch instead of just fading.
    brassNote(ctx, buses, C6, t + 1.5, 0.5, 0.14);
    brassNote(ctx, buses, E6, t + 1.5, 0.5, 0.12);
    brassNote(ctx, buses, G6, t + 1.5, 0.5, 0.14);
  } catch {
    // Never let a synth glitch break the win flow.
  }
}

/**
 * A calm two-note "dunk-pling" cue marking a hit-streak within one turn (see
 * lib/game.ts's DARTS_PER_TURN) — quiet for the first dart of the turn, louder once the
 * second dart also hits, and for all three a proper little brass fanfare of its own
 * (shorter and a fifth lower than the match-won one, so the two never read as the same
 * event). Callers only invoke this while the streak is unbroken from dart 1 — see
 * MikkeMusApp's processDart, which breaks the streak on any miss.
 */
export function playHitStreakSound(streak: 1 | 2 | 3) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const now = ctx.currentTime + 0.02;

    if (streak === 3) {
      // Perfect round — a real fanfare: rising call into a held triad.
      brassNote(ctx, buses, C5, now, 0.13, 0.15);
      brassNote(ctx, buses, E5, now + 0.13, 0.12, 0.15);
      brassNote(ctx, buses, G5, now + 0.25, 0.13, 0.16);
      brassNote(ctx, buses, C6, now + 0.4, 0.7, 0.18);
      brassNote(ctx, buses, G5, now + 0.4, 0.65, 0.09);
      brassNote(ctx, buses, E5, now + 0.4, 0.65, 0.08);
      return;
    }

    const gain = streak === 1 ? 0.1 : 0.16;
    softTone(ctx, buses, streak === 1 ? G4 / 2 : G4 / 2 + 25, now, 0.1, gain, "triangle");
    softTone(ctx, buses, streak === 1 ? C6 * 0.63 : C6 * 0.75, now + 0.06, 0.16, gain, "sine");
  } catch {
    // Never let a synth glitch break a turn.
  }
}
