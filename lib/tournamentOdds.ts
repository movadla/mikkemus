import { fairPrice } from "./bet/ledger";
import { emptyProgress } from "./game";
import { finishCdf, stateOf } from "./odds/forward";
import { modelFor, type RuleSet } from "./odds/model";
import { SCENARIOS } from "./odds/skill";
import { raceWinProbs } from "./odds/winProb";

/**
 * Odds for who wins a small tournament where every side plays three matches. What is unsure about each side
 * (how well they really throw) is carried through, so an unknown player is a real chance of an upset and not a
 * flat average: each simulated tournament draws one of the seven equally likely spreads for every side and
 * keeps it for all their matches. The draw of who plays whom is random each time, so the odds are for the
 * tournament as such and not for one particular draw.
 */
export type Entrant = {
  name: string;
  /** How long the side needs to finish, in turns, for each of the equally likely spreads. */
  cdfs: Float64Array[];
};

/**
 * A side from the spreads of its people: one person for a player, or two or more for a team, who throw a
 * turn each in turn. The members are paired off differently in each scenario (the same way the match odds do
 * it), so "both are having a good day" is not the only case.
 */
export function entrantFromSigmas(name: string, members: number[][], rules: RuleSet): Entrant {
  const cdfs: Float64Array[] = [];
  for (let sc = 0; sc < SCENARIOS; sc++) {
    const models = members.map((sigmas, idx) => modelFor(rules, sigmas[(sc * (2 * idx + 1)) % sigmas.length]));
    cdfs.push(finishCdf({ start: stateOf(models[0], emptyProgress()), models }));
  }
  return { name, cdfs };
}

/** The chance a beats b, for every pair of scenarios (index sa * SCENARIOS + sb), averaged over who throws first. */
function pairChances(a: Entrant, b: Entrant): Float64Array {
  const out = new Float64Array(SCENARIOS * SCENARIOS);
  for (let sa = 0; sa < SCENARIOS; sa++) {
    for (let sb = 0; sb < SCENARIOS; sb++) {
      const ab = raceWinProbs([a.cdfs[sa], b.cdfs[sb]])[0];
      const ba = raceWinProbs([b.cdfs[sb], a.cdfs[sa]])[1];
      out[sa * SCENARIOS + sb] = (ab + ba) / 2;
    }
  }
  return out;
}

/** A small seeded random source, so the same tournament gives the same odds and a test can rely on it. */
export function randomSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(n: number, rng: () => number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Who plays whom when everyone plays three: a ring (each side meets the two beside it) and one match across
 * it, with the places drawn at random. With an even number of sides that is exactly three each. With an odd
 * number it cannot be (three each would be a half match), so one side, drawn at random, plays only two.
 * Needs at least four sides.
 */
export function threeMatchSchedule(n: number, rng: () => number): [number, number][] {
  const order = shuffled(n, rng);
  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) edges.push([order[k], order[(k + 1) % n]]);
  if (n % 2 === 0) {
    for (let k = 0; k < n / 2; k++) edges.push([order[k], order[k + n / 2]]);
  } else {
    const m = (n - 1) / 2;
    // The last in the order has no match across the ring and so plays two.
    for (let k = 0; k < m; k++) edges.push([order[k], order[k + m]]);
  }
  return edges;
}

export type TournamentResult = {
  name: string;
  /** Chance of winning the tournament (0 to 1), and the fair odds on it. */
  win: number;
  odds: number;
  /** Wins on average, and the chance of winning every match. */
  meanWins: number;
  allWins: number;
  /** Matches played: three, or two for the one who sits out a match when the number of sides is odd. */
  matches: number;
};

/**
 * Plays the tournament many times. The winner is the side with the most wins; sides level on top play off
 * against each other in a random order, a side going on while it keeps winning.
 */
export function simulateTournament(entrants: Entrant[], opts: { sims?: number; rng?: () => number } = {}): TournamentResult[] {
  const n = entrants.length;
  if (n < 4) return [];
  const sims = opts.sims ?? 20000;
  const rng = opts.rng ?? randomSource(1);
  // chance[i][j]: i beats j, for every pair of scenarios; stored for i < j only.
  const chance: Float64Array[][] = Array.from({ length: n }, () => new Array<Float64Array>(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) chance[i][j] = pairChances(entrants[i], entrants[j]);
  const beats = (i: number, j: number, si: number, sj: number): number => (i < j ? chance[i][j][si * SCENARIOS + sj] : 1 - chance[j][i][sj * SCENARIOS + si]);

  const winCount = new Float64Array(n);
  const sumWins = new Float64Array(n);
  const sweeps = new Float64Array(n);
  const played = new Float64Array(n);
  const scen = new Array<number>(n);
  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < n; i++) scen[i] = Math.floor(rng() * SCENARIOS);
    const wins = new Array<number>(n).fill(0);
    const plays = new Array<number>(n).fill(0);
    for (const [a, b] of threeMatchSchedule(n, rng)) {
      plays[a]++;
      plays[b]++;
      if (rng() < beats(a, b, scen[a], scen[b])) wins[a]++;
      else wins[b]++;
    }
    const top = Math.max(...wins);
    const leaders = wins.map((w, i) => (w === top ? i : -1)).filter((i) => i >= 0);
    let champion = leaders[0];
    if (leaders.length > 1) {
      const order = shuffled(leaders.length, rng).map((k) => leaders[k]);
      champion = order[0];
      for (let k = 1; k < order.length; k++) if (rng() >= beats(champion, order[k], scen[champion], scen[order[k]])) champion = order[k];
    }
    winCount[champion]++;
    for (let i = 0; i < n; i++) {
      sumWins[i] += wins[i];
      played[i] = Math.max(played[i], plays[i]);
      if (plays[i] > 0 && wins[i] === plays[i]) sweeps[i]++;
    }
  }
  return entrants
    .map((e, i) => ({ name: e.name, win: winCount[i] / sims, odds: fairPrice(winCount[i] / sims), meanWins: sumWins[i] / sims, allWins: sweeps[i] / sims, matches: played[i] }))
    .sort((x, y) => y.win - x.win || x.name.localeCompare(y.name, "no"));
}
