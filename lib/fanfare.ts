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

let noiseBuffer: AudioBuffer | null = null;

/** Two seconds of white noise, reused by every crowd/impact voice — noise is the right
 *  primitive for both, so this gets generated once and played back at different rates. */
function getNoise(ctx: AudioContext): AudioBuffer | null {
  if (noiseBuffer) return noiseBuffer;
  try {
    const length = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  } catch {
    return null;
  }
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
const C4 = 261.63;
const G4 = 392.0;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1568.0;

export type FanfareVariant = 1 | 2 | 3;

/**
 * Which variant the real win actually plays. There's no way to judge a synthesized fanfare
 * from the code, so /lyd plays all three side by side and this is the one line that changes
 * once a favourite is picked.
 */
const WIN_FANFARE: FanfareVariant = 1;

/** Match won. See WIN_FANFARE — /lyd is where these get compared. */
export function playFanfare() {
  playFanfareVariant(WIN_FANFARE);
}

/**
 * The three candidate win fanfares:
 *  1. Rising bugle call into a held top note over a triad, then a closing accent.
 *  2. Classic cavalry "charge!" — repeated short notes driving up into the top note.
 *  3. Slower and broader: a low pickup into a big sustained major chord, more orchestra
 *     than solo trumpet, leaning on the reverb tail.
 */
export function playFanfareVariant(variant: FanfareVariant) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const t = ctx.currentTime + 0.03;

    if (variant === 2) {
      // Short, driving, staccato — the "charge!" shape: G G G C E, then the top held.
      brassNote(ctx, buses, G5, t, 0.1, 0.17);
      brassNote(ctx, buses, G5, t + 0.12, 0.1, 0.17);
      brassNote(ctx, buses, G5, t + 0.24, 0.1, 0.17);
      brassNote(ctx, buses, C6, t + 0.36, 0.12, 0.18);
      brassNote(ctx, buses, E6, t + 0.5, 0.12, 0.18);
      brassNote(ctx, buses, G6, t + 0.64, 1.1, 0.2);
      brassNote(ctx, buses, C6, t + 0.64, 1.05, 0.1);
      brassNote(ctx, buses, E6, t + 0.64, 1.05, 0.09);
      return;
    }

    if (variant === 3) {
      // Broad and pompous: low pickup, then a big sustained chord left to ring.
      brassNote(ctx, buses, C4, t, 0.3, 0.13);
      brassNote(ctx, buses, G4, t + 0.26, 0.3, 0.14);
      brassNote(ctx, buses, C5, t + 0.52, 1.7, 0.15);
      brassNote(ctx, buses, E5, t + 0.62, 1.6, 0.12);
      brassNote(ctx, buses, G5, t + 0.72, 1.5, 0.12);
      brassNote(ctx, buses, C6, t + 0.82, 1.4, 0.11);
      brassNote(ctx, buses, E6, t + 0.92, 1.3, 0.08);
      return;
    }

    // Variant 1 — "tud-de-li-TUUU": three short rising notes into the held one.
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
      playPerfectRoundVariant(PERFECT_ROUND);
      return;
    }

    const gain = streak === 1 ? 0.1 : 0.16;
    softTone(ctx, buses, streak === 1 ? G4 / 2 : G4 / 2 + 25, now, 0.1, gain, "triangle");
    softTone(ctx, buses, streak === 1 ? C6 * 0.63 : C6 * 0.75, now + 0.06, 0.16, gain, "sine");
  } catch {
    // Never let a synth glitch break a turn.
  }
}

export type PerfectRoundVariant = 1 | 2;

/** Which perfect-round flourish a real 3-for-3 turn plays — same "pick it on /lyd, change
 *  this one line" arrangement as WIN_FANFARE. */
const PERFECT_ROUND: PerfectRoundVariant = 1;

/**
 * The two candidate perfect-round flourishes — both deliberately shorter and lower than
 * any win fanfare, so a good turn never gets mistaken for a won match:
 *  1. A small rising call into a held triad.
 *  2. A quick climbing run that lands on a bright top note, more "ka-ching" than fanfare.
 */
export function playPerfectRoundVariant(variant: PerfectRoundVariant) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const now = ctx.currentTime + 0.02;

    if (variant === 2) {
      brassNote(ctx, buses, G4, now, 0.08, 0.13);
      brassNote(ctx, buses, C5, now + 0.07, 0.08, 0.14);
      brassNote(ctx, buses, E5, now + 0.14, 0.08, 0.14);
      brassNote(ctx, buses, G5, now + 0.21, 0.08, 0.15);
      brassNote(ctx, buses, A5, now + 0.28, 0.55, 0.17);
      brassNote(ctx, buses, E5, now + 0.28, 0.5, 0.08);
      return;
    }

    brassNote(ctx, buses, C5, now, 0.13, 0.15);
    brassNote(ctx, buses, E5, now + 0.13, 0.12, 0.15);
    brassNote(ctx, buses, G5, now + 0.25, 0.13, 0.16);
    brassNote(ctx, buses, C6, now + 0.4, 0.7, 0.18);
    brassNote(ctx, buses, G5, now + 0.4, 0.65, 0.09);
    brassNote(ctx, buses, E5, now + 0.4, 0.65, 0.08);
  } catch {
    // Never let a synth glitch break a turn.
  }
}

// ---- Boom og publikumsjubel -------------------------------------------------

/**
 * Every knob runs 1-5 rather than 0-1 so a choice made by ear on /lyd can be reported back
 * and pinned down exactly ("boom: darkness 4, volume 3, grit 2") instead of being
 * re-guessed from a description.
 */
function clampLevel(level: number): number {
  return Math.max(1, Math.min(5, level));
}

/** Maps a 1-5 level onto a value range, linearly. */
function lerpLevel(level: number, atOne: number, atFive: number): number {
  return atOne + ((clampLevel(level) - 1) / 4) * (atFive - atOne);
}

/** A soft-clip curve — adds harmonics so a very low boom still reads on a phone speaker
 *  that cannot reproduce the fundamental at all. Amount 0 leaves the signal alone. */
function makeSaturation(ctx: AudioContext, amount: number): WaveShaperNode | null {
  if (amount <= 0) return null;
  try {
    const shaper = ctx.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    const k = amount * 40;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = "2x";
    return shaper;
  } catch {
    return null;
  }
}

export type BoomParams = {
  /** 1 = half-dark and short, 5 = very dark and long. Moves the pitch sweep and the tail. */
  darkness: number;
  /** 1 = restrained, 5 = heavy. */
  volume: number;
  /** 1 = clean tone, 5 = lots of attack/grit. Drives the noise transient and saturation. */
  grit: number;
};

export const BOOM_DEFAULT: BoomParams = { darkness: 3, volume: 3, grit: 2 };

/**
 * A deep impact. A sine swept downward is the classic cinematic boom — the pitch drop is
 * what the ear reads as weight, not raw loudness. Darkness moves both ends of that sweep
 * down and stretches the tail; grit adds the noise crack on the attack plus saturation, so
 * the hit still cuts through when the fundamental is below what the speaker can produce.
 */
export function playBoom(params: BoomParams = BOOM_DEFAULT) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const t = ctx.currentTime + 0.02;

    const startFreq = lerpLevel(params.darkness, 175, 58);
    const endFreq = lerpLevel(params.darkness, 68, 22);
    const duration = lerpLevel(params.darkness, 0.55, 2.2);
    const peak = lerpLevel(params.volume, 0.22, 1.0);
    const gritAmount = (clampLevel(params.grit) - 1) / 4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    env.connect(buses.master);
    // Low end gets only a little reverb — more than that turns to mud.
    const send = ctx.createGain();
    send.gain.value = 0.22;
    env.connect(send);
    send.connect(buses.reverb);

    const saturation = makeSaturation(ctx, gritAmount * 0.6);
    if (saturation) saturation.connect(env);
    const bodyInput: AudioNode = saturation ?? env;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration * 0.55);
    osc.connect(bodyInput);
    osc.start(t);
    osc.stop(t + duration + 0.05);

    // An octave up, quiet — insurance for speakers that cannot do the fundamental.
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(startFreq * 2, t);
    harm.frequency.exponentialRampToValueAtTime(endFreq * 2, t + duration * 0.4);
    const harmEnv = ctx.createGain();
    harmEnv.gain.setValueAtTime(0.0001, t);
    harmEnv.gain.linearRampToValueAtTime(peak * 0.28, t + 0.01);
    harmEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.5);
    harm.connect(harmEnv);
    harmEnv.connect(buses.master);
    harm.start(t);
    harm.stop(t + duration);

    const noise = gritAmount > 0 ? getNoise(ctx) : null;
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = lerpLevel(params.grit, 500, 2600);
      const nEnv = ctx.createGain();
      nEnv.gain.setValueAtTime(peak * 0.65 * gritAmount, t);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, t + lerpLevel(params.grit, 0.06, 0.22));
      src.connect(lp);
      lp.connect(nEnv);
      nEnv.connect(buses.master);
      nEnv.connect(buses.reverb);
      src.start(t);
      src.stop(t + 0.3);
    }
  } catch {
    // Never let a synth glitch break a turn.
  }
}

export type CrowdParams = {
  /** 1 = bright and thin, 5 = dark and muffled. The top end of the noise bed. */
  darkness: number;
  /** 1 = scattered, 5 = the whole room. */
  volume: number;
  /** 1 = a few voices, 5 = a packed crowd. Drives the shout count and the length. */
  density: number;
};

export const CROWD_DEFAULT: CrowdParams = { darkness: 3, volume: 3, density: 3 };

/**
 * Crowd cheer. Unlike brass, a crowd genuinely IS filtered noise — hundreds of voices
 * average out into a band of it — so this gets far closer to the real thing than the
 * oscillator fanfares ever could. Three layers do the work: a noise bed shaped to the
 * vocal range, an irregular level wobble so it breathes instead of hissing flatly, and
 * short brighter bursts standing in for individual shouts, which is the detail that reads
 * as people rather than as static.
 */
export function playCrowd(params: CrowdParams = CROWD_DEFAULT) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const noise = getNoise(ctx);
    if (!noise) return;
    const t = ctx.currentTime + 0.02;

    const topEnd = lerpLevel(params.darkness, 3600, 1050);
    const peak = lerpLevel(params.volume, 0.09, 0.7);
    const duration = lerpLevel(params.density, 0.9, 3.2);
    const shouts = Math.round(lerpLevel(params.density, 2, 20));
    const swell = lerpLevel(params.density, 0.18, 0.5);

    const bed = ctx.createBufferSource();
    bed.buffer = noise;
    bed.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = lerpLevel(params.darkness, 1200, 700);
    band.Q.value = 0.55;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = lerpLevel(params.darkness, 380, 220);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(topEnd * 0.6, t);
    lp.frequency.linearRampToValueAtTime(topEnd, t + swell);
    lp.frequency.linearRampToValueAtTime(topEnd * 0.5, t + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + swell);
    // Irregular wobble across the sustain — this is what stops it sounding like static.
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const at = t + swell + ((duration - swell) * i) / (steps + 1);
      env.gain.linearRampToValueAtTime(peak * (0.6 + Math.random() * 0.4), at);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    bed.connect(band);
    band.connect(hp);
    hp.connect(lp);
    lp.connect(env);
    env.connect(buses.master);
    env.connect(buses.reverb);
    bed.start(t);
    bed.stop(t + duration + 0.1);

    for (let i = 0; i < shouts; i++) {
      const at = t + swell * 0.5 + Math.random() * Math.max(0.1, duration - swell);
      const len = 0.14 + Math.random() * 0.3;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = 0.8 + Math.random() * 0.5;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = lerpLevel(params.darkness, 900, 600) + Math.random() * lerpLevel(params.darkness, 1800, 900);
      bp.Q.value = 1.6 + Math.random() * 2;
      const sEnv = ctx.createGain();
      sEnv.gain.setValueAtTime(0.0001, at);
      sEnv.gain.linearRampToValueAtTime(peak * (0.16 + Math.random() * 0.22), at + 0.05);
      sEnv.gain.exponentialRampToValueAtTime(0.0001, at + len);
      src.connect(bp);
      bp.connect(sEnv);
      sEnv.connect(buses.master);
      sEnv.connect(buses.reverb);
      src.start(at);
      src.stop(at + len + 0.05);
    }
  } catch {
    // Never let a synth glitch break a turn.
  }
}

