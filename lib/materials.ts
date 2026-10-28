import type { TierId } from "./career";

/**
 * The materials of the career: eight metals, stones and woods, each as a ramp from a dark edge through the body to the bright gloss. Every
 * trophy, title, button and frame is made of these, so the pieces belong together. The same ramps are in app/globals.css as --metal-* for the
 * things made in CSS; the two have to be changed together.
 *
 *   x: the dark edge   d: shade   m: body   l: light   hi: gloss
 *
 * One light, from the upper left; a faint rim light from the right; and a shadow that always falls down and to the right.
 */
export type Material = { hi: string; l: string; m: string; d: string; x: string };
export type MaterialName = "bronze" | "silver" | "gold" | "ruby" | "chrome" | "amethyst" | "diamond" | "wood" | "marble";

export const MATERIALS: Record<MaterialName, Material> = {
  bronze: { hi: "#ffe6c2", l: "#eaa96a", m: "#b8682e", d: "#6d3513", x: "#35190a" },
  silver: { hi: "#ffffff", l: "#e1e9ef", m: "#a1b1bd", d: "#586874", x: "#28323a" },
  gold: { hi: "#fff6cf", l: "#f5d57f", m: "#c9962f", d: "#7c5414", x: "#3d2907" },
  ruby: { hi: "#ffb0a2", l: "#ee5c49", m: "#b32b22", d: "#6b1511", x: "#360a0a" },
  chrome: { hi: "#ffffff", l: "#dcd6f0", m: "#9087bd", d: "#4a4079", x: "#1e1842" },
  amethyst: { hi: "#efdcff", l: "#bd92f7", m: "#7f4ad2", d: "#45228c", x: "#241049" },
  diamond: { hi: "#ffffff", l: "#d8f6ff", m: "#8fd3ee", d: "#3b8fb5", x: "#124a66" },
  wood: { hi: "#b8875a", l: "#8f633c", m: "#6a4528", d: "#46290f", x: "#25140a" },
  marble: { hi: "#59636a", l: "#363d42", m: "#21272a", d: "#131719", x: "#080a0b" },
};

/** What each event's trophy is made of. `tint` is the colour of its light and its glow. */
export type TierLook = { name: string; material: string; metal: MaterialName; accent?: MaterialName; gem?: MaterialName; plinth: MaterialName; tint: string };
export const TIER_LOOK: Record<TierId, TierLook> = {
  lu: { name: "Ly-cupen", material: "Bronse", metal: "bronze", plinth: "wood", tint: "#e0a045" },
  region: { name: "Regionmesterskapet", material: "Sølv", metal: "silver", plinth: "marble", tint: "#3fb6b0" },
  nm: { name: "Norgesmesterskapet", material: "Gull og rubin", metal: "gold", accent: "ruby", plinth: "marble", tint: "#ee6b57" },
  gs: { name: "Grand Slam", material: "Krom og ametyst", metal: "chrome", accent: "gold", gem: "amethyst", plinth: "marble", tint: "#a47ae6" },
  vm: { name: "VM i dart", material: "Gull og diamant", metal: "gold", gem: "diamond", plinth: "marble", tint: "#f2c75a" },
};

/** The ramp as a CSS gradient, for frames and bars. */
export const ramp = (m: Material, deg = 90) => `linear-gradient(${deg}deg, ${m.x}, ${m.d} 12%, ${m.l} 30%, ${m.hi} 40%, ${m.l} 52%, ${m.m} 74%, ${m.d} 92%, ${m.x})`;

/** The foil of a title: light at the top, a dark horizon through the middle of the letters, and light again below. */
export function foilVars(kind: TierId): Record<string, string> {
  const look = TIER_LOOK[kind];
  const p = MATERIALS[look.metal];
  const edge = kind === "nm" ? "#4a0f0c" : kind === "gs" ? "#1e1842" : p.x;
  return {
    "--foil": `linear-gradient(180deg, ${p.hi} 0%, ${p.l} 30%, ${p.m} 49%, ${p.d} 51%, ${p.l} 66%, ${p.m} 100%)`,
    // For small type the dark horizon reads as a strike-through: light on top, body below.
    "--foil-soft": `linear-gradient(180deg, ${p.hi} 0%, ${p.l} 45%, ${p.m} 100%)`,
    "--edge": edge,
  };
}

/** The frame of a card in the metal of its event, as a gradient for the border. */
export const frameOf = (kind: TierId) => {
  const p = MATERIALS[TIER_LOOK[kind].metal];
  return `linear-gradient(145deg, ${p.hi}, ${p.m} 40%, ${p.d} 60%, ${p.l})`;
};

/** The badge of each rank: the material and the number of chevrons. The world champion has a crown. */
export const RANK_LOOK: Record<string, { metal: MaterialName; chevrons: number; crown?: boolean }> = {
  Pubspiller: { metal: "bronze", chevrons: 1 },
  Regionspiller: { metal: "silver", chevrons: 2 },
  Landslagsspiller: { metal: "gold", chevrons: 3 },
  "Slam-spiller": { metal: "chrome", chevrons: 4 },
  Verdensspiller: { metal: "diamond", chevrons: 5 },
  Verdensmester: { metal: "gold", chevrons: 0, crown: true },
};
