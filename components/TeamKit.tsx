"use client";

import { useId } from "react";
import type { Kit } from "@/lib/teamKit";

const BODY = "M30 12 L18 18 L4 40 L18 52 L26 44 L26 92 L74 92 L74 44 L82 52 L96 40 L82 18 L70 12 Q50 26 30 12 Z";

/**
 * A team's shirt, drawn. See lib/teamKit.ts for how the colours and pattern are chosen; this only
 * paints them. One place to swap if a real image ever replaces the drawing.
 */
export function TeamKit({ kit, size = 40, title }: { kit: Kit; size?: number; title?: string }) {
  const clip = useId();
  const { primary, secondary, trim, pattern } = kit;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d={BODY} fill={primary} />
      <g clipPath={`url(#${clip})`} fill={secondary}>
        {pattern === "hoops" && (
          <>
            <rect x="0" y="36" width="100" height="10" />
            <rect x="0" y="56" width="100" height="10" />
            <rect x="0" y="76" width="100" height="10" />
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
        {pattern === "chevron" && <polyline points="26,44 50,66 74,44" fill="none" stroke={secondary} strokeWidth="12" strokeLinejoin="miter" />}
      </g>
      {/* Collar and cuffs, in the trim colour, over everything else. */}
      <path d="M30 12 Q50 26 70 12" fill="none" stroke={trim} strokeWidth="5" strokeLinecap="round" />
      <path d="M6 41 L19 51" stroke={trim} strokeWidth="5" strokeLinecap="round" />
      <path d="M94 41 L81 51" stroke={trim} strokeWidth="5" strokeLinecap="round" />
      <path d={BODY} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
