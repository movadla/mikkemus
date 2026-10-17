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

/**
 * What finishCdf gives, plus how far the side is from finishing at every turn it has not finished
 * by: `rem[t * (K + 1) + k]` is the chance that after t of its own turns it has NOT finished and has
 * k crosses still to get, K being the whole board (10 rows). It is what a margin of victory is made
 * of: when the other side finishes, this is how many crosses this one is short of.
 */
export function finishDetail(args: { start: number; models: Model[]; dartsFirstTurn?: number; maxTurns?: number }): { cdf: Float64Array; rem: Float64Array; K: number } {
  const { start, models } = args;
  const maxTurns = args.maxTurns ?? MAX_TURNS;
  const T = models[0].rules.target;
  const K = 10 * T;
  const size = models[0].size;
  const terminal = models[0].terminal;
  // Crosses still to get from every state: what is left of the numbers, plus D, T and BULL.
  const left = new Int16Array(size).fill(-1);
  for (let ni = 0; ni <= 7; ni++) {
    for (let nc = 0; nc < (ni < 7 ? T : 1); nc++) {
      for (let d = 0; d <= T; d++) for (let t = 0; t <= T; t++) for (let b = 0; b <= T; b++) {
        left[models[0].encode(ni, nc, d, t, b)] = (ni < 7 ? (7 - ni) * T - nc : 0) + (T - d) + (T - t) + (T - b);
      }
    }
  }
  const cdf = new Float64Array(maxTurns + 1);
  const rem = new Float64Array((maxTurns + 1) * (K + 1));
  let cur = new Float64Array(size);
  let nxt = new Float64Array(size);
  cur[start] = 1;
  let active: number[] = [start];
  rem[Math.max(0, left[start]) ] = 1;

  let doneAt = maxTurns;
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
    const base = (turn + 1) * (K + 1);
    for (const id of active) {
      if (id === terminal) continue;
      const m = cur[id];
      if (m > 0 && left[id] >= 0) rem[base + left[id]] += m;
    }
    if (cdf[turn + 1] > 0.999995) {
      for (let t = turn + 2; t <= maxTurns; t++) cdf[t] = 1;
      doneAt = turn + 1;
      break;
    }
  }
  void doneAt;
  return { cdf, rem, K };
}

/**
 * The chance each side wins with the other short by k crosses, for two sides in throwing order.
 * Side j finishing on its own turn t wins, and the side that threw before it has had t − 1 turns when
 * j is first and t turns when j is second (the same rule as raceWinProbs, which this adds up to);
 * it must not have finished, and the crosses it has left are the margin.
 */
export function marginProbs(cdfs: Float64Array[], rems: Float64Array[], K: number): number[][] {
  const horizon = Math.min(cdfs[0].length, cdfs[1].length) - 1;
  const out = [new Array<number>(K + 1).fill(0), new Array<number>(K + 1).fill(0)];
  for (let j = 0; j < 2; j++) {
    const loser = 1 - j;
    for (let t = 1; t <= horizon; t++) {
      const pmf = cdfs[j][t] - cdfs[j][t - 1];
      if (pmf <= 0) continue;
      const turnsLoserHad = j === 0 ? t - 1 : t;
      const base = turnsLoserHad * (K + 1);
      for (let k = 1; k <= K; k++) out[j][k] += pmf * rems[loser][base + k];
    }
  }
  const total = out[0].reduce((a, b) => a + b, 0) + out[1].reduce((a, b) => a + b, 0) || 1;
  return out.map((row) => row.map((v) => v / total));
}
