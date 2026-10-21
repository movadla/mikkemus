"use client";

import { useEffect, useRef } from "react";
import { subscribeFx, type FxEvent } from "@/lib/fxBus";
import { fxFlags, useFxLevel, type FxFlags } from "@/lib/fxLevel";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const GOLD = "#e6bd57";
const esc = (t: string) => t.replace(/[<>&"]/g, "");

const DART_SVG = `<svg viewBox="0 0 120 26" width="120" height="26"><path d="M0 13 L22 6 L22 20Z" fill="#ff5e6c"/><path d="M0 13 L16 2 L30 11Z" fill="#ff8a96" opacity=".85"/><path d="M0 13 L16 24 L30 15Z" fill="#c8102e" opacity=".9"/><rect x="26" y="9" width="46" height="8" rx="3" fill="#cfd5dc"/><rect x="34" y="9" width="3" height="8" fill="#8d96a0"/><rect x="44" y="9" width="3" height="8" fill="#8d96a0"/><rect x="54" y="9" width="3" height="8" fill="#8d96a0"/><path d="M72 11 L116 12.4 L116 13.6 L72 15Z" fill="#e8ecf0"/></svg>`;
const CROWN_SVG = `<svg viewBox="0 0 32 24" width="40" height="30"><path d="M2 20 L5 6 L11 13 L16 3 L21 13 L27 6 L30 20Z" fill="${GOLD}" stroke="#fff3c4" stroke-width="1.2"/></svg>`;

/**
 * The stage the match's effects play on: one fixed layer over the screen that never takes a tap.
 * The game announces what happened (lib/fxBus.ts) and each effect here is drawn with a little
 * code — no pictures, no video — so it costs nothing to ship and runs on a phone. Which of them
 * play is the chosen level's call (lib/fxLevel.ts); "reduce motion" plays none.
 *
 * `matchDart` is state rather than an event: while it is true the screen edge pulses red.
 */
export function FxStage({ matchDart = false }: { matchDart?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const level = useFxLevel();
  const flags = useRef<FxFlags>(fxFlags(level));
  useEffect(() => {
    flags.current = fxFlags(level);
  }, [level]);

  useEffect(() => {
    const layer = host.current;
    if (!layer || typeof window === "undefined") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const L: HTMLElement = layer;

    /** An element on the layer that removes itself when `anim` ends. */
    const add = (el: HTMLElement, anim?: Animation) => {
      L.appendChild(el);
      anim?.finished.then(() => el.remove()).catch(() => el.remove());
      return el;
    };
    const box = (css: string, html = "") => {
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;pointer-events:none;${css}`;
      el.innerHTML = html;
      return el;
    };
    /** The cell a dart or a closed row belongs to: the one named, or the active player's active row. */
    const cellFor = (step?: string, player?: string): Element | null => {
      if (step && player) return document.querySelector(`[data-step="${CSS.escape(step)}"][data-player="${CSS.escape(player)}"]`);
      return document.querySelector(".cell-tile--active") ?? document.querySelector(".cell-tile");
    };

    // A dart that does not score: it flies in, bounces off the cell and falls away, with «BOM».
    function miss() {
      const cell = cellFor();
      if (!cell) return;
      const r = cell.getBoundingClientRect();
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const sx = innerWidth * 0.9, sy = innerHeight + 40;
      const ang = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
      const el = box("left:0;top:0;width:120px;height:26px;filter:drop-shadow(0 4px 4px rgba(0,0,0,.5));transform-origin:100% 50%", DART_SVG);
      L.appendChild(el);
      el.animate(
        [
          { transform: `translate(${sx - 120}px, ${sy - 13}px) rotate(${ang}deg) scale(1.6)`, opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { transform: `translate(${tx - 120}px, ${ty - 13}px) rotate(${ang}deg) scale(.36)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${tx - 90}px, ${ty - 80}px) rotate(${ang + 70}deg) scale(.42)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${tx - 150}px, ${ty + 260}px) rotate(${ang + 280}deg) scale(.6)`, opacity: 0 },
        ],
        { duration: 1000, easing: "cubic-bezier(.3,0,.8,.6)", fill: "forwards" },
      ).finished.then(() => el.remove()).catch(() => el.remove());
      const t = box(`left:${tx - 40}px;top:${ty - 44}px;width:80px;text-align:center;font:800 1.3rem var(--font-display, Georgia),serif;letter-spacing:.1em;color:#e25a45;text-shadow:0 2px 6px rgba(0,0,0,.7)`, "BOM");
      add(t, t.animate([{ transform: "scale(2)", opacity: 0 }, { transform: "scale(1)", opacity: 1, offset: 0.3 }, { transform: "translateY(-10px)", opacity: 0 }], { duration: 1100, delay: 350 }));
    }

    // A shockwave and a word slammed in: «TRIPPEL 20», or «MATCHDART» and «OUT» in red.
    function slam(label: string, color: string, glow: string) {
      const cv = document.createElement("canvas");
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      L.appendChild(cv);
      const ctx = cv.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = innerWidth, h = innerHeight, cx = w / 2, cy = h * 0.38, t0 = performance.now();
      const step = (t: number) => {
        const e = (t - t0) / 1000; ctx.clearRect(0, 0, w, h);
        const f = Math.max(0, 1 - e * 3.4);
        if (f > 0) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7); g.addColorStop(0, `rgba(${glow},${0.55 * f})`); g.addColorStop(1, `rgba(${glow},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
        let alive = f > 0;
        for (const d of [0, 0.09, 0.18]) {
          const k = e - d; if (k < 0) { alive = true; continue; }
          const a = Math.max(0, 1 - k * 1.7); if (a <= 0) continue; alive = true;
          ctx.strokeStyle = `rgba(${glow},${a})`; ctx.lineWidth = 7 * a + 1; ctx.beginPath(); ctx.arc(cx, cy, k * Math.max(w, h) * 0.9, 0, 6.283); ctx.stroke();
        }
        if (alive) requestAnimationFrame(step); else cv.remove();
      };
      requestAnimationFrame(step);
      const wrap = box(`left:0;right:0;top:${cy - 34}px;display:grid;place-items:center;font:800 3rem var(--font-display, Georgia),serif;line-height:1;letter-spacing:.02em`);
      const t = esc(label);
      wrap.innerHTML = `<div style="position:relative"><span style="position:absolute;inset:0;color:#ff3b5c;mix-blend-mode:screen">${t}</span><span style="position:absolute;inset:0;color:#26d0ff;mix-blend-mode:screen">${t}</span><span style="position:relative;color:#fff;text-shadow:0 0 18px ${color}">${t}</span></div>`;
      const [c1, c2, c0] = Array.from(wrap.firstElementChild!.children) as HTMLElement[];
      wrap.animate([{ transform: "scale(3)", opacity: 0 }, { transform: "scale(.94)", opacity: 1, offset: 0.4 }, { transform: "scale(1)", opacity: 1, offset: 0.75 }, { transform: "scale(1)", opacity: 0 }], { duration: 1300, easing: "cubic-bezier(.2,.9,.3,1.1)" }).finished.then(() => wrap.remove()).catch(() => wrap.remove());
      c1.animate([{ transform: "translate(-14px,0)" }, { transform: "translate(-2px,0)" }], { duration: 700, fill: "forwards", easing: "ease-out" });
      c2.animate([{ transform: "translate(14px,0)" }, { transform: "translate(2px,0)" }], { duration: 700, fill: "forwards", easing: "ease-out" });
      c0.animate([{ color: "#fff" }, { color }], { duration: 700, fill: "forwards" });
      L.appendChild(wrap);
    }

    // The hardest hits, drawn as a comic panel: a hold, a white flash, speed lines from the middle, red
    // halftone, a hard shake of the whole screen and the word slammed in. For a bull, a triple 20 and a
    // match dart only — everything else keeps the ordinary slam.
    function manga(word: string, sub: string) {
      const h = innerHeight;
      const size = word.length > 8 ? "clamp(40px,13vw,92px)" : "clamp(64px,22vw,130px)";
      const root = box("inset:0;overflow:hidden");
      const fade = "-webkit-mask:radial-gradient(circle,transparent 24%,#000 58%);mask:radial-gradient(circle,transparent 24%,#000 58%)";
      const lines = box(`inset:-40%;opacity:0;background:repeating-conic-gradient(from 0deg,#f4f0e7 0 1.1deg,transparent 1.1deg 4.6deg);${fade}`);
      const dots = box(`inset:0;opacity:0;background:radial-gradient(circle,rgba(196,67,46,.9) 24%,transparent 26%) 0 0/11px 11px;${fade.replace("24%", "20%").replace("58%", "90%")}`);
      const flash = box("inset:0;background:#fff;opacity:0");
      const text = box(`left:0;right:0;top:${Math.round(h * 0.3)}px;text-align:center;font:900 ${size}/1 var(--font-display, Georgia),serif;color:#f0d080;-webkit-text-stroke:4px #0b0f0b;paint-order:stroke fill;text-shadow:6px 6px 0 #e25a45;opacity:0`, esc(word));
      const caption = box(`left:0;right:0;top:${Math.round(h * 0.3) + 150}px;text-align:center;font:600 .8rem var(--font-sans, system-ui),sans-serif;letter-spacing:.2em;color:#f4f0e7;text-shadow:0 2px 6px #000;opacity:0`, esc(sub));
      [dots, lines, text, caption, flash].forEach((el) => root.appendChild(el));
      add(root, root.animate([{ opacity: 1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], { duration: 1750 }));
      flash.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0 }], { duration: 200, delay: 140 });
      lines.animate([{ opacity: 1, transform: "scale(.35) rotate(0deg)" }, { opacity: 1, transform: "scale(1.5) rotate(8deg)" }], { duration: 1200, delay: 140, easing: "cubic-bezier(.1,.8,.2,1)", fill: "both" });
      dots.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0.85, offset: 0.75 }, { opacity: 0 }], { duration: 1500, delay: 140, fill: "both" });
      text.animate([{ opacity: 0, transform: "scale(3.4) rotate(-14deg)" }, { opacity: 1, transform: "scale(.9) rotate(-6deg)", offset: 0.35 }, { opacity: 1, transform: "scale(1) rotate(-6deg)" }], { duration: 520, delay: 140, easing: "cubic-bezier(.2,.9,.2,1)", fill: "both" });
      caption.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 500, fill: "both" });
      document.querySelector(".game-root")?.animate(
        [{ transform: "translate(0,0)" }, { transform: "translate(14px,-10px)" }, { transform: "translate(-12px,9px)" }, { transform: "translate(9px,6px)" }, { transform: "translate(-6px,-4px)" }, { transform: "translate(3px,2px)" }, { transform: "none" }],
        { duration: 520, delay: 140 },
      );
    }

    // Three counting darts: the three light up, a glint crosses.
    function perfect(run: number) {
      const wrap = box(`left:0;right:0;top:20%;display:grid;justify-items:center;gap:10px`);
      const tiles = [1, 2, 3].map((n) => `<div style="width:50px;height:50px;border-radius:12px;display:grid;place-items:center;font:800 1.3rem var(--font-display, Georgia),serif;background:linear-gradient(160deg,#f0cb6a,#c59a2e);color:#2b2000;box-shadow:0 0 22px rgba(230,189,87,.7)">${n}</div>`).join("");
      wrap.innerHTML = `<div style="position:relative;display:flex;gap:12px;padding:6px;overflow:hidden">${tiles}<div class="sw" style="position:absolute;top:0;bottom:0;width:40%;left:-50%;background:linear-gradient(100deg,transparent,rgba(255,240,190,.8),transparent);transform:skewX(-18deg)"></div></div><div class="tx" style="font:800 1.4rem var(--font-display, Georgia),serif;color:${GOLD};text-shadow:0 2px 8px rgba(0,0,0,.7)">${run >= 6 ? `${run} PILER PÅ RAD` : "TRE TELLENDE"}</div>`;
      const kids = Array.from(wrap.firstElementChild!.children) as HTMLElement[];
      kids.slice(0, 3).forEach((t, i) => t.animate([{ transform: "scale(.5) rotate(-8deg)", opacity: 0 }, { transform: "scale(1.25) rotate(3deg)", opacity: 1, offset: 0.6 }, { transform: "scale(1)", opacity: 1 }], { duration: 340, delay: i * 140, easing: "ease-out", fill: "backwards" }));
      kids[3].animate([{ left: "-50%" }, { left: "130%" }], { duration: 620, delay: 520, easing: "ease-in-out" });
      (wrap.lastElementChild as HTMLElement).animate([{ letterSpacing: ".5em", opacity: 0 }, { letterSpacing: ".04em", opacity: 1 }], { duration: 480, delay: 420, easing: "cubic-bezier(.2,.9,.3,1.1)", fill: "backwards" });
      add(wrap, wrap.animate([{ opacity: 1 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], { duration: 1900 }));
    }

    // A row closed: gold outline, a glint and dust on every cell of the row.
    function rowClosed(step: string, player: string) {
      const cells = Array.from(document.querySelectorAll<HTMLElement>(`[data-step="${CSS.escape(step)}"][data-player="${CSS.escape(player)}"]`));
      cells.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.width === 0) return;
        c.animate([{ boxShadow: `0 0 0 2px ${GOLD}, 0 0 24px rgba(230,189,87,.6)` }, { boxShadow: "0 0 0 0 rgba(230,189,87,0)" }], { duration: 900, delay: i * 60 });
        const clip = box(`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;border-radius:8px`);
        const sh = box("top:0;bottom:0;width:40%;left:-50%;background:linear-gradient(100deg,transparent,rgba(255,240,190,.75),transparent);transform:skewX(-18deg)");
        clip.appendChild(sh);
        for (let k = 0; k < 6; k++) {
          const d = box(`left:${rnd(r.width * 0.15, r.width * 0.85)}px;top:${rnd(r.height * 0.15, r.height * 0.85)}px;width:5px;height:5px;border-radius:50%;background:${GOLD}`);
          clip.appendChild(d);
          d.animate([{ transform: "scale(1)", opacity: 1 }, { transform: `translate(${rnd(-22, 22)}px,${rnd(-22, 22)}px) scale(0)`, opacity: 0 }], { duration: 560, delay: i * 60 });
        }
        sh.animate([{ left: "-50%" }, { left: "130%" }], { duration: 620, delay: 100 + i * 80, easing: "ease-in-out" });
        add(clip, clip.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 900 + i * 80 }));
      });
    }

    // A new thrower: two spotlights from the top corners swing onto the column of whoever is up.
    function walkOn(player?: string) {
      // The column of the side that is up NEXT, found by name: the highlight has not moved yet when this plays.
      const head = (player && document.querySelector(`[data-col-player="${CSS.escape(player)}"]`)) || document.querySelector("[data-col-active]");
      const r = head?.getBoundingClientRect();
      const tx = r ? r.left + r.width / 2 : innerWidth / 2;
      const ty = r ? r.top + r.height : innerHeight * 0.4;
      const half = Math.max(46, Math.min(110, (r?.width ?? 120) * 0.7));
      const svg = box("inset:0;width:100%;height:100%;mix-blend-mode:screen;filter:blur(3px)");
      svg.innerHTML = `<svg width="${innerWidth}" height="${innerHeight}" style="position:absolute;left:0;top:0"><defs>${[0, 1]
        .map((i) => `<linearGradient id="spot${i}" gradientUnits="userSpaceOnUse" x1="${i ? innerWidth : 0}" y1="0" x2="${tx}" y2="${ty}"><stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".42"/></linearGradient>`)
        .join("")}</defs><polygon points="${-20},${-20} ${-20},${20} ${tx - half},${ty} ${tx + half},${ty}" fill="url(#spot0)"/><polygon points="${innerWidth + 20},${-20} ${innerWidth + 20},${20} ${tx + half},${ty} ${tx - half},${ty}" fill="url(#spot1)"/><ellipse cx="${tx}" cy="${ty}" rx="${half}" ry="${half * 0.28}" fill="rgba(255,244,205,.5)"/></svg>`;
      add(svg, svg.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1800, easing: "ease-in-out" }));
      [0, 1].forEach((i) => {
        const fog = box(`${i ? "right" : "left"}:-10%;top:${Math.max(0, ty - 40)}px;width:70%;height:90px;border-radius:50%;background:radial-gradient(closest-side,rgba(180,210,200,.26),transparent);filter:blur(10px)`);
        add(fog, fog.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "translateY(-6px)", offset: 0.4 }, { opacity: 0, transform: "translateY(-24px)" }], { duration: 1900, delay: i * 120, easing: "ease-out" }));
      });
    }

    // A new leader: a glint along the top and the crown.
    function lead(name: string) {
      const line = box("left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,transparent,rgba(255,236,170,.95),transparent)");
      add(line, line.animate([{ transform: "translateX(-100%)", opacity: 1 }, { transform: "translateX(100%)", opacity: 1 }], { duration: 700, easing: "ease-in-out" }));
      const wrap = box("left:0;right:0;top:calc(env(safe-area-inset-top, 0px) + 56px);display:grid;justify-items:center");
      wrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;background:${GOLD};color:#2b2000;font:700 .8rem var(--font-sans, system-ui),sans-serif;letter-spacing:.16em;text-transform:uppercase;box-shadow:0 8px 24px rgba(0,0,0,.45)"><span>Ny leder</span><b style="font:800 1.05rem var(--font-display, Georgia),serif;letter-spacing:.01em;text-transform:none">${esc(name)}</b></div>`;
      add(wrap, wrap.animate([{ transform: "translateY(-24px) scale(.6) rotate(-4deg)", opacity: 0 }, { transform: "translateY(0) scale(1.1) rotate(2deg)", opacity: 1, offset: 0.2 }, { transform: "none", opacity: 1, offset: 0.3 }, { transform: "none", opacity: 1, offset: 0.85 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 2400 }));
    }

    // A personal record: a gold banner, and a crown dropped onto the thrower's picture.
    function record(text: string) {
      const wrap = box("left:12px;right:12px;top:calc(env(safe-area-inset-top, 0px) + 56px);display:grid;justify-items:center");
      wrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:12px;background:linear-gradient(90deg,#e6bd57,#f3d98a);color:#2b2000;font:700 .9rem var(--font-sans, system-ui),sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)"><span style="letter-spacing:.14em;text-transform:uppercase;font-size:.72rem">Ny rekord</span><b style="font-weight:700">${esc(text)}</b></div>`;
      add(wrap, wrap.animate([{ transform: "translateY(-50px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1, offset: 0.14 }, { transform: "none", opacity: 1, offset: 0.88 }, { transform: "translateY(-14px)", opacity: 0 }], { duration: 3400, easing: "cubic-bezier(.2,.9,.3,1.1)" }));
      const av = document.querySelector(".thrower-avatar");
      const r = av?.getBoundingClientRect();
      if (r) {
        const crown = box(`left:${r.left + r.width / 2 - 20}px;top:${r.top - 24}px`, CROWN_SVG);
        add(crown, crown.animate([{ transform: "translateY(-80px) rotate(-30deg) scale(.5)", opacity: 0 }, { transform: "translateY(4px) rotate(6deg) scale(1.1)", opacity: 1, offset: 0.35 }, { transform: "none", opacity: 1, offset: 0.5 }, { transform: "none", opacity: 1, offset: 0.9 }, { transform: "translateY(-10px)", opacity: 0 }], { duration: 3400, easing: "ease-out" }));
      }
    }

    return subscribeFx((e: FxEvent) => {
      const f = flags.current;
      if (e.type === "ring" && f.ringSlam) {
        if (f.manga && e.label === "TRIPPEL 20") manga("TRIPPEL 20!", "TRE KRYSS PÅ EN PIL");
        else slam(e.label, GOLD, "255,236,170");
      } else if (e.type === "bull" && f.manga) manga("BULL!", "RETT I MIDTEN");
      else if (e.type === "matchdart" && f.matchDart) {
        // The same animation for both; only the word differs.
        const out = e.word === "OUT";
        if (f.manga) manga(out ? "OUT!" : "MATCHDART", out ? "TRE PILER ELLER FÆRRE" : "BULL TIL SLUTT");
        else slam(out ? "OUT" : "MATCHDART", "#ff5a4a", "224,74,58");
      }
      else if (e.type === "perfect" && f.perfectBurst) perfect(e.run);
      else if (e.type === "rowClosed" && f.rowShine) rowClosed(e.step, e.player);
      else if (e.type === "walkOn" && f.walkOn) walkOn(e.player);
      else if (e.type === "lead" && f.leadChange) lead(e.name);
      else if (e.type === "record" && f.recordBanner) record(e.text);
      else if (e.type === "miss" && f.missBounce) miss();
    });
  }, []);

  const showEdge = matchDart && fxFlags(level).matchDart;
  return (
    <>
      {showEdge && <div aria-hidden className="matchdart-edge" />}
      <div ref={host} aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45, overflow: "hidden" }} />
    </>
  );
}
