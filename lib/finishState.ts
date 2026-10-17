import { STEPS, type Progress, type Step } from "./game";

/**
 * How close a board is to being finished, in darts:
 * - «matchdart»: only the bull is missing, and no more than an inner bull (two crosses) can supply — the
 *   last dart of the match is the bull.
 * - «out»: what is missing can be taken with the three darts of one turn, but it is not a match dart: a
 *   double or a triple, two or three on the last number, or a double, a 25 and a bull.
 */
export type FinishState = "matchdart" | "out" | null;

/** Crosses a single dart gives on each kind of row at most: a number takes a triple (3), the D and T rows
 *  one cross a dart, the bull two (an inner bull; the outer 25 is one). */
const NUMBER_STEPS = STEPS.filter((s) => s !== "D" && s !== "T" && s !== "BULL");

/** The fewest darts that could finish the board, if every one of them hit. */
export function dartsToFinish(progress: Progress, target: number): number {
  const missing = (s: Step) => Math.max(0, target - Math.min(target, progress[s] ?? 0));
  let darts = 0;
  for (const s of NUMBER_STEPS) darts += Math.ceil(missing(s) / 3);
  darts += missing("D") + missing("T");
  darts += Math.ceil(missing("BULL") / 2);
  return darts;
}

export function finishState(progress: Progress | undefined, target: number): FinishState {
  if (!progress) return null;
  const missing = (s: Step) => Math.max(0, target - Math.min(target, progress[s] ?? 0));
  const darts = dartsToFinish(progress, target);
  if (darts === 0) return null;
  // Only the bull left, and one dart can finish it.
  const onlyBull = STEPS.every((s) => s === "BULL" || missing(s) === 0);
  if (onlyBull && Math.ceil(missing("BULL") / 2) === 1) return "matchdart";
  return darts <= 3 ? "out" : null;
}
