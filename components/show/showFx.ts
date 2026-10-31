import { getUiSound } from "@/lib/uiSound";
import type { FxLevel } from "@/lib/fxLevel";

const COLORS = ["#d9ae4f", "#f0d080", "#34c3d2", "#7be0ea", "#f4f0e7", "#f0725e"];

const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let audio: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio ??= new Ctor();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

/** A short roar from the stands (swelling noise) or a groan (a falling tone). Quiet like the other interface sounds: Party and up, and the setting. */
export function crowdSound(kind: "cheer" | "uff", level: FxLevel): void {
  if ((level !== "party" && level !== "full") || !getUiSound()) return;
  const a = ctx();
  if (!a) return;
  const t0 = a.currentTime;
  const gain = a.createGain();
  gain.connect(a.destination);
  if (kind === "cheer") {
    const len = Math.floor(a.sampleRate * 1.6);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const band = a.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1400;
    band.Q.value = 0.6;
    src.connect(band).connect(gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    src.start(t0);
    src.stop(t0 + 1.6);
  } else {
    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.6);
    const low = a.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 700;
    osc.connect(low).connect(gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    osc.start(t0);
    osc.stop(t0 + 0.7);
  }
}

/** A short shake of the whole page, through the Web Animations API so nothing is left behind. */
export function shakeScreen(): void {
  if (reduced()) return;
  document.body.animate(
    [{ transform: "translate(0,0)" }, { transform: "translate(-5px,3px)" }, { transform: "translate(4px,-3px)" }, { transform: "translate(-3px,-2px)" }, { transform: "translate(0,0)" }],
    { duration: 380, easing: "ease-out" },
  );
}

/** Confetti on a canvas for about 2.5 seconds; it clears itself and stops its loop. */
export function playConfetti(canvas: HTMLCanvasElement, count: number): void {
  if (reduced()) return;
  const g = canvas.getContext("2d");
  if (!g) return;
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const bits = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.4,
    y: h * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 11 - 3,
    s: 4 + Math.random() * 6,
    r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    g.clearRect(0, 0, w, h);
    if (t > 2600) return;
    g.globalAlpha = t > 1900 ? 1 - (t - 1900) / 700 : 1;
    for (const b of bits) {
      b.vy += 0.32;
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.99;
      b.r += b.vr;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.r);
      g.fillStyle = b.c;
      g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      g.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
