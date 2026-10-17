import { profilesFor, type Outcomes, type Profiles } from "./throwModel";

/**
 * The game as a Markov chain for one thrower: a state is how far through the seven numbers they
 * are (which one, and the crosses on it) plus the crosses on D, T and BULL. This mirrors the
 * model inside lib/botStrategy.ts, written out with integer states so that the distribution of
 * how long a side needs can be pushed forward from ANY position in milliseconds — the bot's own
 * solver builds a table for every position and every number of darts, which takes seconds.
 * (A test holds the two to the same expected number of darts, so they cannot drift apart.)
 *
 * The thrower is assumed to play the efficient policy: at each state the aim that needs the fewest
 * darts on average. That is how the bot plays, and a good player's choice; a worse one costs a
 * little, which the weaker σ the player's own throws show makes up for most of.
 */
export type RuleSet = { target: number; ringChoice: boolean };

export const NUMBER_COUNT = 7;

export type Model = {
  size: number;
  rules: RuleSet;
  /** The state after all rows are closed. */
  terminal: number;
  encode: (numberIndex: number, numberCross: number, d: number, t: number, b: number) => number;
  /** E[darts to finish] from a state, under the efficient policy. */
  expected: Float64Array;
  /** Next states and their probabilities for one dart from a state — a dart that changes nothing is a self-loop. */
  step: (state: number) => { next: Int32Array; prob: Float64Array };
};

type Action = 0 | 1 | 2 | 3 | 4 | 5; // NUMBER, TRIPLE_ACTIVE, DOUBLE_ACTIVE, TRIPLE_OTHER, DOUBLE_OTHER, BULL

const modelCache = new Map<string, Model>();

export function modelFor(rules: RuleSet, sigma: number): Model {
  const key = `${rules.target}|${rules.ringChoice ? 1 : 0}|${Math.round(sigma * 4) / 4}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const m = buildModel(rules, profilesFor(sigma));
  modelCache.set(key, m);
  return m;
}

function buildModel(rules: RuleSet, profiles: Profiles): Model {
  const T = rules.target;
  const W = T + 1;
  const size = (NUMBER_COUNT + 1) * T * W * W * W;
  const encode = (ni: number, nc: number, d: number, t: number, b: number) => ((((ni * T + nc) * W + d) * W + t) * W + b);
  const decode = (id: number) => {
    const b = id % W;
    let r = (id - b) / W;
    const t = r % W;
    r = (r - t) / W;
    const d = r % W;
    r = (r - d) / W;
    const nc = r % T;
    const ni = (r - nc) / T;
    return { ni, nc, d, t, b };
  };
  const terminal = encode(NUMBER_COUNT, 0, T, T, T);

  type S = { ni: number; nc: number; d: number; t: number; b: number };
  const idOf = (s: S) => encode(s.ni, s.nc, s.d, s.t, s.b);
  const withNumber = (s: S, add: number): S => {
    let nc = s.nc + add;
    let ni = s.ni;
    if (nc >= T) {
      ni += 1;
      nc = 0;
    }
    return { ...s, ni, nc };
  };
  const withD = (s: S, add: number): S => ({ ...s, d: Math.min(T, s.d + add) });
  const withT = (s: S, add: number): S => ({ ...s, t: Math.min(T, s.t + add) });
  const withB = (s: S, add: number): S => ({ ...s, b: Math.min(T, s.b + add) });

  const fold = (p: Outcomes): Outcomes => (rules.ringChoice ? p : { ...p, sameD: 0, sameT: 0, otherD: p.otherD + p.sameD, otherT: p.otherT + p.sameT });
  const oneLeft = (s: S) => T - s.nc <= 1;

  const expected = new Float64Array(size).fill(NaN);
  const policy = new Uint8Array(size);
  expected[terminal] = 0;

  const legal = (s: S): Action[] => {
    if (s.ni < NUMBER_COUNT) {
      const a: Action[] = [0, 1, 2];
      if (s.t < T) a.push(3);
      if (s.d < T) a.push(4);
      return a;
    }
    if (s.d < T || s.t < T) {
      const a: Action[] = [];
      if (s.t < T) a.push(3);
      if (s.d < T) a.push(4);
      return a;
    }
    return [5];
  };

  const valueOf = (s: S): number => {
    const id = idOf(s);
    if (id === terminal) return 0;
    const cached = expected[id];
    if (!Number.isNaN(cached)) return cached;
    let best = Infinity;
    let bestAction: Action = 0;
    for (const a of legal(s)) {
      const v = evalAction(s, a);
      if (v < best) {
        best = v;
        bestAction = a;
      }
    }
    expected[id] = best;
    policy[id] = bestAction;
    return best;
  };

  /** Next state for an own-number ring hit: the player decides after seeing the throw — whichever branch is quicker. */
  const ambiguousNext = (s: S, ring: "D" | "T", mult: number): S => {
    const ringCross = ring === "D" ? s.d : s.t;
    const numberBranch = withNumber(s, mult);
    if (ringCross >= T) return numberBranch;
    const ringBranch = ring === "D" ? withD(s, 1) : withT(s, 1);
    if (oneLeft(s)) return ringBranch;
    return valueOf(numberBranch) <= valueOf(ringBranch) ? numberBranch : ringBranch;
  };

  /** The outcomes of one dart at an action: [next state, probability] pairs plus the mass that changes nothing. */
  const outcomes = (s: S, a: Action): { to: [S, number][]; self: number } => {
    const to: [S, number][] = [];
    if (a <= 2) {
      const p = fold(a === 0 ? profiles.S : a === 1 ? profiles.T : profiles.D);
      let self = p.otherS + p.bullOuter + p.bullInner + p.miss;
      to.push([withNumber(s, 1), p.sameS]);
      if (p.sameD > 0) to.push([ambiguousNext(s, "D", 2), p.sameD]);
      if (p.sameT > 0) to.push([ambiguousNext(s, "T", 3), p.sameT]);
      if (s.d < T) to.push([withD(s, 1), p.otherD]);
      else self += p.otherD;
      if (s.t < T) to.push([withT(s, 1), p.otherT]);
      else self += p.otherT;
      return { to, self };
    }
    if (a === 3 || a === 4) {
      const p = a === 3 ? profiles.T : profiles.D;
      const pT = p.sameT + p.otherT;
      const pD = p.sameD + p.otherD;
      let self = 1 - pT - pD;
      if (s.t < T) to.push([withT(s, 1), pT]);
      else self += pT;
      if (s.d < T) to.push([withD(s, 1), pD]);
      else self += pD;
      return { to, self };
    }
    const p = profiles.BULL;
    to.push([withB(s, 2), p.bullInner], [withB(s, 1), p.bullOuter]);
    return { to, self: 1 - p.bullInner - p.bullOuter };
  };

  function evalAction(s: S, a: Action): number {
    const { to, self } = outcomes(s, a);
    let sum = 0;
    for (const [next, p] of to) if (p > 0) sum += p * valueOf(next);
    return (1 + sum) / (1 - self);
  }

  // Every state's value, once — the forward pass below needs the policy of every state it visits.
  for (let ni = 0; ni <= NUMBER_COUNT; ni++) {
    const ncMax = ni < NUMBER_COUNT ? T - 1 : 0;
    for (let nc = 0; nc <= ncMax; nc++) for (let d = 0; d <= T; d++) for (let t = 0; t <= T; t++) for (let b = 0; b <= T; b++) valueOf({ ni, nc, d, t, b });
  }

  const stepCache = new Map<number, { next: Int32Array; prob: Float64Array }>();
  const step = (id: number) => {
    const hit = stepCache.get(id);
    if (hit) return hit;
    let out: { next: Int32Array; prob: Float64Array };
    if (id === terminal) out = { next: Int32Array.of(terminal), prob: Float64Array.of(1) };
    else {
      const s = decode(id);
      const { to, self } = outcomes(s, policy[id] as Action);
      const next: number[] = [];
      const prob: number[] = [];
      let used = 0;
      for (const [n, p] of to) {
        if (p <= 0) continue;
        next.push(idOf(n));
        prob.push(p);
        used += p;
      }
      // The self-loop mass stays where it is. (Computed from the profile, so it equals 1 − used.)
      next.push(id);
      prob.push(Math.max(0, self));
      used += Math.max(0, self);
      out = { next: Int32Array.from(next), prob: Float64Array.from(prob.map((p) => p / used)) };
    }
    stepCache.set(id, out);
    return out;
  };

  return { size, rules, terminal, encode, expected, step };
}
