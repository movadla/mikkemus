import { getRules } from "./rules";

export const STEPS = [
  "20",
  "19",
  "18",
  "17",
  "16",
  "15",
  "14",
  "D",
  "T",
  "BULL",
] as const;

export type Step = (typeof STEPS)[number];

export const STEP_LABELS: Record<Step, string> = {
  "20": "20",
  "19": "19",
  "18": "18",
  "17": "17",
  "16": "16",
  "15": "15",
  "14": "14",
  T: "T",
  D: "D",
  BULL: "BULL",
};

export type Progress = Record<Step, number>;
export type PlayerProgress = Record<string, Progress>;

export type HitRecord = {
  player: string;
  step: Step;
  prevCount: number;
  newCount: number;
  /** Which of this player's turns (0-indexed) the hit belongs to — lets a rewound
   *  correction overwrite that turn's stats instead of appending a duplicate. */
  turnIndex: number;
};

/** Darts thrown per turn. A turn's treff/bom is always measured against this. */
export const DARTS_PER_TURN = 3;

/** One dart's result, for the per-turn shot-indicator boxes (green = scored a cross, red = didn't). */
export type TurnShot = { label: string; hit: boolean };

/**
 * A triple/double hit on the player's own active number, banked normally to
 * T/D but with an undecided choice pending: keep it on T/D, or redirect it to
 * complete the number instead (worth `multiplier` crosses there — a triple
 * counts 3x, a double 2x, matching the real ring's value). Resolved either by
 * a later plain hit on the same number (auto-resolves to "keep") or, if still
 * undecided, by an explicit choice at Confirm.
 */
export type PendingAmbiguous = {
  key: number;
  hitRecord: HitRecord;
  ringStep: "D" | "T";
  number: Step;
  multiplier: 2 | 3;
  /** Which dart of the turn this was (0-based). Redirecting it can make the NEXT number active
   *  retroactively, and the darts thrown after it are the ones that has to be re-read — see
   *  replayDiscardedSingles in lib/turnResolution.ts. Absent for choices created before this
   *  existed (a resumed match), which simply get no replay. */
  dartIndex?: number;
};

/**
 * Drops pending triple/double choices that can't change anything any more: the number they
 * would redirect to is already full (3/3), so "complete the number" adds zero crosses and
 * the dart stays on D/T either way. This happens for real within a single turn — two D19s
 * while 19 sits at 1/3 queue two choices, and answering the first with "complete 19" fills
 * 19, leaving the second question with only one real answer. Worse than merely redundant:
 * answering "complete" there rolls that dart's D cross back and then adds nothing (applyHit
 * caps at 3), silently costing a cross.
 */
export function meaningfulPending(pending: PendingAmbiguous[], progressForPlayer: Progress): PendingAmbiguous[] {
  return pending.filter((p) => progressForPlayer[p.number] < getRules().target);
}

/**
 * Takes one cross back off a step.
 *
 * Deliberately a decrement rather than a restore of the HitRecord's own `prevCount`. Un-parking
 * a triple/double means removing THAT dart's cross, and `prevCount` is only the same thing while
 * nothing else has touched the row since. A later dart in the same turn landing on the same ring
 * — or a second parked dart resolved in the other order — makes the stored number stale, and
 * writing it back either erases a cross that is still in the turn log or restores one that
 * isn't. Both were happening: a bot-vs-bot match drifted by one cross on the T row, in opposite
 * directions for the two players.
 */
export function removeOneCross(count: number): number {
  return Math.max(0, count - 1);
}

export type CrossDelta = { prevCount: number; newCount: number };

/**
 * Chains prevCount->newCount for `crosses` marks on one step, stopping at the cap. A single
 * dart worth several crosses has to stack them in sequence: applying the same delta twice
 * would just re-write the first one.
 */
export function chainCrosses(from: number, crosses: number): CrossDelta[] {
  const deltas: CrossDelta[] = [];
  let count = from;
  for (let i = 0; i < crosses; i++) {
    const next = applyHit(count);
    if (next === count) break;
    deltas.push({ prevCount: count, newCount: next });
    count = next;
  }
  return deltas;
}

/**
 * The parked triple/double that has to give up its ring so a dart can score on `step`.
 *
 * A D/T dart that can score nowhere else is turned away when its row is full — but the row
 * may be full only because an undecided triple/double from earlier in the same turn is still
 * sitting there waiting for the choice at Confirm. Nothing is settled until all three darts
 * are in, so that placeholder must not be what turns a real dart away.
 *
 * Moving the parked one to its number can never cost crosses. It keeps whatever it can score
 * (on the number instead of the ring, or nothing when the number is full too), while the new
 * dart scores where it otherwise would have been discarded outright.
 *
 * The case that surfaced it: 17 on 1/3, T on 2/3, then T17 -> 17 -> T2. The T17 filled T at
 * throw time, so the T2 was thrown away — and 17 was left on 2/3. Freeing the ring closes
 * both rows instead.
 *
 * Not to be confused with the auto-resolve this file used to have, which ran the inference
 * backwards: it read a later plain hit on the number as proof the triple meant to stay on the
 * ring, which is precisely the opposite of what such a throw is worth. That guessed at intent.
 * This one only moves a dart when doing so is free.
 */
export function ambiguousBlockingRing(
  pending: PendingAmbiguous[],
  step: Step,
  progressForPlayer: Progress,
): PendingAmbiguous | null {
  if (step !== "D" && step !== "T") return null;
  if (progressForPlayer[step] < getRules().target) return null;
  // Most recent first: the freshest parked dart is the one whose ring cross is least likely
  // to be the one the player was consciously banking.
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].ringStep === step) return pending[i];
  }
  return null;
}

export type TurnResult = {
  /** Crosses gained this turn, by the step they landed on. */
  hitsByStep: Partial<Record<Step, number>>;
  /** Step the leftover (unregistered) darts this turn are attributed to as misses. */
  missStep: Step | null;
  misses: number;
  /**
   * Darts actually thrown this turn. Usually three, but a turn that wins the leg — or that
   * ends with an early takeout — is shorter, and used to be recorded as three anyway: winning
   * on your first dart cost you two phantom misses and two darts you never threw. Absent on
   * turns logged before this was tracked, hence optional.
   */
  darts?: number;
};

export function emptyProgress(): Progress {
  const p = {} as Progress;
  STEPS.forEach((s) => (p[s] = 0));
  return p;
}

/** The step a player is actively working on: the first row still short of the variant's target
 *  (three crosses in Standard, one in 1 treff — see lib/rules.ts). Null if all done. */
export function currentStepFor(progress: Progress): Step | null {
  const target = getRules().target;
  for (const s of STEPS) {
    if (progress[s] < target) return s;
  }
  return null;
}

/** The step that becomes active right after `step` is completed — null if `step` is the last one (BULL). */
export function nextStepAfter(step: Step): Step | null {
  const i = STEPS.indexOf(step);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

/**
 * Can this step be registered right now for this player?
 * - Number steps and BULL: only on the player's own active step (no pre-banking).
 * - T / D rows: always registrable regardless of active step — a double/triple
 *   can be pre-banked here at any time (rule 1.6).
 */
export function isRegistrable(step: Step, activeStep: Step | null, progress: Progress): boolean {
  if (activeStep === null) return false;
  if (progress[step] >= getRules().target) return false;

  if (step === "T" || step === "D") return true;
  return step === activeStep;
}

/** Every registered hit is worth exactly 1 cross, capped at the variant's target. */
export function applyHit(prevCount: number): number {
  return Math.min(getRules().target, prevCount + 1);
}

export function isFinished(progress: Progress): boolean {
  const target = getRules().target;
  return STEPS.every((s) => progress[s] >= target);
}

/** Crosses a fresh board needs in total — 30 in Standard, 10 in 1 treff. */
export function totalMarks(): number {
  return STEPS.length * getRules().target;
}

/** How many crosses (out of totalMarks across all 10 targets) a player still needs — used to
 *  rank who was "closest to finishing" when a match needs more than a single winner/loser (see
 *  MikkeMusApp's placements-at-match-end for tournament group pods with 3+ players). */
export function remainingMarks(progress: Progress): number {
  const target = getRules().target;
  return STEPS.reduce((sum, s) => sum + (target - Math.min(target, progress[s])), 0);
}

/**
 * Turns a confirmed batch of hits (all from the same turn) into a TurnResult.
 * A triple that lands 3 crosses in one tap counts as 3 treff, not 1 — matching
 * the house rule that treff/bom is measured in crosses, not darts thrown.
 * An empty batch (nothing registered before Confirm) is 3 bom.
 */
export function summarizeTurn(
  hits: HitRecord[],
  activeStepIfEmpty: Step | null,
  dartsThrown: number = DARTS_PER_TURN,
): TurnResult {
  const hitsByStep: Partial<Record<Step, number>> = {};
  let totalHits = 0;
  for (const h of hits) {
    const delta = h.newCount - h.prevCount;
    hitsByStep[h.step] = (hitsByStep[h.step] ?? 0) + delta;
    totalHits += delta;
  }
  // Measured against the darts this turn actually lasted, not a flat three. Crosses still
  // count rather than darts — a triple is three treff from one throw, which is the house rule
  // — so a short turn can end on zero misses, and should: nothing was missed.
  const misses = Math.max(0, dartsThrown - totalHits);
  const missStep = hits.length > 0 ? hits[hits.length - 1].step : activeStepIfEmpty;
  return { hitsByStep, missStep, misses, darts: dartsThrown };
}

/**
 * Steps where the board and the turn log disagree about how many crosses a player has.
 *
 * These are two records of the same thing kept in two places, and they drifted apart for a
 * long time without anyone noticing: the board stayed right, so the game played correctly
 * while every number derived from the log — hit percentage, xH's denominator, the career
 * stats — was quietly wrong. Three separate causes, all found only because one printed figure
 * looked odd. Cheap to check, so it is checked, and the mismatch is reported rather than left
 * to be spotted by eye.
 */
export function progressLogMismatch(
  progressForPlayer: Progress,
  turns: TurnResult[],
  unconfirmed: HitRecord[],
): Array<{ step: Step; board: number; log: number }> {
  const log = {} as Record<Step, number>;
  STEPS.forEach((s) => (log[s] = 0));
  for (const turn of turns) {
    if (!turn) continue;
    for (const [step, count] of Object.entries(turn.hitsByStep) as [Step, number][]) log[step] += count;
  }
  for (const h of unconfirmed) log[h.step] += h.newCount - h.prevCount;
  return STEPS.filter((s) => progressForPlayer[s] !== log[s]).map((s) => ({
    step: s,
    board: progressForPlayer[s],
    log: log[s],
  }));
}

export type TurnAggregate = {
  hitsByStep: Partial<Record<Step, number>>;
  missesByStep: Partial<Record<Step, number>>;
  hits: number;
  misses: number;
  /** Darts actually thrown across these turns — the honest "piler brukt". Not hits + misses:
   *  hits counts crosses, so a triple would inflate it by two darts that were never thrown. */
  darts: number;
};

/** Sums a player's full turn-by-turn log (already de-duplicated by turn index) into totals. */
export function aggregateTurns(turns: TurnResult[]): TurnAggregate {
  const hitsByStep: Partial<Record<Step, number>> = {};
  const missesByStep: Partial<Record<Step, number>> = {};
  let hits = 0;
  let misses = 0;
  let darts = 0;
  for (const turn of turns) {
    // A gap in the array (e.g. an edited/rewound turn whose slot was never filled)
    // surfaces as `undefined` here — for...of walks sparse-array holes, unlike
    // forEach, which would silently skip them. Treat a hole as "no turn recorded".
    if (!turn) continue;
    for (const [step, count] of Object.entries(turn.hitsByStep) as [Step, number][]) {
      hitsByStep[step] = (hitsByStep[step] ?? 0) + count;
      hits += count;
    }
    if (turn.missStep && turn.misses > 0) {
      missesByStep[turn.missStep] = (missesByStep[turn.missStep] ?? 0) + turn.misses;
    }
    misses += turn.misses;
    // Turns logged before darts were tracked fall back to the old flat assumption, which is
    // what they were recorded under — better than counting them as zero.
    darts += turn.darts ?? DARTS_PER_TURN;
  }
  return { hitsByStep, missesByStep, hits, misses, darts };
}
