"use client";

import { useEffect, useRef } from "react";
import type { Kit } from "@/lib/teamKit";

const BODY = "M32 10 L16 16 L3 36 L18 45 L26 37 L26 93 L74 93 L74 37 L82 45 L97 36 L84 16 L68 10 L50 24 Z";
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

type Piece = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; flip: boolean; life: number; sway: number };

/**
 * The winning team's own shirt, thrown from the two corners and then raining down — instead of
 * generic confetti, so the celebration is the team's. `heavy` doubles it (Full party). Plays once
 * and stops; nothing at all when the phone asks for reduced motion.
 */
export function ShirtRain({ kit, heavy = false }: { kit: Kit; heavy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shirt = new Path2D(BODY);
    const parts: Piece[] = [];
    const mul = heavy ? 2 : 1;
    const burst = (x: number, ang: number) => {
      for (let i = 0; i < 30 * mul; i++) {
        const a = ang + rnd(-0.4, 0.4), v = rnd(380, 760);
        parts.push({ x, y: h + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, 6.28), vr: rnd(-6, 6), s: rnd(0.24, 0.44), flip: i % 3 === 0, life: 0, sway: rnd(0, 6.28) });
      }
    };
    burst(0, -Math.PI / 3);
    burst(w, (-Math.PI * 2) / 3);
    const t0 = performance.now();
    let last = t0, stop = false;
    const step = (t: number) => {
      if (stop) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const e = (t - t0) / 1000;
      if (e > 0.5 && e < 2.8 && Math.random() < dt * 36 * mul) {
        parts.push({ x: rnd(0, w), y: -30, vx: rnd(-30, 30), vy: rnd(40, 110), rot: rnd(0, 6.28), vr: rnd(-4, 4), s: rnd(0.22, 0.38), flip: Math.random() < 0.33, life: 0, sway: rnd(0, 6.28) });
      }
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.life += dt; p.vy += 760 * dt; p.vx *= 0.992; p.vy *= 0.992;
        p.x += (p.vx + Math.sin(p.life * 5 + p.sway) * 40) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const [main, edge] = p.flip ? [kit.secondary, kit.primary] : [kit.primary, kit.secondary];
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.scale(Math.cos(p.life * 4 + p.sway) * 0.5 + 0.85, 1); ctx.scale(p.s, p.s); ctx.translate(-50, -50);
        ctx.fillStyle = main; ctx.fill(shirt);
        ctx.lineWidth = 7; ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(32, 10); ctx.lineTo(50, 24); ctx.lineTo(68, 10); ctx.stroke();
        ctx.restore();
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].y > h + 80) parts.splice(i, 1);
      if (e < 2.9 || parts.length > 0) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => {
      stop = true;
    };
  }, [kit, heavy]);

  return <canvas ref={ref} aria-hidden style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 40 }} />;
}
