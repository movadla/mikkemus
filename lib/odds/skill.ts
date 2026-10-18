import { MED_TO_SIGMA } from "./throwModel";

/**
 * How well someone throws, as a spread of possibilities rather than one number.
 *
 * What is known about a thrower is the mean distance (MED) their darts land from the target. A new
 * player has none of it, so the answer starts as the population: around 30 mm, the level the bot
 * code already uses for an unknown human, and anything from the sharpest bot (20 mm) to a beginner
 * (55 mm) is plausible. Each dart measured then moves that toward the player's own figure, and the
 * more darts, the less the starting point matters. The spread that remains is what makes the odds
 * honest: an unknown player against a known one comes out closer to even than their averages say,
 * and a player with a long record is priced sharply.
 *
 * The result is a few equally likely σ values (quantiles of the posterior), and the odds are the
 * average over them — the prediction given what is known, not the prediction at the best guess.
 */
export type Evidence = {
  /** Darts measured, weighted so that recent matches count more (see weighEvidence). */
  n: number;
  /** Their mean distance from the target, in mm. */
  meanR: number;
};

export type SkillNode = { sigma: number };

export const PRIOR_MED = 30;
/** How far apart players are: one standard deviation in log σ. A group of friends is more alike than
 *  the bot's levels (20–55 mm) — until the group's own spread can be measured (see learnPrior). */
export const PRIOR_SD_LOG = 0.22;

export type Prior = { med: number; sdLog: number };
export const DEFAULT_PRIOR: Prior = { med: PRIOR_MED, sdLog: PRIOR_SD_LOG };
export const SCENARIOS = 7;

/**
 * Which of a person's skill nodes a team member plays in scenario `sc`: a different one for each member, so that
 * "everyone is having a good day" is not the only case. The steps are odd numbers, and 7 is prime, so every member
 * runs through all seven nodes; the member where the step would be a multiple of 7 (the fourth, the eleventh) gets
 * the next number instead, or it would sit on the best node in every scenario.
 */
export function nodeIndexFor(sc: number, member: number, length: number): number {
  const step = (2 * member + 1) % SCENARIOS === 0 ? 2 * member + 2 : 2 * member + 1;
  return (sc * step) % length;
}

const GRID = Array.from({ length: 56 }, (_, i) => Math.exp(Math.log(9) + (i / 55) * (Math.log(75) - Math.log(9))));

/** ln of the Rayleigh sample mean's density: the mean of n distances is about normal, with the
 *  mean 1.2533σ and the variance 0.4292σ²/n. */
function logLikelihood(sigma: number, e: Evidence): number {
  if (e.n <= 0) return 0;
  const mean = sigma * Math.sqrt(Math.PI / 2);
  const variance = (0.4292 * sigma * sigma) / e.n;
  return -0.5 * Math.log(variance) - (e.meanR - mean) ** 2 / (2 * variance);
}

/** The σ values the odds are averaged over: equal-probability slices of the posterior. */
export function skillNodes(evidence: Evidence | null, scenarios: number = SCENARIOS, prior: Prior = DEFAULT_PRIOR): SkillNode[] {
  const priorSigma = prior.med * MED_TO_SIGMA;
  const logPost = GRID.map((s) => {
    const lp = -((Math.log(s) - Math.log(priorSigma)) ** 2) / (2 * prior.sdLog ** 2);
    return lp + (evidence ? logLikelihood(s, evidence) : 0);
  });
  const peak = Math.max(...logPost);
  // Weights per grid cell on a log scale (the grid is log-spaced, so each cell is an equal ln-width).
  const w = logPost.map((l) => Math.exp(l - peak));
  const total = w.reduce((a, b) => a + b, 0);
  const cdf: number[] = [];
  let run = 0;
  for (const x of w) {
    run += x / total;
    cdf.push(run);
  }
  const nodes: SkillNode[] = [];
  for (let i = 0; i < scenarios; i++) {
    const q = (i + 0.5) / scenarios;
    let k = cdf.findIndex((c) => c >= q);
    if (k < 0) k = GRID.length - 1;
    // Linear interpolation inside the cell, so a handful of nodes is not a handful of grid points.
    const lo = k === 0 ? 0 : cdf[k - 1];
    const frac = cdf[k] > lo ? (q - lo) / (cdf[k] - lo) : 0.5;
    const a = k === 0 ? GRID[0] : GRID[k - 1];
    nodes.push({ sigma: a + (GRID[k] - a) * frac });
  }
  return nodes;
}

/** A thrower whose spread is known exactly (a bot): the same σ in every scenario. */
export const knownSkill = (sigma: number, scenarios: number = SCENARIOS): SkillNode[] => Array.from({ length: scenarios }, () => ({ sigma }));

/**
 * Evidence from a list of matches, newest last: each is `n` darts measured at mean distance `meanR`.
 * Matches count less the further back they are (halved every `halfLife` matches), so a player who
 * has got better or worse is read as they are now.
 */
export function weighEvidence(matches: { n: number; meanR: number }[], halfLife = 8): Evidence | null {
  let n = 0;
  let sum = 0;
  matches.forEach((m, i) => {
    if (m.n <= 0 || !Number.isFinite(m.meanR)) return;
    const w = Math.pow(0.5, (matches.length - 1 - i) / halfLife);
    n += w * m.n;
    sum += w * m.n * m.meanR;
  });
  return n > 0 ? { n, meanR: sum / n } : null;
}

/** Evidence from two sources taken together (a player's history and the darts of today). */
export function addEvidence(a: Evidence | null, b: Evidence | null): Evidence | null {
  if (!a) return b;
  if (!b) return a;
  const n = a.n + b.n;
  return { n, meanR: (a.meanR * a.n + b.meanR * b.n) / n };
}

/**
 * The group's own starting point, from the players who have thrown enough to be measured: the mean
 * and the spread of their log MED. Fewer than four such players is too few to say anything about the
 * group, and the default stays; with more, the learned figures take over gradually (as if there were
 * four players' worth of default underneath), and the spread is never allowed below 0.12 or above 0.4.
 */
export function learnPrior(players: Evidence[], minDarts = 100): Prior {
  const measured = players.filter((p) => p.n >= minDarts && p.meanR > 0);
  if (measured.length < 4) return DEFAULT_PRIOR;
  const logs = measured.map((p) => Math.log(p.meanR));
  const k = measured.length;
  const mean = logs.reduce((a, b) => a + b, 0) / k;
  const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / (k - 1);
  const w = k / (k + 4);
  const med = Math.exp(w * mean + (1 - w) * Math.log(DEFAULT_PRIOR.med));
  const sd = Math.sqrt(w * variance + (1 - w) * DEFAULT_PRIOR.sdLog ** 2);
  return { med, sdLog: Math.min(0.4, Math.max(0.12, sd)) };
}
