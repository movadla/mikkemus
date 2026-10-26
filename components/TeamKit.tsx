"use client";

import { useId } from "react";
import type { Kit } from "@/lib/teamKit";

/** A short-sleeved polo, the shape a darts shirt has — not a football jersey. */
const BODY = "M32 10 L16 16 L3 36 L18 45 L26 37 L26 93 L74 93 L74 37 L82 45 L97 36 L84 16 L68 10 L50 24 Z";

/**
 * A team's shirt, drawn as a dart shirt: a polo with a collar and button placket, and the panels
 * and slashes darts shirts have instead of a football club's hoops. See lib/teamKit.ts for how
 * the colours and pattern are chosen; this only paints them. No logos, no sponsors — those are
 * other people's trademarks. One place to swap if a real image ever replaces the drawing.
 */
export function TeamKit({ kit, size = 40, title, back = false, label, number }: { kit: Kit; size?: number; title?: string; /** The back of the shirt: no collar opening, and the name and number printed on it. */ back?: boolean; label?: string; number?: number | string }) {
  const clip = useId();
  const shade = useId();
  const { primary, secondary, trim, pattern } = kit;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, filter: size >= 60 ? "drop-shadow(0 6px 6px rgba(var(--shadow-rgb), 0.45))" : "drop-shadow(0 1px 1px rgba(var(--shadow-rgb), 0.55))" }}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
        {/* The light on the cloth: from the upper left, falling off towards the lower right. */}
        <linearGradient id={shade} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.24" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d={BODY} fill={primary} />
      <g clipPath={`url(#${clip})`} fill={secondary}>
        {pattern === "hoops" && (
          <>
            <rect x="0" y="40" width="100" height="9" />
            <rect x="0" y="58" width="100" height="9" />
            <rect x="0" y="76" width="100" height="9" />
          </>
        )}
        {pattern === "stripes" && (
          <>
            <rect x="26" y="0" width="8" height="100" />
            <rect x="42" y="0" width="8" height="100" />
            <rect x="58" y="0" width="8" height="100" />
            <rect x="74" y="0" width="8" height="100" />
          </>
        )}
        {pattern === "sash" && <polygon points="22,14 40,14 86,96 66,96" />}
        {pattern === "halves" && <rect x="0" y="0" width="50" height="100" />}
        {pattern === "chevron" && <polyline points="26,48 50,70 74,48" fill="none" stroke={secondary} strokeWidth="12" strokeLinejoin="miter" />}
        {/* Contrast panels down both sides, the way a darts shirt is cut. */}
        {pattern === "panels" && (
          <>
            <rect x="0" y="0" width="38" height="100" />
            <rect x="62" y="0" width="38" height="100" />
          </>
        )}
        {/* A curved band across the body, from one hip up to the other shoulder. */}
        {pattern === "swoosh" && <path d="M20 84 Q44 56 80 52 L80 66 Q50 68 28 96 Z" />}
        {/* A colour block over the shoulders and chest. */}
        {pattern === "yoke" && <path d="M0 0 H100 V44 Q50 66 0 44 Z" />}
        {/* Two slashes rising from the bottom corners. */}
        {pattern === "flash" && (
          <>
            <polygon points="26,93 26,64 44,93" />
            <polygon points="74,93 74,64 56,93" />
          </>
        )}
      </g>
      <path d={BODY} fill={`url(#${shade})`} />
      {/* Two soft folds down the cloth. */}
      <path d="M34 42 Q37 68 33 92" fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="1.2" />
      <path d="M66 42 Q63 68 67 92" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
      {back ? (
        <>
          {/* The nape, and the name and number printed on the back. */}
          <path d="M37 11 Q50 22 63 11" fill="none" stroke={trim} strokeWidth="4" strokeLinecap="round" />
          {label && (
            <text x="50" y="40" textAnchor="middle" fontSize="7" fontWeight="700" letterSpacing="0.8" fill={trim}>
              {label.toUpperCase().slice(0, 9)}
            </text>
          )}
          {number !== undefined && (
            <text x="50" y="72" textAnchor="middle" fontSize="30" fontWeight="800" fill={trim}>
              {number}
            </text>
          )}
        </>
      ) : (
        <>
          {/* Polo collar: two folded flaps and a button placket, in the trim colour. */}
          <polygon points="32,10 44,8 51,24 41,19" fill={trim} />
          <polygon points="68,10 56,8 49,24 59,19" fill={trim} />
          <path d="M50 24 L50 46" stroke={trim} strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="31" r="1.6" fill={primary} />
          <circle cx="50" cy="39" r="1.6" fill={primary} />
        </>
      )}
      {/* Sleeve cuffs. */}
      <path d="M5 38 L19 47" stroke={trim} strokeWidth="5" strokeLinecap="round" />
      <path d="M95 38 L81 47" stroke={trim} strokeWidth="5" strokeLinecap="round" />
      <path d={BODY} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The shirt shown as an object and not an icon: on a soft pool of its own colour, standing over a shadow on the floor, large enough to
 * see the cloth. For the profile, the line-up and the kit editor; the small TeamKit stays for rows and chips.
 */
export function KitStage({ kit, size = 96, back = false, label, number, title }: { kit: Kit; size?: number; back?: boolean; label?: string; number?: number | string; title?: string }) {
  return (
    <span className="kit-stage" style={{ width: size * 1.45, height: size * 1.2 }}>
      <span aria-hidden className="kit-stage-light" style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${kit.primary} 34%, transparent), transparent)` }} />
      <span className="kit-stage-shirt">
        <TeamKit kit={kit} size={size} back={back} label={label} number={number} title={title} />
      </span>
      <span aria-hidden className="kit-stage-floor" />
    </span>
  );
}
