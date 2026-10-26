import { KIT_COLOURS } from "./teamKit";

type Colour = { hex: string; name: string };

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Hue (0–360), saturation, lightness and chroma (how far the three channels are apart, 0–1) of a colour. A colour with almost no chroma is a grey,
 *  whatever its hue says: the warm white of a shirt is one. */
export function hsl(hex: string): { h: number; s: number; l: number; c: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l, c: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l, c: d };
}

const isGrey = (hex: string) => hsl(hex).c < 0.1;

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = rgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The colours in a row that reads as a spectrum: the greys (white, silver, black) last, the rest by hue starting from red. */
export function byHue(colours: readonly Colour[] = KIT_COLOURS): Colour[] {
  const grey = (c: Colour) => isGrey(c.hex);
  const colour = colours.filter((c) => !grey(c)).sort((a, b) => hsl(a.hex).h - hsl(b.hex).h || hsl(a.hex).l - hsl(b.hex).l);
  const greys = colours.filter(grey).sort((a, b) => hsl(b.hex).l - hsl(a.hex).l);
  return [...colour, ...greys];
}

/** Two colours of the same sort: both greys of about the same lightness, or the same hue at about the same lightness. */
function alike(a: string, b: string): boolean {
  const x = hsl(a);
  const y = hsl(b);
  const close = Math.abs(x.l - y.l) < 0.3;
  const gx = isGrey(a);
  const gy = isGrey(b);
  if (gx !== gy) return false;
  if (gx) return close;
  const d = Math.abs(x.h - y.h);
  return Math.min(d, 360 - d) <= 25 && close;
}

/**
 * Three colours that go with a main colour for the pattern: the ones that stand out from it most (a contrast of at least 3, so the pattern
 * can be seen), with no two of them alike, and the hue furthest away first. A shirt in a dark colour is offered the light ones and the
 * other way round.
 */
export function suggestPatternColours(primary: string, colours: readonly Colour[] = KIT_COLOURS, n = 3): Colour[] {
  const base = hsl(primary);
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const ranked = colours
    .filter((c) => c.hex.toLowerCase() !== primary.toLowerCase() && contrast(primary, c.hex) >= 3)
    .map((c) => {
      const k = hsl(c.hex);
      // Contrast first; among those, a different hue (or, for a grey, a different lightness) is worth more.
      const unlike = isGrey(c.hex) || isGrey(primary) ? Math.abs(k.l - base.l) * 180 : distance(k.h, base.h);
      return { c, score: contrast(primary, c.hex) * 14 + unlike };
    })
    .sort((a, b) => b.score - a.score);
  const picked: Colour[] = [];
  for (const { c } of ranked) {
    // Not two that are the same sort of colour: white and silver, or two reds.
    if (picked.every((p) => !alike(p.hex, c.hex))) picked.push(c);
    if (picked.length === n) break;
  }
  return picked;
}

/** Which of a light or a dark mark reads on a swatch of this colour (the check on the colour that is chosen). */
export function checkOn(hex: string): "light" | "dark" {
  return contrast(hex, "#ffffff") >= contrast(hex, "#1b1b1b") ? "light" : "dark";
}
