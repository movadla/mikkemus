/**
 * A four-digit code at the door of the app. Be clear about what this is: a lock on a door, not a safe. The
 * check happens in the browser, so anyone who reads the page's code can find a way round it, and ten thousand
 * codes is not many to try. It keeps the curious out; it does not protect the data (that lives in the
 * database, which has its own rules). Kept as hashes rather than the code itself, so the code is not sitting
 * in the source in plain text.
 */
export const PIN_LENGTH = 4;
const SALT = "mikke-mus-pin:";
/** SHA-256 of the salt and the code, for browsers that have it (every page served over https does). */
const SHA_OF_PIN = "d6e832e3d218b86e71d41e82ff332526bd64435e287da101a8b1c49b4a02d949";
/** The same check by a small hash, for the places without SHA-256 (a page on a plain-http address). */
const FNV_OF_PIN = "12093a46";

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

/** Whether `pin` is the code. Anything that is not exactly four digits is wrong without being looked at. */
export async function checkPin(pin: string): Promise<boolean> {
  if (pin.length !== PIN_LENGTH || [...pin].some((ch) => ch < "0" || ch > "9")) return false;
  const sha = await sha256Hex(SALT + pin);
  return sha !== null ? sha === SHA_OF_PIN : fnv1a(SALT + pin) === FNV_OF_PIN;
}

/** What a device stores once it has been let in. Changes with the code, so a new code locks every device again. */
const REMEMBER_KEY = "mikke-mus-pin-ok";
const REMEMBER_VALUE = SHA_OF_PIN.slice(0, 16);

export function isRemembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === REMEMBER_VALUE;
  } catch {
    return false;
  }
}

export function rememberDevice(): void {
  try {
    localStorage.setItem(REMEMBER_KEY, REMEMBER_VALUE);
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
