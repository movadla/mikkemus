"use client";

import { useEffect, useRef } from "react";

/**
 * The big screen's background in a two-sided match: a liquid border between the sides that sits where
 * the win chance puts it, gold on the left (the first side) and teal on the right. Every turn moves
 * the chance, and a big move sends big waves along the border. It is only a tint behind the board,
 * drawn on a canvas that never takes a tap, and it stands still under "reduce motion".
 */
export function MomentumWave({ chance }: { chance: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Where the border is heading, read by the animation loop without restarting it.
  const target = useRef(chance);
  const kick = useRef(0);
  const last = useRef(chance);

  useEffect(() => {
    kick.current = Math.min(1, kick.current + Math.abs(chance - last.current) * 6);
    last.current = chance;
    target.current = Math.min(0.92, Math.max(0.08, chance));
  }, [chance]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      const r = cv.getBoundingClientRect();
      w = Math.max(10, r.width);
      h = Math.max(10, r.height);
      cv.width = w * dpr;
      cv.height = h * dpr;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let x = target.current, v = 0, phase = 0, raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      v += (target.current - x) * 0.04;
      v *= 0.9;
      x += v;
      phase += 0.05;
      kick.current *= 0.985;
      const A = still ? 0 : 5 + kick.current * 18;
      const bx = (y: number) => x * w + Math.sin(y * 0.045 + phase) * A + Math.sin(y * 0.11 - phase * 1.3) * A * 0.45;
      ctx.clearRect(0, 0, w, h);
      const left = ctx.createLinearGradient(0, 0, w, 0);
      left.addColorStop(0, "rgba(217, 174, 79,0.10)");
      left.addColorStop(1, "rgba(217, 174, 79,0.34)");
      ctx.fillStyle = left;
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(bx(0), 0);
      for (let y = 0; y <= h; y += 6) ctx.lineTo(bx(y), y);
      ctx.lineTo(w, h);
      ctx.closePath();
      const right = ctx.createLinearGradient(0, 0, w, 0);
      right.addColorStop(0, "rgba(52, 195, 210,0.34)");
      right.addColorStop(1, "rgba(52, 195, 210,0.10)");
      ctx.fillStyle = right;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx(0), 0);
      for (let y = 6; y <= h; y += 6) ctx.lineTo(bx(y), y);
      ctx.strokeStyle = "rgba(244,240,232,0.35)";
      ctx.lineWidth = 2 + kick.current * 3;
      ctx.stroke();
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" />;
}
