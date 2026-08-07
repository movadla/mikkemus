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

export type TurnResult = {
  /** Crosses gained this turn, by the step they landed on. */
  hitsByStep: Partial<Record<Step, number>>;
  /** Step the leftover (unregistered) darts this turn are attributed to as misses. */
  missStep: Step | null;
  misses: number;
};

export function emptyProgress(): Progress {
  const p = {} as Progress;
  STEPS.forEach((s) => (p[s] = 0));
  return p;
}

/** The step a player is actively working on: first step with < 3 crosses. Null if all done. */
export function currentStepFor(progress: Progress): Step | null {
  for (const s of STEPS) {
    if (progress[s] < 3) return s;
  }
  return null;
}

/**
 * Can this step be registered right now for this player?
 * - Number steps and BULL: only on the player's own active step (no pre-banking).
 * - T / D rows: always registrable regardless of active step — a double/triple
 *   can be pre-banked here at any time (rule 1.6).
 */
export function isRegistrable(step: Step, activeStep: Step | null, progress: Progress): boolean {
  if (activeStep === null) return false;
  if (progress[step] >= 3) return false;

  if (step === "T" || step === "D") return true;
  return step === activeStep;
}

/** Every registered hit is worth exactly 1 cross, capped at 3. */
export function applyHit(prevCount: number): number {
  return Math.min(3, prevCount + 1);
}

export function isFinished(progress: Progress): boolean {
  return STEPS.every((s) => progress[s] >= 3);
}

/**
 * Turns a confirmed batch of hits (all from the same turn) into a TurnResult.
 * A triple that lands 3 crosses in one tap counts as 3 treff, not 1 — matching
 * the house rule that treff/bom is measured in crosses, not darts thrown.
 * An empty batch (nothing registered before Confirm) is 3 bom.
 */
export function summarizeTurn(hits: HitRecord[], activeStepIfEmpty: Step | null): TurnResult {
  const hitsByStep: Partial<Record<Step, number>> = {};
  let totalHits = 0;
  for (const h of hits) {
    const delta = h.newCount - h.prevCount;
    hitsByStep[h.step] = (hitsByStep[h.step] ?? 0) + delta;
    totalHits += delta;
  }
  const misses = Math.max(0, DARTS_PER_TURN - totalHits);
  const missStep = hits.length > 0 ? hits[hits.length - 1].step : activeStepIfEmpty;
  return { hitsByStep, missStep, misses };
}

export type TurnAggregate = {
  hitsByStep: Partial<Record<Step, number>>;
  missesByStep: Partial<Record<Step, number>>;
  hits: number;
  misses: number;
};

/** Sums a player's full turn-by-turn log (already de-duplicated by turn index) into totals. */
export function aggregateTurns(turns: TurnResult[]): TurnAggregate {
  const hitsByStep: Partial<Record<Step, number>> = {};
  const missesByStep: Partial<Record<Step, number>> = {};
  let hits = 0;
  let misses = 0;
  for (const turn of turns) {
    for (const [step, count] of Object.entries(turn.hitsByStep) as [Step, number][]) {
      hitsByStep[step] = (hitsByStep[step] ?? 0) + count;
      hits += count;
    }
    if (turn.missStep && turn.misses > 0) {
      missesByStep[turn.missStep] = (missesByStep[turn.missStep] ?? 0) + turn.misses;
    }
    misses += turn.misses;
  }
  return { hitsByStep, missesByStep, hits, misses };
}
