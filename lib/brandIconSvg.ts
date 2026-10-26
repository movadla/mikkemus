/**
 * The app's icon: the brand symbol (a ring and a dart that has landed at its centre) in teal and gold on dark green, with the
 * faint rings of a dartboard behind it. Drawn as an SVG string so that the same picture is the favicon, the home-screen icon and
 * the installed-app icon (see app/icon.tsx, app/apple-icon.tsx, app/pwa-*). The symbol is the one in components/ui/BrandMark.
 *
 *  - `rounded`: the rounded square with a thin light edge (browser tab, «any» icons). Without it the picture runs to the
 *    edges, which is what iOS and the maskable icons want: the system cuts the corners itself.
 *  - `safe`: the drawing is drawn smaller, inside the central 78 % that a circular mask will not cut (maskable icons).
 */
export function brandIconSvg(opts: { rounded?: boolean; safe?: boolean } = {}): string {
  const rounded = !!opts.rounded;
  const k = opts.safe ? 0.78 : 1;

  let rings = "";
  for (const [r, c] of [[300, "#13171d"], [276, "#ece5d3"], [258, "#c8362e"], [240, "#ece5d3"], [156, "#2d8b54"], [138, "#ece5d3"], [66, "#c8362e"], [30, "#2d8b54"]] as const) rings += `<circle cx="256" cy="256" r="${r}" fill="${c}"/>`;

  const art =
    `<circle cx="256" cy="256" r="150" fill="none" stroke="url(#teal)" stroke-width="26"/>` +
    `<circle cx="256" cy="256" r="80" fill="none" stroke="url(#teal)" stroke-width="16" opacity=".55"/>` +
    // The dart: the shaft from the upper right into the centre, the tip in the middle and the flights at the tail.
    `<line x1="256" y1="256" x2="396" y2="116" stroke="url(#gold)" stroke-width="22" stroke-linecap="round"/>` +
    `<polygon points="396,116 452,104 440,160" fill="url(#gold)"/><polygon points="372,140 424,128 412,180" fill="url(#gold)" opacity=".8"/>` +
    `<circle cx="256" cy="256" r="20" fill="url(#gold)"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>` +
    `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1bd"/><stop offset=".45" stop-color="#dcaa42"/><stop offset="1" stop-color="#8a5f1d"/></linearGradient>` +
    `<linearGradient id="teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7be0ea"/><stop offset="1" stop-color="#1e8e9b"/></linearGradient>` +
    `<radialGradient id="bg" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#27513a"/><stop offset="1" stop-color="#091410"/></radialGradient>` +
    `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".7" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>` +
    (rounded ? `<clipPath id="cl"><rect width="512" height="512" rx="115"/></clipPath>` : "") +
    `</defs><g${rounded ? ` clip-path="url(#cl)"` : ""}>` +
    `<rect width="512" height="512" fill="url(#bg)"/><g opacity=".1">${rings}</g>` +
    `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${art}</g>` +
    `<path d="M0 0H512V196Q256 300 0 196Z" fill="url(#gl)"/><rect width="512" height="512" fill="url(#sh)"/></g>` +
    (rounded ? `<rect x="2" y="2" width="508" height="508" rx="113" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>` : "") +
    `</svg>`
  );
}
