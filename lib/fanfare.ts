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
/**
 * Throws the audio engine away and builds a fresh one, bound to whatever the output device is
 * NOW.
 *
 * For AirPlay. An AudioContext gets attached to the output route in force when it is created,
 * and starting screen mirroring afterwards does not necessarily move it — the picture goes to
 * the TV while the sound stays on the phone. Reloading the page fixes it because that makes a
 * new context; this does the same thing without losing the match.
 *
 * Everything cached off the old context (buses, reverb, the brass wave) belongs to it and has
 * to go with it, or the new context is handed nodes from a closed one.
 */
export function restartAudio() {
  const old = sharedContext;
  sharedContext = null;
  masterBus = null;
  reverbBus = null;
  brassWave = null;
  noiseBuffer = null;
  if (old) old.close().catch(() => {});
  primeAudio();
}

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

// Note frequencies (equal temperament).
// The low octaves the dark fanfare lives in — everything above was written for a trumpet call.
const C2 = 65.41;
const G2 = 98.0;
const C3 = 130.81;
const Eb3 = 155.56;
const G3 = 196.0;
const Bb3 = 233.08;
const Eb4 = 311.13;
const C4 = 261.63;
const G4 = 392.0;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1568.0;

export type FanfareVariant = 1 | 2 | 3 | 4;

/**
 * Which variant the real win actually plays. There's no way to judge a synthesized fanfare
 * from the code, so /lyd plays them side by side and this is the one line that changes
 * once a favourite is picked.
 */
const WIN_FANFARE: FanfareVariant = 4;

/** Match won. See WIN_FANFARE — /lyd is where these get compared. */
export function playFanfare() {
  playFanfareVariant(WIN_FANFARE);
}

/**
 * The hit the winning dart makes: the deepest, longest boom the synth can produce. Fired as
 * the board slams into frame in WinDive, and its tail is still ringing through the dive into
 * the bull — playFanfare then lands on the winner screen itself, so the two arrive as an
 * impact followed by an announcement rather than one pile of sound.
 *
 * The fanfare alone is brass, all upper register: it announces a win but you don't feel it.
 * This is the part you feel. They don't fight when they do overlap — the boom owns everything
 * under about 200Hz, the fanfare everything above.
 *
 * tailScale past the level scale for the same reason boomForStreak does it — the win should
 * ring longer than any single dart ever can (see BoomParams.tailScale).
 */
export function playWinBoom() {
  playBoom({ darkness: 5, volume: 5, grit: 4, punch: 5, length: 5, tailScale: 2.4 });
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

    if (variant === 4) {
      // Dark. Not a brighter trumpet call but a different instrument entirely: low horns
      // swelling into a held minor chord, two octaves under the others and left to ring on the
      // reverb. The minor third is what stops it sounding triumphant-cheerful — this is meant
      // to land like a verdict rather than a party horn.
      brassNote(ctx, buses, C2, t, 2.6, 0.22);
      brassNote(ctx, buses, C3, t + 0.05, 2.5, 0.18);
      brassNote(ctx, buses, G2, t + 0.3, 2.2, 0.15);
      brassNote(ctx, buses, Eb3, t + 0.55, 2.0, 0.14);
      brassNote(ctx, buses, G3, t + 0.8, 1.8, 0.12);
      brassNote(ctx, buses, Bb3, t + 1.05, 1.6, 0.1);
      // One voice up top so the whole thing isn't only rumble — still inside the minor chord.
      brassNote(ctx, buses, Eb4, t + 1.3, 1.5, 0.08);
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
  // A deep boom whose tail rings on longer with each dart in the streak — see boomForStreak.
  // This replaced the earlier two-note "dunk-pling" outright; playPerfectRoundVariant is
  // still exported so /lyd can put the old brass cues next to the new ones.
  playBoom(boomForStreak(streak));
}

export type PerfectRoundVariant = 1 | 2;

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
 * and pinned down exactly ("boom 4-3-2") instead of being re-guessed from a description.
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
    const k = amount * 60;
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
  /** 1 = half-dark, 5 = very dark. Moves the pitch range down. */
  darkness: number;
  /** 1 = restrained, 5 = heavy. */
  volume: number;
  /** 1 = clean tone, 5 = lots of attack grit. Noise transient plus saturation. */
  grit: number;
  /** 1 = soft swell, 5 = hard slam. A fast downward pitch click on the attack — this is
   *  what "punch" actually is on a kick drum, far more than raw level. */
  punch: number;
  /** 1 = very short, 5 = long tail. Kept separate from darkness so a hit can be short AND
   *  deep — the first dart wants exactly that. */
  length: number;
  /**
   * Multiplies the tail beyond what `length` can express. The level scale clamps at 5, and
   * the third dart of a streak already sits there — a full turn needs to ring on longer than
   * the sliders on /lyd can ask for, so it reaches past them rather than rescaling everything
   * below it. Defaults to 1, so nothing that doesn't set it changes.
   */
  tailScale?: number;
};

/** Picked by ear on /lyd: everything at max except the tail, which is what grows per dart. */
export const BOOM_DEFAULT: BoomParams = { darkness: 5, volume: 5, grit: 5, punch: 5, length: 3 };

/**
 * A deep impact. Three stacked layers: a fast pitch-click for punch, a swept body for
 * weight, and a noise transient for the crack. The pitch drop is what the ear reads as
 * weight — raw level alone just sounds loud, not heavy.
 */
export function playBoom(params: BoomParams = BOOM_DEFAULT) {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buses = getBuses(ctx);
    if (!buses) return;
    const t = ctx.currentTime + 0.02;

    const bodyStart = lerpLevel(params.darkness, 165, 62);
    const bodyEnd = lerpLevel(params.darkness, 62, 24);
    const duration = lerpLevel(params.length, 0.32, 2.2) * (params.tailScale ?? 1);
    const peak = lerpLevel(params.volume, 0.25, 1.0);
    const gritAmount = (clampLevel(params.grit) - 1) / 4;
    const punchAmount = (clampLevel(params.punch) - 1) / 4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.006);
    // A quick initial drop before the long tail — the shape of a struck drum rather than
    // a fading tone, and a big part of why it reads as an impact.
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.55), t + duration * 0.18);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    env.connect(buses.master);
    // Low end gets only a little reverb — more than that turns to mud.
    const send = ctx.createGain();
    send.gain.value = 0.18;
    env.connect(send);
    send.connect(buses.reverb);

    const saturation = makeSaturation(ctx, gritAmount * 0.5 + punchAmount * 0.35);
    if (saturation) saturation.connect(env);
    const bodyInput: AudioNode = saturation ?? env;

    // Body — the weight.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(bodyStart, t);
    osc.frequency.exponentialRampToValueAtTime(bodyEnd, t + duration * 0.45);
    osc.connect(bodyInput);
    osc.start(t);
    osc.stop(t + duration + 0.05);

    // Punch — a very fast sweep from well above the body down into it, gone in ~50ms.
    if (punchAmount > 0) {
      const click = ctx.createOscillator();
      click.type = "sine";
      const clickStart = bodyStart * lerpLevel(params.punch, 1.5, 6);
      click.frequency.setValueAtTime(clickStart, t);
      click.frequency.exponentialRampToValueAtTime(bodyStart, t + lerpLevel(params.punch, 0.05, 0.028));
      const clickEnv = ctx.createGain();
      clickEnv.gain.setValueAtTime(peak * 0.9 * punchAmount, t);
      clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + lerpLevel(params.punch, 0.06, 0.11));
      click.connect(clickEnv);
      clickEnv.connect(bodyInput);
      click.start(t);
      click.stop(t + 0.2);
    }

    // An octave up, quiet — insurance for speakers that cannot do the fundamental.
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(bodyStart * 2, t);
    harm.frequency.exponentialRampToValueAtTime(bodyEnd * 2, t + duration * 0.4);
    const harmEnv = ctx.createGain();
    harmEnv.gain.setValueAtTime(0.0001, t);
    harmEnv.gain.linearRampToValueAtTime(peak * 0.3, t + 0.008);
    harmEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.45);
    harm.connect(harmEnv);
    harmEnv.connect(buses.master);
    harm.start(t);
    harm.stop(t + duration);

    // A short knock in the range a phone speaker can actually move air at. At darkness 5 the
    // body sweeps 62 Hz down to 24 Hz and the octave above it 124 Hz to 48 Hz — a phone
    // reproduces essentially nothing below ~300 Hz, so on the device this is played on, all
    // of the boom's tonal weight is inaudible and only the noise transient survives. This
    // layer is what carries the hit there. It sits well below the body in level, so on a
    // real speaker it reads as part of the attack rather than as a separate tone.
    const knock = ctx.createOscillator();
    knock.type = "triangle";
    knock.frequency.setValueAtTime(420, t);
    knock.frequency.exponentialRampToValueAtTime(190, t + 0.07);
    const knockEnv = ctx.createGain();
    knockEnv.gain.setValueAtTime(0.0001, t);
    knockEnv.gain.linearRampToValueAtTime(peak * 0.32, t + 0.006);
    knockEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    knock.connect(knockEnv);
    knockEnv.connect(buses.master);
    knockEnv.connect(buses.reverb);
    knock.start(t);
    knock.stop(t + 0.25);

    const noise = gritAmount > 0 ? getNoise(ctx) : null;
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = lerpLevel(params.grit, 600, 3200);
      const nEnv = ctx.createGain();
      nEnv.gain.setValueAtTime(peak * 0.7 * gritAmount, t);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, t + lerpLevel(params.grit, 0.05, 0.2));
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

/**
 * The boom as it escalates across a turn. Only the tail grows — dart 1 short, then longer
 * for 2 and 3 — while darkness, volume, punch and grit stay where they are, so the three
 * read as the same slam ringing on longer rather than as three different sounds.
 */
export function boomForStreak(streak: 1 | 2 | 3, base: BoomParams = BOOM_DEFAULT): BoomParams {
  return {
    ...base,
    length: Math.min(5, base.length + (streak - 1)),
    // Dart three is where the tail runs out of scale to grow on — see tailScale.
    tailScale: streak === 3 ? 1.55 : 1,
  };
}

/**
 * One clap. Applause is the part of a crowd that synthesizes convincingly — a clap really is
 * just a short filtered noise transient — and a bed of them is what makes the whole thing
 * read as people rather than as wind.
 */
function clap(ctx: AudioContext, buses: Buses, noise: AudioBuffer, at: number, peak: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.85 + Math.random() * 0.5;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100 + Math.random() * 1800;
  bp.Q.value = 0.8 + Math.random();

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 700;

  const env = ctx.createGain();
  const decay = 0.028 + Math.random() * 0.05;
  env.gain.setValueAtTime(peak * (0.5 + Math.random() * 0.8), at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);

  src.connect(bp);
  bp.connect(hp);
  hp.connect(env);
  env.connect(buses.master);
  env.connect(buses.reverb);
  src.start(at);
  src.stop(at + decay + 0.03);
}

/**
 * One shouting voice. Bandpassed noise reads as wind, not as a person — what makes a voice
 * a voice is a pitched, harmonic-rich source filtered by vowel formants. A sawtooth through
 * three resonant bandpasses at roughly "aah" formant frequencies is the cheap standing-in
 * version of exactly that, and it's the difference between a crowd and a hiss.
 */
function shout(ctx: AudioContext, buses: Buses, at: number, duration: number, pitch: number, peak: number) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  // A shout swoops: up into it, then falling away.
  osc.frequency.setValueAtTime(pitch * 0.85, at);
  osc.frequency.linearRampToValueAtTime(pitch * 1.08, at + duration * 0.25);
  osc.frequency.linearRampToValueAtTime(pitch * 0.8, at + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(peak, at + 0.06 + Math.random() * 0.06);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  env.connect(buses.master);
  env.connect(buses.reverb);

  // "aah"-ish formants, jittered per voice so a crowd isn't all the same mouth.
  const formants: [number, number, number][] = [
    [700 + Math.random() * 180, 9, 1],
    [1150 + Math.random() * 350, 11, 0.55],
    [2500 + Math.random() * 500, 13, 0.25],
  ];
  for (const [freq, q, gain] of formants) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(bp);
    bp.connect(g);
    g.connect(env);
  }

  osc.start(at);
  osc.stop(at + duration + 0.05);
}

export type CrowdParams = {
  /** 1 = bright and thin, 5 = dark and muffled. */
  darkness: number;
  /** 1 = scattered, 5 = the whole room. */
  volume: number;
  /** 1 = a few people, 5 = a packed crowd. Drives clap and voice counts, and the length. */
  density: number;
};

export const CROWD_DEFAULT: CrowdParams = { darkness: 3, volume: 3, density: 3 };

/**
 * Crowd cheer, built from what a crowd actually consists of rather than from generic noise:
 * a dense bed of individual claps, a handful of pitched shouting voices with vowel formants,
 * and a quiet noise layer underneath as room tone. The earlier version was only that last
 * layer, which is why it read as wind rather than as people.
 *
 * Honest limit: this lands somewhere near "crowd" but a real recording would be
 * unmistakable, and one is a ~50KB file away if this still isn't convincing.
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

    const peak = lerpLevel(params.volume, 0.1, 0.75);
    const duration = lerpLevel(params.density, 1.0, 3.2);
    const swell = lerpLevel(params.density, 0.12, 0.35);
    const dark = (clampLevel(params.darkness) - 1) / 4;

    // 1. Applause — the main body of the sound.
    const clapCount = Math.round(lerpLevel(params.density, 14, 130));
    for (let i = 0; i < clapCount; i++) {
      // Weighted toward the start so the crowd erupts and then thins out.
      const progress = Math.pow(Math.random(), 0.75);
      const at = t + swell * 0.3 + progress * duration * 0.92;
      clap(ctx, buses, noise, at, peak * 0.42 * (1 - dark * 0.35));
    }

    // 2. Voices over the top.
    const voices = Math.round(lerpLevel(params.density, 2, 12));
    for (let i = 0; i < voices; i++) {
      const at = t + swell * 0.4 + Math.random() * duration * 0.7;
      const len = 0.35 + Math.random() * 0.6;
      // A spread of adult voices, higher ones cut through more.
      const pitch = 115 + Math.random() * 145;
      shout(ctx, buses, at, len, pitch, peak * (0.1 + Math.random() * 0.12));
    }

    // 3. Room tone underneath — quiet, just enough to glue the transients together.
    const bed = ctx.createBufferSource();
    bed.buffer = noise;
    bed.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = lerpLevel(params.darkness, 1100, 650);
    band.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lerpLevel(params.darkness, 3400, 1100);
    const bedEnv = ctx.createGain();
    bedEnv.gain.setValueAtTime(0.0001, t);
    bedEnv.gain.linearRampToValueAtTime(peak * 0.3, t + swell);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const at = t + swell + ((duration - swell) * i) / (steps + 1);
      bedEnv.gain.linearRampToValueAtTime(peak * 0.3 * (0.55 + Math.random() * 0.45), at);
    }
    bedEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    bed.connect(band);
    band.connect(lp);
    lp.connect(bedEnv);
    bedEnv.connect(buses.master);
    bedEnv.connect(buses.reverb);
    bed.start(t);
    bed.stop(t + duration + 0.1);
  } catch {
    // Never let a synth glitch break a turn.
  }
}

/** The crowd as it escalates across a turn — louder and denser per hit, same character. */
export function crowdForStreak(streak: 1 | 2 | 3, base: CrowdParams = CROWD_DEFAULT): CrowdParams {
  return {
    darkness: base.darkness,
    volume: Math.min(5, base.volume - 2 + streak),
    density: Math.min(5, base.density - 2 + streak),
  };
}
