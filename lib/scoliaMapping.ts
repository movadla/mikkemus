import type { Step } from "./game";

export type ParsedSector =
  | { kind: "miss" }
  | { kind: "bull"; ring: "outer" | "inner" }
  | { kind: "number"; ring: "S" | "D" | "T"; number: number };

/** Scolia sector strings: ["S"|"s"|"D"|"T"][1-20] | "25" | "Bull" | "None".
 *  's' and 'S' are both "single" for our purposes — we don't track which ring. */
export function parseSector(sector: string, bounceout: boolean): ParsedSector {
  if (bounceout || sector === "None") return { kind: "miss" };
  if (sector === "25") return { kind: "bull", ring: "outer" };
  if (sector === "Bull") return { kind: "bull", ring: "inner" };
  const match = /^([SsDT])(\d{1,2})$/.exec(sector);
  if (!match) return { kind: "miss" };
  const ring = match[1] === "s" ? "S" : (match[1] as "S" | "D" | "T");
  return { kind: "number", ring, number: parseInt(match[2], 10) };
}

export type ThrowMapping = {
  /** Step this throw is a candidate for, or null if it can never count toward any step. */
  step: Step | null;
  /** Crosses this single dart is worth if the step turns out to be registrable. Inner bull = 2. */
  crosses: number;
};

/**
 * Maps a parsed sector to a candidate step + cross value, independent of game state.
 * Caller must still check isRegistrable(step, activeStep, progress) from lib/game.ts —
 * this only says what the throw COULD count as, not whether it's currently allowed
 * (e.g. a single 14 while the player is still on 20 comes back as step "14" here, but
 * isRegistrable will correctly reject it since 14 isn't the active step).
 */
export function stepForSector(parsed: ParsedSector): ThrowMapping {
  if (parsed.kind === "miss") return { step: null, crosses: 0 };

  if (parsed.kind === "bull") {
    return { step: "BULL", crosses: parsed.ring === "inner" ? 2 : 1 };
  }

  if (parsed.ring === "D") return { step: "D", crosses: 1 };
  if (parsed.ring === "T") return { step: "T", crosses: 1 };

  // Single ring only maps to a step for the numbers this game actually tracks (14-20).
  if (parsed.number >= 14 && parsed.number <= 20) {
    return { step: String(parsed.number) as Step, crosses: 1 };
  }
  return { step: null, crosses: 0 };
}
