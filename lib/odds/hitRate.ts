import { emptyProgress } from "../game";
import { finishCdf, stateOf } from "./forward";
import { modelFor, type RuleSet } from "./model";
import { MED_TO_SIGMA } from "./throwModel";

/**
 * How well someone throws, read off how often their darts counted, for matches played without Scolia
 * (which is the only thing that measures distance). A cross rate is much coarser than a distance: a
 * dart's outcome is 0 to 3 crosses, and how much that says about the spread is about a twelfth of what
 * a measured distance says (the variance of a mean distance against the variance of a mean cross rate,
 * per dart, divided by how fast the rate changes with skill). By that they would count for about 0.08 of a measured
 * dart; they count as much (HIT_WEIGHT) all the same, so that someone who mostly plays without Scolia is not read
 * from the few measured matches alone.
 */
export const HIT_WEIGHT = 1;

const MEDS = [14, 18, 23, 29, 36, 45, 56, 70];
type Point = { med: number; rate: number };
const cache = new Map<string, Point[]>();

/** Crosses per dart a thrower of each skill makes over a whole match, from the same model the odds use:
 *  all the crosses the rows need, divided by the darts the model says it takes to finish. */
function table(rules: RuleSet): Point[] {
  const key = `${rules.target}|${rules.ringChoice}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const points = MEDS.map((med) => {
    const model = modelFor(rules, med * MED_TO_SIGMA);
    const cdf = finishCdf({ start: stateOf(model, emptyProgress()), models: [model] });
    let turns = 0;
    for (let t = 0; t < cdf.length - 1; t++) turns += 1 - cdf[t];
    return { med, rate: (10 * rules.target) / (3 * turns) };
  });
  cache.set(key, points);
  return points;
}

/** The mean distance (MED, mm) that makes `rate` crosses per dart, between the table's ends at most. */
export function medFromCrossRate(rate: number, rules: RuleSet): number {
  const pts = table(rules); // the rate falls as the distance grows
  if (rate >= pts[0].rate) return pts[0].med;
  const last = pts[pts.length - 1];
  if (rate <= last.rate) return last.med;
  for (let i = 1; i < pts.length; i++) {
    if (rate >= pts[i].rate) {
      const a = pts[i - 1];
      const b = pts[i];
      const f = (a.rate - rate) / (a.rate - b.rate);
      return Math.exp(Math.log(a.med) + f * (Math.log(b.med) - Math.log(a.med)));
    }
  }
  return last.med;
}
