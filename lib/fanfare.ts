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

export type BoomDarkness = 1 | 2 | 3;

/**
 * A deep impact — the "boooom". A sine swept downward is the classic cinematic boom: the
 * pitch drop is what the ear reads as weight, not raw loudness. `darkness` moves both ends
 * of that sweep down and stretches the tail, so 1 is a firm thump and 3 is a long
 * sub-heavy rumble. A short filtered-noise transient on top supplies the initial "crack"
 * that keeps it from sounding like a bare test tone.
 */
export function playBoom(darkness: BoomDarkness) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const t = ctx.currentTime + 0.02;

    const startFreq = darkness === 1 ? 150 : darkness === 2 ? 105 : 72;
    const endFreq = darkness === 1 ? 58 : darkness === 2 ? 41 : 27;
    const duration = darkness === 1 ? 0.75 : darkness === 2 ? 1.2 : 1.8;
    const peak = darkness === 1 ? 0.5 : darkness === 2 ? 0.6 : 0.7;

    // Body: the swept fundamental.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration * 0.55);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env);
    env.connect(buses.master);
    // Only a little reverb on the low end — too much and it turns to mud.
    const boomSend = ctx.createGain();
    boomSend.gain.value = 0.25;
    env.connect(boomSend);
    boomSend.connect(buses.reverb);
    osc.start(t);
    osc.stop(t + duration + 0.05);

    // A second voice an octave up, quiet, so the hit still reads on phone speakers that
    // can't reproduce 30 Hz at all.
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(startFreq * 2, t);
    harm.frequency.exponentialRampToValueAtTime(endFreq * 2, t + duration * 0.4);
    const harmEnv = ctx.createGain();
    harmEnv.gain.setValueAtTime(0.0001, t);
    harmEnv.gain.linearRampToValueAtTime(peak * 0.3, t + 0.01);
    harmEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.5);
    harm.connect(harmEnv);
    harmEnv.connect(buses.master);
    harm.start(t);
    harm.stop(t + duration);

    // Attack transient.
    const noise = getNoise(ctx);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = darkness === 1 ? 1400 : darkness === 2 ? 900 : 600;
      const nEnv = ctx.createGain();
      nEnv.gain.setValueAtTime(peak * 0.5, t);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      src.connect(lp);
      lp.connect(nEnv);
      nEnv.connect(buses.master);
      nEnv.connect(buses.reverb);
      src.start(t);
      src.stop(t + 0.2);
    }
  } catch {
    // Never let a synth glitch break a turn.
  }
}

export type CrowdIntensity = 1 | 2 | 3;

/**
 * Crowd cheer. Unlike brass, a crowd genuinely IS filtered noise — hundreds of voices
 * average out into a band of it — so this gets much closer to the real thing than the
 * oscillator-based fanfares ever could. Three layers do the work: a noise bed shaped to
 * the vocal range, an irregular level wobble so it breathes instead of hissing flatly, and
 * a handful of short brighter bursts standing in for individual shouts. `intensity` raises
 * the level, opens the top end and adds more of those shouts, so 1 reads as scattered
 * approval and 3 as the whole room going up.
 */
export function playCrowd(intensity: CrowdIntensity) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const noise = getNoise(ctx);
    if (!noise) return;
    const t = ctx.currentTime + 0.02;

    const duration = intensity === 1 ? 1.2 : intensity === 2 ? 1.8 : 2.8;
    const peak = intensity === 1 ? 0.16 : intensity === 2 ? 0.3 : 0.5;
    // Kept deliberately dark — a bright crowd bed just sounds like tape hiss.
    const topEnd = intensity === 1 ? 1500 : intensity === 2 ? 2100 : 2800;
    const swell = intensity === 1 ? 0.22 : intensity === 2 ? 0.3 : 0.45;

    const bed = ctx.createBufferSource();
    bed.buffer = noise;
    bed.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.55;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(topEnd * 0.6, t);
    lp.frequency.linearRampToValueAtTime(topEnd, t + swell);
    lp.frequency.linearRampToValueAtTime(topEnd * 0.5, t + duration);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;

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

    // Individual shouts on top — the detail that reads as people rather than noise.
    const shouts = intensity === 1 ? 3 : intensity === 2 ? 6 : 11;
    for (let i = 0; i < shouts; i++) {
      const at = t + swell * 0.5 + Math.random() * (duration - swell);
      const len = 0.14 + Math.random() * 0.3;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = 0.8 + Math.random() * 0.5;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 700 + Math.random() * 1600;
      bp.Q.value = 1.6 + Math.random() * 2;
      const sEnv = ctx.createGain();
      sEnv.gain.setValueAtTime(0.0001, at);
      sEnv.gain.linearRampToValueAtTime(peak * (0.16 + Math.random() * 0.2), at + 0.05);
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
