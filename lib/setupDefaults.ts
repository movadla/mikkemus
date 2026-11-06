import { RULES, baseOf, type GameVariant } from "./rules";
import { PICKABLE, type VenueId } from "./venues";

/**
 * The choices of «Avanserte innstillinger» in the setup of a single match that the player has saved, so that they do not have to be made again the next
 * time. Per device. Nothing saved is the game as everyone plays it.
 */
export type SetupDefaults = {
  variant: GameVariant;
  exactEntry: boolean;
  bonusBull3: boolean;
  statsOff: boolean;
  tvungen: boolean;
  venue: VenueId;
  /** The inside picture of the place behind the game screen. */
  venueBg: boolean;
};

const KEY = "mikke-mus-setup-defaults";

export const FACTORY_DEFAULTS: SetupDefaults = { variant: "standard", exactEntry: false, bonusBull3: false, statsOff: false, tvungen: false, venue: "lu", venueBg: false };

/** What is read from the store, kept to what the setup can hold: anything else falls back to the factory value. */
export function sanitizeDefaults(raw: unknown): SetupDefaults {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (k: keyof SetupDefaults) => (typeof o[k] === "boolean" ? (o[k] as boolean) : (FACTORY_DEFAULTS[k] as boolean));
  const variant = typeof o.variant === "string" && baseOf(o.variant as GameVariant) in RULES && (o.variant as string).split("+").every((p, i) => (i === 0 ? p in RULES : p === "stand" || p === "forced")) ? (o.variant as GameVariant) : FACTORY_DEFAULTS.variant;
  const venue = PICKABLE.includes(o.venue as VenueId) ? (o.venue as VenueId) : FACTORY_DEFAULTS.venue;
  return { variant, exactEntry: bool("exactEntry"), bonusBull3: bool("bonusBull3"), statsOff: bool("statsOff"), tvungen: bool("tvungen"), venue, venueBg: bool("venueBg") };
}

/** The saved choices, or null when nothing is saved (or the store is closed). */
export function loadSetupDefaults(store: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage): SetupDefaults | null {
  try {
    const raw = store?.getItem(KEY);
    return raw ? sanitizeDefaults(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSetupDefaults(d: SetupDefaults, store: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage): boolean {
  try {
    store?.setItem(KEY, JSON.stringify(d));
    return !!store;
  } catch {
    return false;
  }
}

export function clearSetupDefaults(store: Pick<Storage, "removeItem"> | null = typeof localStorage === "undefined" ? null : localStorage): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
