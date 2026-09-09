import {
  chainCrosses,
  currentStepFor,
  removeOneCross,
  type CrossDelta,
  type PendingAmbiguous,
  type Progress,
  type Step,
} from "./game";
import { parseSector } from "./scoliaMapping";

/** One cross landing, before it is turned into a HitRecord (which needs a player and a turn). */
export type CrossLanding = CrossDelta & { step: Step };

export type DartApplication = {
  /** The board after this dart, including any un-parking. */
  board: Progress;
  /** Crosses gained, in the order they were applied. */
  added: CrossLanding[];
  /** True when a parked triple/double gave up its ring to make room — its own record has to be
   *  dropped from the turn by the caller, and its crosses are in `added` under its number. */
  unparked: boolean;
};

/**
 * Applies one dart to the board — the scoring rule, with none of React in it.
 *
 * This is the part that got three separate bugs wrong in a single day, so it lives here where
 * it can be read on its own and tested directly. What stays in the component is the plumbing
 * it never got wrong twice for the same reason: refs, state, turn bookkeeping.
 *
 * `parked` is a still-unconfirmed triple/double sitting on the ring this dart needs (see
 * ambiguousBlockingRing). Passing it means "move that one to its number so this one can score".
 * Passing null is the ordinary case.
 */
export function applyDartToBoard(
  board: Progress,
  step: Step,
  crosses: number,
  parked: PendingAmbiguous | null,
): DartApplication {
  const next: Progress = { ...board };
  const added: CrossLanding[] = [];

  if (parked) {
    // Take this dart's cross off the ring — a decrement, never a restore of the parked
    // record's stored prevCount, which goes stale the moment anything else lands there.
    next[parked.ringStep] = removeOneCross(next[parked.ringStep]);
    // The parked dart pays out on its number instead. Capped like anything else, so it can
    // come to nothing when the number is full too — still no worse than leaving it parked.
    for (const d of chainCrosses(next[parked.number], parked.multiplier)) {
      next[parked.number] = d.newCount;
      added.push({ ...d, step: parked.number });
    }
  }

  for (const d of chainCrosses(next[step], crosses)) {
    next[step] = d.newCount;
    added.push({ ...d, step });
  }

  return { board: next, added, unparked: parked !== null };
}

/** One dart of the current turn as it was thrown, and whether it scored when it landed. */
export type TurnDart = {
  dartIndex: number;
  sector: string;
  bounceout: boolean;
  scored: boolean;
};

export type Replay = {
  board: Progress;
  /** Crosses gained, each tagged with the dart that (belatedly) earned it. */
  added: (CrossLanding & { dartIndex: number })[];
};

/**
 * Re-reads the darts thrown after a parked triple/double, once redirecting it has finished the
 * number and moved the player on.
 *
 * On 17, a T17 is parked as a choice; the next dart is a single 16 — and it is thrown away on
 * the spot, because 17 is still the active step. Then the player picks "complete 17" at Confirm:
 * 17 fills, 16 becomes active, and it has been active since the dart after the T17. That single
 * 16 was a hit, and the board owes it a cross. This walks the later darts and pays those out.
 *
 * Only plain singles on the newly active number are replayed. Everything else either scored
 * already (a double/triple anywhere banked a ring cross, a bull scored on D/BULL) or scores
 * nothing whichever number is active. Stops at 3/3: darts beyond that are ordinary misses.
 */
export function replayDiscardedSingles(board: Progress, darts: readonly TurnDart[], afterDartIndex: number): Replay {
  const next: Progress = { ...board };
  const added: Replay["added"] = [];
  const active = currentStepFor(next);
  // Only a number can be entered this way — D, T and BULL cannot have singles waiting for them.
  if (active === null || Number.isNaN(Number(active))) return { board: next, added };

  for (const dart of darts) {
    if (dart.dartIndex <= afterDartIndex || dart.scored) continue;
    const parsed = parseSector(dart.sector, dart.bounceout);
    if (parsed.kind !== "number" || parsed.ring !== "S" || String(parsed.number) !== active) continue;
    for (const d of chainCrosses(next[active], 1)) {
      next[active] = d.newCount;
      added.push({ ...d, step: active, dartIndex: dart.dartIndex });
    }
    if (next[active] >= 3) break;
  }
  return { board: next, added };
}
