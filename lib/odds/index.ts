import type { Progress } from "../game";
import { finishCdf, finishDetail, marginProbs, stateOf } from "./forward";
import { modelFor, type RuleSet } from "./model";
import { priceOutcomes, type Priced } from "./price";
import type { SkillNode } from "./skill";
import { SCENARIOS } from "./skill";
import { raceWinProbs } from "./winProb";

/** Someone who throws for a side: their name and what is known about how well they throw. */
export type OddsMember = { name: string; skill: SkillNode[] };

/** One side of the match — a player (one member) or a team (several, throwing a turn each in turn). */
export type OddsSide = {
  name: string;
  progress: Progress;
  members: OddsMember[];
  /** Which member throws this side's next turn. */
  nextMember: number;
};

export type OddsInput = {
  rules: RuleSet;
  /** In throwing order, the side that throws next first. */
  sides: OddsSide[];
  /** Darts left in the first side's turn (3 at a turn boundary). */
  dartsLeft?: number;
};

export type SideOdds = Priced & {
  name: string;
  /** The 10th and 90th percentile of the win chance over what is unknown about the throwers. */
  lo: number;
  hi: number;
  /** With two sides: the chance of winning with the other short by k crosses, at index k (0 unused). */
  margin?: number[];
};

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

/**
 * The chance of each side winning, and the price, from the board as it stands.
 *
 * For each scenario of how well a side throws (`SCENARIOS` of them, drawn from what is known about
 * each member), the distribution of the turns it needs is pushed forward from its position; the
 * race formula turns the sides' distributions into who wins; and the answer is the average over
 * every combination of scenarios. The members of a team are paired off differently in each
 * scenario, so that "both are having a good day" is not the only case in the average.
 */
export function computeOdds(input: OddsInput): SideOdds[] {
  const { rules, sides } = input;
  const scenarios = Math.min(SCENARIOS, ...sides.flatMap((s) => s.members.map((m) => m.skill.length)));

  // With exactly two sides, how short the loser is when the winner finishes is priced too.
  const withMargin = sides.length === 2;
  const rems: Float64Array[][] = sides.map(() => []);
  let marginK = 0;

  // cdfs[side][scenario]
  const cdfs = sides.map((side, si) => {
    const list: Float64Array[] = [];
    for (let sc = 0; sc < scenarios; sc++) {
      const models = side.members.map((_, i) => {
        const idx = (side.nextMember + i) % side.members.length;
        const m = side.members[idx];
        // A different node per member, so the two are not always good or bad together (7 is prime).
        const node = m.skill[(sc * (2 * idx + 1)) % m.skill.length];
        return modelFor(rules, node.sigma);
      });
      const start = stateOf(models[0], side.progress);
      if (withMargin) {
        const d = finishDetail({ start, models, dartsFirstTurn: input.dartsLeft ?? 3 });
        marginK = d.K;
        rems[si].push(d.rem);
        list.push(d.cdf);
      } else list.push(finishCdf({ start, models, dartsFirstTurn: input.dartsLeft ?? 3 }));
    }
    return list;
  });

  // Every combination of one scenario per side.
  const n = sides.length;
  const results: number[][] = Array.from({ length: n }, () => []);
  const marginSum = withMargin ? [new Array<number>(marginK + 1).fill(0), new Array<number>(marginK + 1).fill(0)] : null;
  let combos = 0;
  const idx = new Array<number>(n).fill(0);
  for (;;) {
    const p = raceWinProbs(idx.map((sc, i) => cdfs[i][sc]));
    p.forEach((v, i) => results[i].push(v));
    if (marginSum) {
      const m = marginProbs(idx.map((sc, i) => cdfs[i][sc]), idx.map((sc, i) => rems[i][sc]), marginK);
      m.forEach((row, i) => row.forEach((v, k) => (marginSum[i][k] += v)));
      combos++;
    }
    let k = n - 1;
    while (k >= 0 && ++idx[k] === scenarios) idx[k--] = 0;
    if (k < 0) break;
  }

  const means = results.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
  const bands = results.map((r) => {
    const sorted = [...r].sort((a, b) => a - b);
    return { lo: quantile(sorted, 0.1), hi: quantile(sorted, 0.9) };
  });
  const priced = priceOutcomes(means, bands.map((b) => b.hi - b.lo));
  return sides.map((s, i) => ({ name: s.name, ...priced[i], lo: bands[i].lo, hi: bands[i].hi, ...(marginSum ? { margin: marginSum[i].map((v) => v / combos) } : {}) }));
}
