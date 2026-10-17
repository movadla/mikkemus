import { setGameVariant, type GameVariant } from "../rules";
import { computeOdds } from "./index";
import { buildOddsInput, type OddsMatch } from "./match";

/**
 * The odds, worked out away from the screen. The calculation takes tens of milliseconds on a computer and
 * several times that on a phone, and while it runs the page cannot answer a tap; here it runs in a thread of
 * its own and only the answer comes back. See lib/odds/client.ts.
 */
const scope = self as unknown as { onmessage: ((e: MessageEvent<{ id: number; match: OddsMatch; variant: GameVariant | null | undefined }>) => void) | null; postMessage: (m: unknown) => void };

scope.onmessage = (e) => {
  const { id, match, variant } = e.data;
  try {
    // The rules are a setting of the page that is read from a few places: this thread needs the same one.
    setGameVariant(variant);
    scope.postMessage({ id, result: computeOdds(buildOddsInput(match)) });
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
