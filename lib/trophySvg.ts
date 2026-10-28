import type { TierId } from "./career";
import { MATERIALS, TIER_LOOK, type MaterialName } from "./materials";

/**
 * The trophies and the rank badges, drawn in SVG with a gradient for each metal: dark edge, body, light and gloss, so that the round parts
 * look round. A string, because it is the same drawing in many places and the ids of its gradients have to be its own (`u`).
 */

const P = MATERIALS;
const cyl = (id: string, p: (typeof P)[MaterialName]) =>
  `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${p.x}"/><stop offset=".1" stop-color="${p.d}"/><stop offset=".28" stop-color="${p.l}"/><stop offset=".38" stop-color="${p.hi}"/><stop offset=".5" stop-color="${p.l}"/><stop offset=".74" stop-color="${p.m}"/><stop offset=".92" stop-color="${p.d}"/><stop offset="1" stop-color="${p.x}"/></linearGradient>`;
const vert = (id: string, p: (typeof P)[MaterialName]) =>
  `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${p.hi}"/><stop offset=".3" stop-color="${p.l}"/><stop offset=".6" stop-color="${p.m}"/><stop offset="1" stop-color="${p.d}"/></linearGradient>`;

function laurel(u: string, side: number, pal: MaterialName) {
  let s = "";
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = 60 + side * (35 - 12 * t * t);
    const y = 52 + 30 * t;
    const r = side * (28 + 42 * t);
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6" ry="2.4" transform="rotate(${r} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${u}${pal})" stroke="${P[pal].d}" stroke-width=".4"/>`;
  }
  return s;
}
const stem = (u: string, m: MaterialName, y0 = 83) =>
  `<path d="M53 ${y0} H67 L70 108 H50 Z" fill="url(#${u}${m})"/><ellipse cx="60" cy="96" rx="12.5" ry="4.6" fill="url(#${u}${m})" stroke="${P[m].d}" stroke-width=".5"/>` +
  `<path d="M38 124 C38 113 51 108 60 108 C69 108 82 113 82 124 Z" fill="url(#${u}${m})"/><path d="M40 123 C41 116 52 111 60 111" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>`;
const handles = (u: string, m: MaterialName) =>
  ["M31 34 C8 32 8 68 38 72", "M89 34 C112 32 112 68 82 72"]
    .map((d) => `<path d="${d}" fill="none" stroke="url(#${u}${m}V)" stroke-width="6.5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P[m].hi}" stroke-opacity=".5" stroke-width="1.5" stroke-linecap="round" transform="translate(-.8 -.8)"/>`)
    .join("");
const rim = (u: string, m: MaterialName, cy = 26, rx = 30) =>
  `<ellipse cx="60" cy="${cy}" rx="${rx}" ry="6.5" fill="url(#${u}${m}V)"/><ellipse cx="60" cy="${cy + 0.9}" rx="${rx - 3}" ry="4.6" fill="${P[m].x}" opacity=".85"/><ellipse cx="60" cy="${cy}" rx="${rx}" ry="6.5" fill="none" stroke="${P[m].hi}" stroke-opacity=".8" stroke-width="1"/>`;
const spec = (m: MaterialName) =>
  `<g class="t3d-spec"><path d="M39 32 C39 52 44 67 54 77" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3.4" stroke-linecap="round"/><path d="M85 36 C85 50 81 61 75 69" fill="none" stroke="${P[m].hi}" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/></g>`;
const spark = (u: string, x: number, y: number, s: number, d: number) => `<g transform="translate(${x} ${y}) scale(${s})"><use class="t3d-spark" href="#${u}sp" style="animation-delay:${d}s"/></g>`;

const BODY: Record<TierId, (u: string) => string> = {
  lu: (u) =>
    `<path d="M86 44 C116 42 118 98 84 100" fill="none" stroke="url(#${u}bronzeV)" stroke-width="7" stroke-linecap="round"/><path d="M86 44 C115 43 116 96 85 99" fill="none" stroke="${P.bronze.hi}" stroke-opacity=".5" stroke-width="1.5" stroke-linecap="round" transform="translate(-.8 -.8)"/>` +
    `<path d="M34 30 H86 L82 112 Q60 120 38 112 Z" fill="url(#${u}bronze)"/>` +
    `<path d="M38 104 Q60 112 82 104 L82 112 Q60 120 38 112 Z" fill="url(#${u}bronze)" stroke="${P.bronze.x}" stroke-opacity=".6" stroke-width=".6"/>` +
    `<path d="M35 44 Q60 50 85 44" fill="none" stroke="${P.bronze.hi}" stroke-opacity=".55" stroke-width="1.2"/><path d="M35.5 48 Q60 54 84.5 48" fill="none" stroke="${P.bronze.x}" stroke-opacity=".5" stroke-width="1.2"/>` +
    `<circle cx="60" cy="76" r="15" fill="#1a0f08"/><circle cx="60" cy="76" r="15" fill="none" stroke="url(#${u}goldV)" stroke-width="2"/><circle cx="60" cy="76" r="11.5" fill="#ece5d2"/><circle cx="60" cy="76" r="8.5" fill="#b3261e"/><circle cx="60" cy="76" r="5.5" fill="#ece5d2"/><circle cx="60" cy="76" r="2.6" fill="#1a1a1a"/>` +
    `<path d="M32 32 C30 18 42 20 45 25 C47 13 59 13 61 22 C65 11 77 13 77 23 C82 15 91 20 88 32 Z" fill="url(#${u}foam)"/><circle cx="48" cy="22" r="2.3" fill="#fff" opacity=".7"/><circle cx="70" cy="21" r="1.8" fill="#fff" opacity=".7"/><circle cx="82" cy="25" r="1.6" fill="#fff" opacity=".6"/>` +
    `<g class="t3d-spec"><path d="M41 52 C41 72 42 94 45 108" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.4" stroke-linecap="round"/></g>` +
    spark(u, 44, 60, 1, 0) +
    spark(u, 84, 14, 0.7, 1.4),
  region: (u) =>
    handles(u, "silver") +
    `<path d="M30 26 H90 C90 60 78 80 60 84 C42 80 30 60 30 26Z" fill="url(#${u}silver)"/>` +
    rim(u, "silver") +
    stem(u, "silver") +
    `<path d="M33 46 Q60 52 87 46" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.1"/><path d="M33.8 50 Q60 56 86.2 50" fill="none" stroke="${P.silver.x}" stroke-opacity=".5" stroke-width="1.2"/>` +
    `<circle cx="60" cy="64" r="9.5" fill="url(#${u}silverV)" stroke="#3fb6b0" stroke-width="2"/><path d="M60 58 l2.1 4.3 4.7.6 -3.4 3.3.8 4.7 -4.2 -2.2 -4.2 2.2.8 -4.7 -3.4 -3.3 4.7 -.6Z" fill="#3fb6b0"/>` +
    spec("silver") +
    spark(u, 45, 38, 1, 0) +
    spark(u, 80, 56, 0.7, 1.2),
  nm: (u) =>
    handles(u, "gold") +
    laurel(u, -1, "gold") +
    laurel(u, 1, "gold") +
    `<path d="M30 26 H90 C90 60 78 80 60 84 C42 80 30 60 30 26Z" fill="url(#${u}gold)"/>` +
    `<path d="M30.6 52 H89.4 C88 66 78 80 60 84 C42 80 32 66 30.6 52Z" fill="url(#${u}ruby)"/><path d="M30.4 52 H89.6" stroke="url(#${u}goldV)" stroke-width="2.6"/>` +
    rim(u, "gold") +
    stem(u, "gold") +
    `<path d="M60 36 l3 6.2 6.8.9 -5 4.7 1.3 6.7 -6.1 -3.3 -6.1 3.3 1.3 -6.7 -5 -4.7 6.8 -.9Z" fill="url(#${u}goldV)" stroke="${P.gold.d}" stroke-width=".5"/>` +
    `<g class="t3d-spec"><path d="M39 32 C39 52 44 67 54 77" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3.4" stroke-linecap="round"/></g>` +
    spark(u, 43, 34, 1, 0) +
    spark(u, 78, 66, 0.8, 1.5),
  gs: (u) =>
    handles(u, "chrome") +
    `<path d="M30 28 H90 C90 60 78 80 60 84 C42 80 30 60 30 28Z" fill="url(#${u}chrome)"/>` +
    stem(u, "chrome") +
    `<path d="M60 44 l10 13 -10 18 -10 -18Z" fill="url(#${u}amethyst)" stroke="${P.amethyst.hi}" stroke-opacity=".7" stroke-width=".8"/><path d="M60 44 V75 M50 57 H70" stroke="#fff" stroke-opacity=".4" stroke-width=".8"/><path d="M60 44 l10 13 H50Z" fill="#fff" opacity=".3"/>` +
    `<path d="M41 50 l6 8 -6 10 -6 -10Z" fill="url(#${u}amethyst)" stroke="${P.amethyst.hi}" stroke-opacity=".6" stroke-width=".6"/><path d="M79 50 l6 8 -6 10 -6 -10Z" fill="url(#${u}amethyst)" stroke="${P.amethyst.hi}" stroke-opacity=".6" stroke-width=".6"/>` +
    `<path d="M35 31 L33 8 L47 20 L60 3 L73 20 L87 8 L85 31 Z" fill="url(#${u}gold)" stroke="${P.gold.d}" stroke-width=".6"/><path d="M35 25 H85 V31 H35Z" fill="url(#${u}goldV)"/>` +
    `<circle cx="33" cy="8" r="3.2" fill="url(#${u}amethyst)"/><circle cx="60" cy="3" r="3.6" fill="url(#${u}amethyst)"/><circle cx="87" cy="8" r="3.2" fill="url(#${u}amethyst)"/>` +
    `<circle cx="48" cy="28" r="1.8" fill="${P.amethyst.l}"/><circle cx="60" cy="28" r="1.8" fill="${P.amethyst.l}"/><circle cx="72" cy="28" r="1.8" fill="${P.amethyst.l}"/>` +
    `<g class="t3d-spec"><path d="M39 38 C39 54 44 67 53 76" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3.4" stroke-linecap="round"/></g>` +
    spark(u, 60, 3, 1.1, 0) +
    spark(u, 38, 62, 0.8, 1.1) +
    spark(u, 83, 70, 0.7, 2.2),
  vm: (u) =>
    `<path d="M52 98 H68 L72 124 H48Z" fill="url(#${u}gold)"/><ellipse cx="60" cy="100" rx="11" ry="4" fill="url(#${u}gold)"/>` +
    `<path d="M44 118 C20 106 24 74 40 64" fill="none" stroke="url(#${u}goldV)" stroke-width="5.5" stroke-linecap="round"/><path d="M76 118 C100 106 96 74 80 64" fill="none" stroke="url(#${u}goldV)" stroke-width="5.5" stroke-linecap="round"/>` +
    `<path d="M38 124 C38 113 51 108 60 108 C69 108 82 113 82 124 Z" fill="url(#${u}gold)"/>` +
    `<g transform="rotate(-18 60 54)"><path d="M20 54 A40 10 0 0 1 100 54" fill="none" stroke="url(#${u}goldV)" stroke-width="3.2"/></g>` +
    `<circle cx="60" cy="54" r="28" fill="url(#${u}globe)"/>` +
    `<ellipse cx="60" cy="54" rx="11" ry="28" fill="none" stroke="${P.gold.d}" stroke-opacity=".55" stroke-width="1"/><ellipse cx="60" cy="54" rx="22" ry="28" fill="none" stroke="${P.gold.d}" stroke-opacity=".45" stroke-width="1"/><ellipse cx="60" cy="54" rx="28" ry="7" fill="none" stroke="${P.gold.d}" stroke-opacity=".55" stroke-width="1"/><path d="M35 40 Q60 46 85 40 M35 68 Q60 62 85 68" fill="none" stroke="${P.gold.d}" stroke-opacity=".4" stroke-width="1"/>` +
    `<g transform="rotate(-18 60 54)"><path d="M20 54 A40 10 0 0 0 100 54" fill="none" stroke="url(#${u}goldV)" stroke-width="3.6"/><path d="M22 55 A38 9 0 0 0 98 55" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/></g>` +
    `<g class="t3d-spec"><ellipse cx="49" cy="38" rx="9" ry="5.5" transform="rotate(-35 49 38)" fill="#fff" opacity=".55"/></g>` +
    `<path d="M60 6 l8 9 -8 12 -8 -12Z" fill="url(#${u}diamond)" stroke="#fff" stroke-opacity=".8" stroke-width=".8"/><path d="M52 15 H68 M60 6 V27" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/><path d="M60 6 l8 9 H52Z" fill="#fff" opacity=".45"/>` +
    spark(u, 60, 8, 1.3, 0) +
    spark(u, 38, 44, 0.8, 1.3) +
    spark(u, 86, 62, 0.9, 2.1),
};

/** The trophy of an event as SVG. `bare` is the trophy alone (for cards, shelves and lists); otherwise it stands on its plinth with a shadow and a reflection. */
export function trophySvg(kind: TierId, u: string, bare = false): string {
  const look = TIER_LOOK[kind];
  const used = [look.metal, look.accent, look.gem, look.plinth, "gold", "bronze"].filter((x, i, a): x is MaterialName => !!x && a.indexOf(x) === i);
  const defs =
    used.map((p) => cyl(u + p, P[p]) + vert(u + p + "V", P[p])).join("") +
    `<radialGradient id="${u}globe" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${P.gold.hi}"/><stop offset=".28" stop-color="${P.gold.l}"/><stop offset=".62" stop-color="${P.gold.m}"/><stop offset="1" stop-color="${P.gold.x}"/></radialGradient>` +
    `<linearGradient id="${u}foam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e3cf9c"/></linearGradient>` +
    `<path id="${u}sp" d="M0-7C.6-2 2-.6 7 0 2 .6 .6 2 0 7-.6 2-2 .6-7 0-2-.6-.6-2 0-7Z" fill="#fff"/>` +
    `<filter id="${u}bl"><feGaussianBlur stdDeviation="3.2"/></filter>` +
    `<linearGradient id="${u}fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<mask id="${u}fade" maskUnits="userSpaceOnUse" x="0" y="140" width="120" height="30"><rect x="0" y="140" width="120" height="30" fill="url(#${u}fg)"/></mask>`;
  const body = `<g id="${u}t">${BODY[kind](u)}</g>`;
  if (bare) return `<svg viewBox="10 0 100 128" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  const pl = look.plinth;
  const plinth =
    `<ellipse cx="60" cy="146" rx="46" ry="6" fill="#000" opacity=".55" filter="url(#${u}bl)"/>` +
    `<path d="M22 138 H98 V147 H22Z" fill="url(#${u}${pl})"/><path d="M22 138 H98" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>` +
    `<path d="M30 125 H90 V138 H30Z" fill="url(#${u}${pl})"/><path d="M30 125 H90" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>` +
    `<rect x="46" y="129" width="28" height="6" rx="1.2" fill="url(#${u}goldV)"/><path d="M50 132 H70" stroke="${P.gold.x}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 1.4"/>`;
  return `<svg viewBox="0 0 120 170" aria-hidden="true" focusable="false"><defs>${defs}</defs>${plinth}<g mask="url(#${u}fade)"><g transform="translate(0 296) scale(1 -1)" opacity=".26"><use href="#${u}t"/></g></g>${body}</svg>`;
}

/** A rank badge: a shield in the material of the rank with a chevron for each step, or a crown for the world champion. */
export function badgeSvg(metal: MaterialName, chevrons: number, crown: boolean, u: string): string {
  const p = crown ? "gold" : metal;
  const i = crown ? "diamond" : p;
  const defs = cyl(u + "m", P[p]) + vert(u + "v", P[p]) + cyl(u + "i", P[i]) + vert(u + "iv", P[i]);
  let inner = "";
  if (crown) {
    inner = `<path d="M18 40 L16 24 L25 31 L32 18 L39 31 L48 24 L46 40Z" fill="url(#${u}v)" stroke="${P.gold.x}" stroke-width=".6"/><path d="M18 40 H46 V44 H18Z" fill="url(#${u}m)"/><circle cx="32" cy="18" r="2.6" fill="#fff"/><circle cx="16" cy="24" r="2" fill="#d8f6ff"/><circle cx="48" cy="24" r="2" fill="#d8f6ff"/><path d="M32 49 l5 6 -5 8 -5 -8Z" fill="url(#${u}i)"/>`;
  } else {
    for (let n = 0; n < chevrons; n++) {
      const y = 50 - n * 8;
      inner += `<path d="M20 ${y} L32 ${y - 9} L44 ${y}" fill="none" stroke="${P[p].x}" stroke-opacity=".55" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 1.2)"/><path d="M20 ${y} L32 ${y - 9} L44 ${y}" fill="none" stroke="url(#${u}iv)" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  return `<svg viewBox="0 0 64 76" aria-hidden="true" focusable="false"><defs>${defs}</defs><path d="M32 3 L59 12 V37 C59 55 47 67 32 73 C17 67 5 55 5 37 V12Z" fill="url(#${u}m)" stroke="${P[p].x}" stroke-width="1"/><path d="M32 8.5 L54 15.5 V37 C54 52 44 62 32 67.5 C20 62 10 52 10 37 V15.5Z" fill="#101614" stroke="${P[p].hi}" stroke-opacity=".7" stroke-width=".8"/><path d="M32 8.5 L54 15.5 V37 C54 52 44 62 32 67.5Z" fill="#fff" opacity=".05"/>${inner}<path d="M12 15 L32 8.5 L52 15" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/></svg>`;
}
