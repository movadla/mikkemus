import {
  chainCrosses,
  removeOneCross,
  type CrossDelta,
  type PendingAmbiguous,
  type Progress,
  type Step,
} from "./game";

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
