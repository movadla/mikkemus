import { dartsToFinish } from "./finishState";
import { emptyProgress, type Progress } from "./game";

/**
 * How the chase of a fewest-darts record stands: the record, and how many darts can still be wasted (thrown without
 * counting) before it is out of reach. The fewest darts the rest of the board can take is dartsToFinish, if every dart
 * hit; the record is beaten with one dart fewer than it, so the room that is left is
 *
 *   record − 1 − (darts used + the fewest still needed)
 *
 * and it is negative once the record can no longer be beaten, whatever happens from here.
 */
export type RecordChase = {
  record: number;
  /** Darts that can still be wasted; below 0 means the record is out of reach. */
  slack: number;
  /** The same figure on a fresh board. */
  slackAtStart: number;
  /** What the bar and the figure show: the record minus the darts used, so a fresh board says the whole record and every dart
   *  thrown takes one off. Whether the record can still be beaten is `slack`'s business (red, and «utenfor rekkevidde»). */
  left: number;
};

export function recordChase(record: number | null | undefined, dartsUsed: number, progress: Progress, target: number): RecordChase | null {
  if (!record || record < 1) return null;
  const slackAtStart = record - 1 - dartsToFinish(emptyProgress(), target);
  // A record no one could beat even with every dart perfect has nothing to chase.
  if (slackAtStart < 1) return null;
  return { record, slack: record - 1 - (dartsUsed + dartsToFinish(progress, target)), slackAtStart, left: Math.max(0, record - dartsUsed) };
}

/** How full the bar is, 0–1: the darts left of the record's worth. */
export function chaseFraction(chase: RecordChase): number {
  return Math.max(0, Math.min(1, chase.left / chase.record));
}
