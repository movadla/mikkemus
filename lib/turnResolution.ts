import {
  chainCrosses,
  currentStepFor,
  removeOneCross,
  type CrossDelta,
  type HitRecord,
  type PendingAmbiguous,
  type Progress,
  type Step,
} from "./game";
import { getRules } from "./rules";
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

/**
 * Everything that happened in the current turn, in order — what "Angre" and "correct that
 * dart" replay. A dart is what Scolia (or the bot, or a by-hand correction) reported; a tap and
 * an untap are the board's own cells being pressed and long-pressed. Serialisable on purpose,
 * so a turn in progress survives a reload: the snapshot carries the turn's starting point and
 * this list, and the turn is rebuilt by playing it back.
 */
export type DartAction = TurnDart & { kind: "dart"; coordinates: [number, number] };
export type TapAction = { kind: "tap" | "untap"; step: Step };
export type TurnAction = DartAction | TapAction;

/**
 * The state a turn started from — enough to rewind to it and play the turn's actions again.
 * The per-match maps are stored whole rather than per player: they are small, and it keeps
 * the rewind a plain assignment instead of a merge that could miss a field.
 */
export type TurnStart = {
  player: string;
  progress: Progress;
  pendingHits: HitRecord[];
  preBanked: Record<string, { D: number; T: number }>;
  luckTotals: Record<string, Record<Step, { sum: number; count: number }>>;
  accuracyTotals: Record<string, { distance: number; horizontal: number; vertical: number; throws: number }>;
  ringHits: Record<string, { triple: Record<string, number>; double: Record<string, number> }>;
  dartsOnStep: Partial<Record<Step, number>>;
  perfectCloses: Partial<Record<Step, true>>;
  manualTaps: number;
};


export type Replay = {
  board: Progress;
  /** Crosses gained, each tagged with the dart that (belatedly) earned it. */
  added: (CrossLanding & { dartIndex: number })[];
  /**
   * Doubles/triples on the newly active number, banked on their ring as slengere when they
   * landed. Now that the number is active they are the ordinary "complete the number or keep
   * the ring cross" question, and the caller should park them as such. Nothing is moved here:
   * the cross stays on the ring until the player answers.
   */
  reopened: { dartIndex: number; ring: "D" | "T"; multiplier: 2 | 3 }[];
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
  const reopened: Replay["reopened"] = [];
  const active = currentStepFor(next);
  // Only a number can be entered this way — D, T and BULL cannot have singles waiting for them.
  if (active === null || Number.isNaN(Number(active))) return { board: next, added, reopened };

  for (const dart of darts) {
    if (dart.dartIndex <= afterDartIndex) continue;
    const parsed = parseSector(dart.sector, dart.bounceout);
    if (parsed.kind !== "number" || String(parsed.number) !== active) continue;
    if (parsed.ring === "S") {
      if (dart.scored) continue;
      for (const d of chainCrosses(next[active], 1)) {
        next[active] = d.newCount;
        added.push({ ...d, step: active, dartIndex: dart.dartIndex });
      }
    } else if (dart.scored) {
      // A D16/T16 thrown while 17 was active went on the ring. With 16 active it is the same
      // dart as a D16 thrown now: a choice, not a settled cross. Only worth asking while the
      // number still has room — meaningfulPending would drop it otherwise anyway.
      reopened.push({ dartIndex: dart.dartIndex, ring: parsed.ring, multiplier: parsed.ring === "T" ? 3 : 2 });
    }
    if (next[active] >= getRules().target) break;
  }
  return { board: next, added, reopened };
}
