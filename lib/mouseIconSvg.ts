/**
 * The app's icon: a gold «M» whose middle is a mouse's snout, with eyes, nose and whiskers, on dark green with the faint
 * rings of a dartboard behind it. Drawn as an SVG string so that the same picture is the favicon, the home-screen icon and
 * the installed-app icon (see app/icon.tsx, app/apple-icon.tsx, app/pwa-*).
 *
 *  - `rounded`: the rounded square with a thin light edge (browser tab, «any» icons). Without it the picture runs to the
 *    edges, which is what iOS and the maskable icons want: the system cuts the corners itself.
 *  - `safe`: the drawing is drawn smaller, inside the central 78 % that a circular mask will not cut (maskable icons).
 */
export function mouseIconSvg(opts: { rounded?: boolean; safe?: boolean } = {}): string {
  const rounded = !!opts.rounded;
  const k = opts.safe ? 0.78 : 1;

  let rings = "";
  for (const [r, c] of [[300, "#13171d"], [276, "#ece5d3"], [258, "#c8362e"], [240, "#ece5d3"], [156, "#2d8b54"], [138, "#ece5d3"], [66, "#c8362e"], [30, "#2d8b54"]] as const) rings += `<circle cx="256" cy="256" r="${r}" fill="${c}"/>`;
  let wires = "";
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 + 9) * Math.PI) / 180;
    wires += `<line x1="${(256 + Math.cos(a) * 30).toFixed(1)}" y1="${(256 + Math.sin(a) * 30).toFixed(1)}" x2="${(256 + Math.cos(a) * 276).toFixed(1)}" y2="${(256 + Math.sin(a) * 276).toFixed(1)}"/>`;
  }

  const art =
    `<polygon points="96,392 96,128 150,128 256,282 362,128 416,128 416,392 362,392 362,236 276,364 236,364 150,236 150,392" fill="url(#gold)" stroke="#7b5518" stroke-width="5" stroke-linejoin="round"/>` +
    `<polygon points="96,128 150,128 150,150 110,150" fill="#fff" opacity=".35"/><polygon points="416,128 362,128 362,150 402,150" fill="#fff" opacity=".2"/>` +
    `<circle cx="222" cy="188" r="15" fill="#f6f2ea"/><circle cx="290" cy="188" r="15" fill="#f6f2ea"/><circle cx="226" cy="190" r="8" fill="#14120a"/><circle cx="286" cy="190" r="8" fill="#14120a"/>` +
    `<ellipse cx="256" cy="276" rx="15" ry="11" fill="#e0708c"/><ellipse cx="252" cy="272" rx="5" ry="3" fill="#fff" opacity=".6"/>` +
    `<g stroke="#f6d68a" stroke-width="5" stroke-linecap="round" fill="none"><path d="M70 300L20 288M70 332L18 336M72 362L28 382M442 300L492 288M442 332L494 336M440 362L484 382"/></g>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>` +
    `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1bd"/><stop offset=".45" stop-color="#dcaa42"/><stop offset="1" stop-color="#8a5f1d"/></linearGradient>` +
    `<radialGradient id="bg" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#27513a"/><stop offset="1" stop-color="#091410"/></radialGradient>` +
    `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".7" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>` +
    (rounded ? `<clipPath id="cl"><rect width="512" height="512" rx="115"/></clipPath>` : "") +
    `</defs><g${rounded ? ` clip-path="url(#cl)"` : ""}>` +
    `<rect width="512" height="512" fill="url(#bg)"/><g opacity=".1">${rings}<g stroke="#9aa0a8" stroke-opacity=".6" stroke-width="2">${wires}</g></g>` +
    `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${art}</g>` +
    `<path d="M0 0H512V196Q256 300 0 196Z" fill="url(#gl)"/><rect width="512" height="512" fill="url(#sh)"/></g>` +
    (rounded ? `<rect x="2" y="2" width="508" height="508" rx="113" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>` : "") +
    `</svg>`
  );
}
