/**
 * Who wins a race to finish, given how many turns each side needs.
 *
 * Sides throw in a fixed order, round after round. Side j, finishing on its own turn t, wins if
 * every side that throws BEFORE it in the round has not finished by turn t (they would have won
 * first), and every side that throws AFTER it has not finished before turn t (if one finishes on
 * its turn t it is later in the round, so j was already done). That is the whole of the starting
 * advantage: no assumption is made about it.
 *
 *   P(j) = Σ_t P(T_j = t) · Π_{k before j} P(T_k > t) · Π_{k after j} P(T_k ≥ t)
 *
 * `cdfs[i][t]` is the chance side i has finished within t of its own turns (index 0 = 0). The
 * sides are independent given how well each throws, which makes this exact.
 */
export function raceWinProbs(cdfs: Float64Array[]): number[] {
  const n = cdfs.length;
  const horizon = Math.min(...cdfs.map((c) => c.length - 1));
  const out = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let t = 1; t <= horizon; t++) {
      const pmf = cdfs[j][t] - cdfs[j][t - 1];
      if (pmf <= 0) continue;
      let p = pmf;
      for (let k = 0; k < n && p > 0; k++) {
        if (k === j) continue;
        p *= k < j ? 1 - cdfs[k][t] : 1 - cdfs[k][t - 1];
      }
      out[j] += p;
    }
  }
  const total = out.reduce((a, b) => a + b, 0) || 1;
  return out.map((p) => p / total);
}
