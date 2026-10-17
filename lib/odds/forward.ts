import { STEPS, type Progress } from "../game";
import { NUMBER_COUNT, type Model } from "./model";

/** The chain state of a board: which number is active, the crosses on it, and the D, T and BULL rows. */
export function stateOf(model: Model, progress: Progress): number {
  const T = model.rules.target;
  let ni = 0;
  while (ni < NUMBER_COUNT && progress[STEPS[ni]] >= T) ni++;
  const nc = ni < NUMBER_COUNT ? progress[STEPS[ni]] : 0;
  return model.encode(ni, nc, Math.min(T, progress.D), Math.min(T, progress.T), Math.min(T, progress.BULL));
}

export const MAX_TURNS = 160;

/**
 * How many of its own turns a side needs, pushed forward from where its board is now.
 *
 * Returns F where F[t] is the chance it has finished within its next t turns (F[0] = 0). The first
 * turn may be a partly played one (`dartsFirstTurn`), and a team has a different thrower — a
 * different spread — each turn: `models[i % models.length]` throws turn i. Finishing mid-turn ends
 * the match, so only the turn counts, never the dart within it.
 */
export function finishCdf(args: { start: number; models: Model[]; dartsFirstTurn?: number; maxTurns?: number }): Float64Array {
  const { start, models } = args;
  const maxTurns = args.maxTurns ?? MAX_TURNS;
  const size = models[0].size;
  const terminal = models[0].terminal;
  const cdf = new Float64Array(maxTurns + 1);
  let cur = new Float64Array(size);
  let nxt = new Float64Array(size);
  cur[start] = 1;
  let active: number[] = [start];

  for (let turn = 0; turn < maxTurns; turn++) {
    const model = models[turn % models.length];
    const darts = turn === 0 ? args.dartsFirstTurn ?? 3 : 3;
    for (let k = 0; k < darts; k++) {
      const touched: number[] = [];
      for (const id of active) {
        const mass = cur[id];
        cur[id] = 0;
        if (mass === 0) continue;
        const { next, prob } = model.step(id);
        for (let i = 0; i < next.length; i++) {
          const to = next[i];
          if (nxt[to] === 0) touched.push(to);
          nxt[to] += mass * prob[i];
        }
      }
      const swap = cur;
      cur = nxt;
      nxt = swap;
      active = touched;
    }
    cdf[turn + 1] = cur[terminal];
    if (cdf[turn + 1] > 0.999995) {
      for (let t = turn + 2; t <= maxTurns; t++) cdf[t] = 1;
      break;
    }
  }
  return cdf;
}
