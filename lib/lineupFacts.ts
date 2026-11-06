import { STEPS, STEP_LABELS, type Step } from "./game";
import type { PlayerRecord } from "./playerRows";

/** The fewest darts a row needs on record before it says anything about how someone throws at it. */
const MIN_DARTS = 8;

/**
 * The matches the two sides have played against each other, from what each has on record, as wins for each. Nothing when they have never met: there is no
 * figure to show, and none is made up. A side with no record of its own (a guest, a bot) is read from the other's.
 */
export function headToHead(a: PlayerRecord | undefined, b: PlayerRecord | undefined, nameA: string, nameB: string): [{ wins: number; played: number }, { wins: number; played: number }] | null {
  const against = (rec: PlayerRecord | undefined, other: string) => (rec?.matchHistory ?? []).filter((m) => m.vs?.includes(other));
  const fromA = against(a, nameB);
  if (fromA.length > 0) {
    const won = fromA.filter((m) => m.won).length;
    return [{ wins: won, played: fromA.length }, { wins: fromA.length - won, played: fromA.length }];
  }
  const fromB = against(b, nameA);
  if (fromB.length > 0) {
    const won = fromB.filter((m) => m.won).length;
    return [{ wins: fromB.length - won, played: fromB.length }, { wins: won, played: fromB.length }];
  }
  return null;
}

/** The row someone hits most often and the one they hit least often, as the labels of the board (20, 19 ... D, T, BULL), from their own record. Nothing until two rows have enough darts. */
export function bestAndWorst(rec: PlayerRecord | undefined): { best: string; worst: string } | null {
  if (!rec) return null;
  const rated = STEPS.map((step: Step) => {
    const s = rec.steps?.[step];
    const n = s ? s.hits + s.misses : 0;
    return { step, n, pct: s && n > 0 ? s.hits / n : 0 };
  }).filter((r) => r.n >= MIN_DARTS);
  if (rated.length < 2) return null;
  const best = rated.reduce((x, y) => (y.pct > x.pct ? y : x));
  const worst = rated.reduce((x, y) => (y.pct < x.pct ? y : x));
  if (best.step === worst.step) return null;
  return { best: STEP_LABELS[best.step], worst: STEP_LABELS[worst.step] };
}
