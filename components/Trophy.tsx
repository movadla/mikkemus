"use client";

import { useEffect, useRef } from "react";

const COLOURS = ["#d9ae4f", "#f0d080", "#34c3d2", "#7be0ea", "#e25a45", "#f4f0e7"];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

type Piece = { x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; s: number };

/**
 * The trophy on the winner screen: it rises with a bounce and turns slowly while two beams sweep
 * behind it, and — when `cannons` is on — confetti is shot up from the two bottom corners. A team
 * celebrates with its own shirts instead (ShirtRain), so the cannons are left off for it and the
 * trophy comes alone. Full party only (lib/fxLevel.ts); it stands still under "reduce motion".
 */
export function Trophy({ cannons = true }: { cannons?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = cv.current;
    if (!cannons || !el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    el.width = w * dpr;
    el.height = h * dpr;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let parts: Piece[] = [];
    const fire = (side: -1 | 1) => {
      for (let i = 0; i < 80; i++) {
        const a = (side < 0 ? -1.15 : -2.0) + rnd(-0.35, 0.35), sp = rnd(9, 18);
        parts.push({ x: side < 0 ? 8 : w - 8, y: h - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(0, 6), vr: rnd(-0.25, 0.25), c: COLOURS[i % COLOURS.length], s: rnd(5, 10) });
      }
    };
    let stop = false;
    const timers = [setTimeout(() => { fire(-1); fire(1); }, 900), setTimeout(() => { fire(-1); fire(1); }, 1500)];
    const frame = () => {
      if (stop) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.24;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      parts = parts.filter((p) => p.y < h + 20);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return () => {
      stop = true;
      timers.forEach(clearTimeout);
    };
  }, [cannons]);

  return (
    <div aria-hidden className="relative mx-auto pointer-events-none" style={{ width: "100%", maxWidth: 260, height: 200, overflow: "hidden" }}>
      <span className="trophy-beam trophy-beam-a" />
      <span className="trophy-beam trophy-beam-b" />
      <div className="trophy-rise absolute left-1/2" style={{ width: 130, marginLeft: -65, bottom: 6, perspective: 700 }}>
        <svg viewBox="0 0 200 260" className="trophy-turn" style={{ width: "100%", display: "block", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.5))" }}>
          <defs>
            <linearGradient id="trophy-gold" x1="0" x2="1">
              <stop offset="0" stopColor="#8e6a1f" />
              <stop offset="0.35" stopColor="#f1d98a" />
              <stop offset="0.55" stopColor="#d9ae4f" />
              <stop offset="1" stopColor="#7a5815" />
            </linearGradient>
          </defs>
          <path d="M45 30h110v30c0 38-22 64-55 70-33-6-55-32-55-70z" fill="url(#trophy-gold)" />
          <path d="M45 40H18c0 34 14 52 40 58M155 40h27c0 34-14 52-40 58" fill="none" stroke="url(#trophy-gold)" strokeWidth="10" strokeLinecap="round" />
          <rect x="90" y="128" width="20" height="46" fill="url(#trophy-gold)" />
          <path d="M62 174h76l8 22H54z" fill="url(#trophy-gold)" />
          <rect x="48" y="196" width="104" height="38" rx="4" fill="#2a1d08" />
          <rect x="48" y="196" width="104" height="6" fill="url(#trophy-gold)" />
          <circle cx="100" cy="84" r="20" fill="#f6e5a2" opacity="0.55" />
          <path d="M60 40c0 26 8 48 26 58" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      {cannons && <canvas ref={cv} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 40 }} />}
    </div>
  );
}
