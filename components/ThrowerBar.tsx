"use client";

import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { useEffect, useRef } from "react";
import { TeamKit } from "./TeamKit";

export type Thrower = { name: string; photo?: string | null; isBot: boolean };

export type ThrowerTeam = {
  name: string;
  /** The team's own picture, if it has one — see PhotoButton on the team's page. */
  photo?: string | null;
  members: Thrower[];
  /** Index into `members` of whoever throws now. */
  activeIdx: number;
};

/** A kit colour at some opacity — the bar is tinted in the team's own colour when it is up. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function Avatar({ who, size, active = true, ring = false }: { who: Thrower; size: number; active?: boolean; ring?: boolean }) {
  const accent = avatarAccent(who.name);
  return (
    <span
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center ${ring ? "animate-thrower-ring" : ""}`}
      style={{
        width: size,
        height: size,
        background: "var(--color-cell)",
        border: `${active ? 3 : 1.5}px solid ${active ? "var(--color-teal)" : accent}`,
        opacity: active ? 1 : 0.6,
        color: accent,
        fontSize: size * 0.42,
        fontFamily: "var(--font-display)",
      }}
      aria-hidden
    >
      {who.isBot ? (
        "🤖"
      ) : who.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={who.photo} alt="" className="w-full h-full object-cover" />
      ) : (
        who.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Flames round the thrower's picture while a run of counting darts builds: orange from two in a
 * row, taller and hotter as it grows, blue-white from eleven. Drawn on a canvas behind the
 * picture and stopped the moment the run ends. Nothing for a phone set to reduced motion.
 */
function Flames({ run, size }: { run: number; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const level = useRef(run);
  useEffect(() => {
    level.current = run;
  }, [run]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = size * 2.4, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = box * dpr; cv.height = box * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number };
    let parts: P[] = [];
    let last = performance.now(), stop = false;
    const cx = box / 2, cy = box / 2 + size * 0.05;
    const step = (t: number) => {
      if (stop) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, box, box);
      const n = Math.min(15, level.current), heat = Math.min(1, n / 12);
      if (n >= 2) {
        const spawn = Math.round(n * 2.2 * dt * 60);
        for (let i = 0; i < spawn; i++) {
          const a = rnd(0, Math.PI * 2);
          parts.push({ x: cx + Math.cos(a) * size * 0.46, y: cy + Math.sin(a) * size * 0.4, vx: rnd(-8, 8), vy: -rnd(24, 44 + heat * 90) * (size / 52), life: 0, max: rnd(0.45, 0.8 + heat * 0.5), s: rnd(size * 0.1, size * (0.18 + heat * 0.2)) });
        }
      }
      parts = parts.filter((p) => (p.life += dt) < p.max);
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.x += p.vx * dt + Math.sin(p.life * 9 + p.x) * 10 * dt; p.y += p.vy * dt;
        const k = p.life / p.max, r = p.s * (1 - k * 0.8);
        const c = n >= 11 ? [150 + 80 * (1 - k), 200 + 40 * (1 - k), 255] : [255, 90 + 150 * (1 - k), 20 + 40 * (1 - k)];
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${0.55 * (1 - k)})`);
        g.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => {
      stop = true;
    };
  }, [size]);

  const box = size * 2.4;
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", left: -(box - size) / 2, top: -(box - size) / 2, width: box, height: box, pointerEvents: "none" }} />;
}

/**
 * Who is throwing right now — the one thing every player at the board needs to read at a glance.
 *
 * A large picture (or initial) in a pulsing teal ring, KASTER over the name, and for a team its
 * shirt, its picture and its name under that; the rest of the team stands to the right in the
 * order they come up, the next one marked. A thrower who stays on under the stand rule says so,
 * because otherwise "Per again" looks like a bug.
 *
 * Keyed on the turn by the caller, so it replays its entrance when the thrower changes — the
 * "new round" cue — and is quiet when `animate` is off.
 */
export function ThrowerBar({
  thrower,
  team,
  kit,
  stood,
  run = 0,
  fire = false,
  animate,
  compact = false,
  onPickMate,
}: {
  thrower: Thrower;
  team: ThrowerTeam | null;
  /** The team's shirt, drawn beside its name. */
  kit?: Kit | null;
  /** The thrower kept their place after three counting darts (the stand rule). */
  stood: boolean;
  /** Darts in a row that counted — shown from two up, so a lone hit is not announced. */
  run?: number;
  /** Flames round the picture while the run builds (Party and up). */
  fire?: boolean;
  animate: boolean;
  compact?: boolean;
  /** A tap on a teammate's picture: the caller asks whether they should throw now. */
  onPickMate?: (name: string) => void;
}) {
  // The rest of the team in the order they come up next, so the first of them is the next thrower.
  const mates = team ? team.members.map((_, i) => team.members[(team.activeIdx + 1 + i) % team.members.length]).slice(0, team.members.length - 1) : [];
  const photoSize = compact ? 44 : 72;
  const teamPhotoSize = compact ? 18 : 26;
  const kitBadge = compact ? 26 : 40;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`thrower-bar shadow-panel flex items-center rounded-xl ${animate ? "animate-thrower-in" : ""}`}
      style={{
        gap: compact ? "0.6rem" : "0.8rem",
        // A team's turn is in the team's colours: the bar washes from the kit's main colour, and
        // the left edge is the kit, not the app's teal.
        background: kit ? `linear-gradient(90deg, ${tint(kit.primary, 0.32)}, var(--color-surface) 65%)` : "var(--color-surface)",
        border: `1px solid ${kit ? tint(kit.primary, 0.6) : "var(--color-border)"}`,
        borderLeft: `6px solid ${kit ? kit.primary : "var(--color-teal)"}`,
        padding: compact ? "0.4rem 0.6rem" : "0.6rem 0.8rem",
      }}
    >
      <span className="thrower-avatar relative shrink-0" style={{ width: photoSize, height: photoSize }}>
        {fire && run >= 2 && <Flames run={run} size={photoSize} />}
        <Avatar who={thrower} size={photoSize} ring={animate} />
        {/* The shirt the thrower is playing in, worn on the picture — big enough to read across the room. */}
        {kit && (
          <span className="absolute" style={{ right: -kitBadge * 0.3, bottom: -kitBadge * 0.15 }} aria-hidden>
            <TeamKit kit={kit} size={kitBadge} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p style={{ color: "var(--color-teal)", fontSize: compact ? "0.62rem" : "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, lineHeight: 1.2 }}>
          {thrower.isBot ? "Kaster …" : "Kaster"}
        </p>
        <p
          className="truncate"
          style={{ color: "var(--color-cream)", fontFamily: "var(--font-display)", fontSize: compact ? "1.25rem" : "1.9rem", lineHeight: 1.05 }}
        >
          {thrower.name}
        </p>
        {team && (
          <p className="truncate flex items-center gap-1.5 mt-1" style={{ color: "var(--color-cream)", opacity: 0.85, fontSize: compact ? "0.72rem" : "0.85rem", fontWeight: 600 }}>
            {team.photo && (
              <span className="rounded-full overflow-hidden shrink-0" style={{ width: teamPhotoSize, height: teamPhotoSize, border: "1px solid var(--color-border)" }} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.photo} alt="" className="w-full h-full object-cover" />
              </span>
            )}
            <span className="truncate">{team.name}</span>
          </p>
        )}
        {run >= 2 && (
          <p className="tabular truncate whitespace-nowrap" style={{ color: "var(--color-gold-strong)", fontSize: compact ? "0.72rem" : "0.85rem", fontWeight: 700 }}>
            {compact ? `${run} på rad` : `${run} piler på rad`}
          </p>
        )}
        {stood && (
          <p className="truncate whitespace-nowrap" style={{ color: "var(--color-gold-strong)", fontSize: "0.72rem", fontWeight: 600 }}>{compact ? "Står igjen" : "Står – kaster igjen"}</p>
        )}
      </div>
      {mates.length > 0 && (
        <div className="flex items-end gap-2 shrink-0" aria-label={`Neste på laget: ${mates.map((m) => m.name).join(", ")}`}>
          {mates.map((m, i) => {
            const inner = (
              <>
                {!compact && (
                  <span style={{ color: i === 0 ? "var(--color-muted)" : "transparent", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 }}>
                    neste
                  </span>
                )}
                <Avatar who={m} size={compact ? 26 : 38} active={false} />
                {!compact && (
                  <span className="truncate w-full text-center" style={{ color: "var(--color-muted)", fontSize: "0.68rem" }}>
                    {m.name}
                  </span>
                )}
              </>
            );
            // A teammate's picture is a button: tap it to have them throw instead.
            return onPickMate ? (
              <button
                key={m.name}
                type="button"
                onClick={() => onPickMate(m.name)}
                aria-label={`La ${m.name} kaste`}
                className="tactile flex flex-col items-center justify-center rounded-lg"
                style={{ maxWidth: compact ? 44 : 60, minWidth: 44, minHeight: 44 }}
              >
                {inner}
              </button>
            ) : (
              <span key={m.name} className="flex flex-col items-center" style={{ maxWidth: compact ? 40 : 56 }}>
                {inner}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
