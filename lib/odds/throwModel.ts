import { aimPointFor, sectorAt } from "../dartboard";
import { parseSector } from "../scoliaMapping";

/**
 * Where a dart of a given spread lands, as probabilities for each kind of result — the same
 * isotropic model the bot is calibrated on (lib/botStrategy.ts): the landing point is the aim plus
 * a Gaussian with standard deviation σ in each direction, and σ = MED·√(2/π) for the mean
 * distance MED the board measures.
 *
 * The bot gets these numbers by throwing 6 000 random darts, so they wobble by half a percent
 * from one run to the next. Odds that moved for no reason between two turns would look broken, so
 * this integrates over a fixed set of points instead: the same points, scaled by σ, every time.
 */
export type Outcomes = {
  sameS: number;
  sameD: number;
  sameT: number;
  otherS: number;
  otherD: number;
  otherT: number;
  bullOuter: number;
  bullInner: number;
  miss: number;
};

export type Profiles = { S: Outcomes; D: Outcomes; T: Outcomes; BULL: Outcomes };

const REFERENCE_NUMBER = 20;
const POINTS = 9000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Unit offsets: radii at the quantiles of a Rayleigh distribution, angles on a golden spiral. */
const OFFSETS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < POINTS; i++) {
    const u = (i + 0.5) / POINTS;
    const r = Math.sqrt(-2 * Math.log(1 - u));
    const a = i * GOLDEN_ANGLE;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
})();

function outcomesFor(aim: [number, number], sigma: number): Outcomes {
  const c = { sameS: 0, sameD: 0, sameT: 0, otherS: 0, otherD: 0, otherT: 0, bullOuter: 0, bullInner: 0, miss: 0 };
  for (const [ox, oy] of OFFSETS) {
    const parsed = parseSector(sectorAt([aim[0] + ox * sigma, aim[1] + oy * sigma]), false);
    if (parsed.kind === "miss") c.miss++;
    else if (parsed.kind === "bull") {
      if (parsed.ring === "inner") c.bullInner++;
      else c.bullOuter++;
    } else {
      const same = parsed.number === REFERENCE_NUMBER;
      if (parsed.ring === "S") c[same ? "sameS" : "otherS"]++;
      else if (parsed.ring === "D") c[same ? "sameD" : "otherD"]++;
      else c[same ? "sameT" : "otherT"]++;
    }
  }
  const out = {} as Outcomes;
  (Object.keys(c) as (keyof typeof c)[]).forEach((k) => (out[k] = c[k] / POINTS));
  return out;
}

const cache = new Map<number, Profiles>();

/** σ is rounded to a quarter of a millimetre, which is far finer than anyone's skill is known. */
export function profilesFor(sigma: number): Profiles {
  const key = Math.round(sigma * 4) / 4;
  const hit = cache.get(key);
  if (hit) return hit;
  const profiles: Profiles = {
    S: outcomesFor(aimPointFor({ ring: "S", number: REFERENCE_NUMBER }), key),
    D: outcomesFor(aimPointFor({ ring: "D", number: REFERENCE_NUMBER }), key),
    T: outcomesFor(aimPointFor({ ring: "T", number: REFERENCE_NUMBER }), key),
    BULL: outcomesFor(aimPointFor({ ring: "BULL" }), key),
  };
  cache.set(key, profiles);
  return profiles;
}

/** σ for a mean distance (mm), and back. */
export const MED_TO_SIGMA = Math.sqrt(2 / Math.PI);
export const sigmaForMed = (med: number): number => med * MED_TO_SIGMA;
