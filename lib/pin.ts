/**
 * A four-digit code at the door of the app. Be clear about what this is: a lock on a door, not a safe. The
 * check happens in the browser, so anyone who reads the page's code can find a way round it, and ten thousand
 * codes is not many to try. It keeps the curious out; it does not protect the data (that lives in the
 * database, which has its own rules). Kept as hashes rather than the code itself, so the code is not sitting
 * in the source in plain text.
 */
export const PIN_LENGTH = 4;
const SALT = "mikke-mus-pin:";

/**
 * Two codes, two doors. "full" is the app as it is. "limited" plays and sets up matches and tournaments, and may add
 * players and bots, but cannot delete a team or a player, and sees no statistics, seeding, records, betting or big
 * screen (see lib/access.tsx for what that hides). Like the code itself, that is a lock on a door and not a safe.
 */
export type AccessLevel = "full" | "limited";

/** For each code: the SHA-256 of the salt and the code, for browsers that have it (every page served over https does),
 *  and the same check by a small hash, for the places without SHA-256 (a page on a plain-http address). */
const CODES: Record<AccessLevel, { sha: string; fnv: string }> = {
  full: { sha: "a0d81b08f4c615b4d226e07cff10a4f4e64d04dbf3e1fe7cb77f81a1e3990c25", fnv: "8d3fe786" },
  limited: { sha: "d6e832e3d218b86e71d41e82ff332526bd64435e287da101a8b1c49b4a02d949", fnv: "12093a46" },
};

/** FNV-1a, 32 bits: a few lines, no dependencies, same answer everywhere. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Which door `pin` opens, or null. Anything that is not exactly four digits is wrong without being looked at. */
export async function checkPin(pin: string): Promise<AccessLevel | null> {
  if (pin.length !== PIN_LENGTH || [...pin].some((ch) => ch < "0" || ch > "9")) return null;
  const sha = await sha256Hex(SALT + pin);
  const fnv = sha === null ? fnv1a(SALT + pin) : null;
  for (const level of ["full", "limited"] as const) {
    if (sha !== null ? sha === CODES[level].sha : fnv === CODES[level].fnv) return level;
  }
  return null;
}

/** What a device stores once it has been let in: the level and a piece of the code's hash. It changes with the code, so a
 *  new code locks every device again, and it names the level, so a code that used to be the only one is not read as
 *  either until it has been typed again. */
const REMEMBER_KEY = "mikke-mus-pin-ok";
const rememberValue = (level: AccessLevel) => `${level}:${CODES[level].sha.slice(0, 16)}`;

/** The level this device was let in at, or null if it must be asked. */
export function rememberedLevel(): AccessLevel | null {
  try {
    const stored = localStorage.getItem(REMEMBER_KEY);
    return (["full", "limited"] as const).find((level) => stored === rememberValue(level)) ?? null;
  } catch {
    return null;
  }
}

export function rememberDevice(level: AccessLevel): void {
  try {
    localStorage.setItem(REMEMBER_KEY, rememberValue(level));
  } catch {
    // Private mode: the code is asked for again next time.
  }
}

/** Wrong guesses in a row before the keypad locks, and for how long (it grows with every lock). */
export const MAX_TRIES = 5;
export const LOCK_SECONDS = 30;
export function lockSeconds(locks: number): number {
  return LOCK_SECONDS * Math.pow(2, Math.max(0, locks - 1));
}
