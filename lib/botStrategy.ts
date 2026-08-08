import { aimPointFor, sectorAt } from "./dartboard";
import { STEPS, type PlayerProgress, type Progress, type Step } from "./game";
import { parseSector } from "./scoliaMapping";
import { BOT_LEVELS, type BotLevel } from "./botLevels";

// The seven numbers this game's number-phase steps track, in the order the
// player must clear them — mirrors STEPS' own 20..14 prefix (see lib/game.ts).
const NUMBERS = STEPS.slice(0, 7) as readonly Step[];

/**
 * The bot's view of a match: how far through the number sequence it is, plus
 * independent D/T/BULL progress. Numbers 20..14 always complete strictly in
 * order (see isRegistrable in lib/game.ts), so — unlike the real Progress
 * record — only the *current* number's cross count needs tracking; every
 * earlier number is implicitly done and every later one untouched.
 */
type BotState = {
  /** Index into NUMBERS of the active number, or 7 once all seven are done. */
  numberIndex: number;
  /** Crosses on the active number (0-2; meaningless once numberIndex === 7). */
  numberCross: number;
  dCross: number;
  tCross: number;
  bullCross: number;
};

/** Exported for calibration/scenario checks. */
export function progressToBotState(progress: Progress): BotState {
  let numberIndex = 0;
  while (numberIndex < NUMBERS.length && progress[NUMBERS[numberIndex]] >= 3) numberIndex++;
  const numberCross = numberIndex < NUMBERS.length ? progress[NUMBERS[numberIndex]] : 0;
  return { numberIndex, numberCross, dCross: progress.D, tCross: progress.T, bullCross: progress.BULL };
}

function isTerminal(s: BotState): boolean {
  return s.numberIndex === NUMBERS.length && s.dCross === 3 && s.tCross === 3 && s.bullCross === 3;
}

function stateKey(s: BotState): string {
  return `${s.numberIndex}|${s.numberCross}|${s.dCross}|${s.tCross}|${s.bullCross}`;
}

/** Every valid (non-terminal) state, enumerated once and shared across every level's solver —
 *  the state space itself doesn't depend on skill, only the transition probabilities do. */
let cachedAllStates: BotState[] | null = null;
function allStates(): BotState[] {
  if (cachedAllStates) return cachedAllStates;
  const states: BotState[] = [];
  for (let numberIndex = 0; numberIndex <= NUMBERS.length; numberIndex++) {
    const numberCrossMax = numberIndex < NUMBERS.length ? 2 : 0;
    for (let numberCross = 0; numberCross <= numberCrossMax; numberCross++) {
      for (let dCross = 0; dCross <= 3; dCross++) {
        for (let tCross = 0; tCross <= 3; tCross++) {
          for (let bullCross = 0; bullCross <= 3; bullCross++) {
            const s = { numberIndex, numberCross, dCross, tCross, bullCross };
            if (!isTerminal(s)) states.push(s);
          }
        }
      }
    }
  }
  cachedAllStates = states;
  return states;
}

/**
 * The seven aim choices the bot can make on any given dart. *_ACTIVE targets the
 * number the player is currently working through — a triple/double there carries
 * the same "keep on the ring or redirect to the number" choice a real throw does.
 * *_OTHER deliberately throws at a double/triple away from the active number —
 * pre-banking D/T progress while it's not otherwise under time pressure, exactly
 * the tactic the bot is meant to weigh (see plan discussion: doubles/triples are
 * harder, so banking them opportunistically while numbers remain can pay off).
 */
export type BotAction = "NUMBER" | "TRIPLE_ACTIVE" | "DOUBLE_ACTIVE" | "TRIPLE_OTHER" | "DOUBLE_OTHER" | "BULL";

/**
 * Outcome distribution for a dart aimed at one canonical target (a specific ring,
 * always thrown at a fixed reference number so the profile is reusable for every
 * number by the board's rotational symmetry — see monteCarloProfile). "same"
 * means the outcome landed on the aimed-at number; "other" means some other one.
 */
type OutcomeProbs = {
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

const REFERENCE_NUMBER = 20;
const MC_SAMPLES = 6000;

function gaussianSample(sigma: number): number {
  // Box-Muller — independent draws per axis, matching the isotropic dispersion
  // model the calibrated levels use (see sigmaForLevel below).
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** For an isotropic 2D throw with per-axis Gaussian sigma, the Euclidean miss
 *  distance follows a Rayleigh distribution with mean sigma·√(π/2) — the same MED
 *  statistic real players are judged on (see lib/dartboard.ts's throwAccuracy and
 *  lib/storage.ts's meanEuclideanDistance). Inverting gives an exact, closed-form
 *  sigma for a target MED — no simulation/search needed, and it holds regardless
 *  of what point the bot is aiming at each dart. */
const MED_TO_SIGMA = Math.sqrt(2 / Math.PI);

/** A level's calibrated throw dispersion — exact, not cached (cheap to recompute). */
export function sigmaForLevel(level: BotLevel): number {
  return BOT_LEVELS[level].targetMed * MED_TO_SIGMA;
}

function monteCarloProfile(aim: [number, number], sigma: number): OutcomeProbs {
  const counts = {
    sameS: 0,
    sameD: 0,
    sameT: 0,
    otherS: 0,
    otherD: 0,
    otherT: 0,
    bullOuter: 0,
    bullInner: 0,
    miss: 0,
  };
  for (let i = 0; i < MC_SAMPLES; i++) {
    const point: [number, number] = [aim[0] + gaussianSample(sigma), aim[1] + gaussianSample(sigma)];
    const parsed = parseSector(sectorAt(point), false);
    if (parsed.kind === "miss") {
      counts.miss++;
    } else if (parsed.kind === "bull") {
      if (parsed.ring === "inner") counts.bullInner++;
      else counts.bullOuter++;
    } else {
      const same = parsed.number === REFERENCE_NUMBER;
      if (parsed.ring === "S") counts[same ? "sameS" : "otherS"]++;
      else if (parsed.ring === "D") counts[same ? "sameD" : "otherD"]++;
      else counts[same ? "sameT" : "otherT"]++;
    }
  }
  const out = {} as OutcomeProbs;
  (Object.keys(counts) as (keyof typeof counts)[]).forEach((k) => {
    out[k] = counts[k] / MC_SAMPLES;
  });
  return out;
}

type LevelProfiles = { S: OutcomeProbs; D: OutcomeProbs; T: OutcomeProbs; BULL: OutcomeProbs };

const profileCache = new Map<BotLevel, LevelProfiles>();

function profilesFor(level: BotLevel): LevelProfiles {
  const cached = profileCache.get(level);
  if (cached) return cached;
  const sigma = sigmaForLevel(level);
  const profiles: LevelProfiles = {
    S: monteCarloProfile(aimPointFor({ ring: "S", number: REFERENCE_NUMBER }), sigma),
    D: monteCarloProfile(aimPointFor({ ring: "D", number: REFERENCE_NUMBER }), sigma),
    T: monteCarloProfile(aimPointFor({ ring: "T", number: REFERENCE_NUMBER }), sigma),
    BULL: monteCarloProfile(aimPointFor({ ring: "BULL" }), sigma),
  };
  profileCache.set(level, profiles);
  return profiles;
}

/** How many additional darts ahead the finish-probability table looks — see probFinishWithin.
 *  Sized generously above the weakest level's typical darts-to-finish (~300 on average, with a
 *  long tail for poor accuracy) so a close race against it doesn't saturate the table. */
const D_MAX = 700;

type Solver = {
  /** Expectation-minimizing choice — ignores the race, just plays efficiently. */
  bestAction(state: BotState): BotAction;
  /** Whether redirecting to the number beats staying on the ring, for a ring/multiplier
   *  ambiguity arising from `state` (the state *before* this dart was thrown). */
  shouldRedirect(state: BotState, ring: "D" | "T", multiplier: 2 | 3): boolean;
  /** Expected additional darts to finish from `state`, playing the safe policy throughout. */
  expectedRemaining(state: BotState): number;
  /** Probability of finishing within `d` more darts, assuming the safe policy resumes
   *  after whatever choice led here. Used to score the current dart's options when racing. */
  probFinishWithin(state: BotState, d: number): number;
  /** Race-aware choice: maximizes the chance of finishing within `budget` more darts,
   *  rather than minimizing the expected count — a deliberate gamble when behind. */
  bestActionUnderBudget(state: BotState, budget: number): BotAction;
  /** Race-aware version of shouldRedirect — favors whichever branch is more likely to
   *  finish within `budget`, rather than whichever has the lower expectation. */
  shouldRedirectUnderBudget(state: BotState, ring: "D" | "T", multiplier: 2 | 3, budget: number): boolean;
};

const solverCache = new Map<BotLevel, Solver>();

function buildSolver(profiles: LevelProfiles): Solver {
  const memo = new Map<string, number>();
  const actionMemo = new Map<string, BotAction>();

  function withNumberCross(s: BotState, add: number): BotState {
    let numberCross = s.numberCross + add;
    let numberIndex = s.numberIndex;
    if (numberCross >= 3) {
      numberIndex += 1;
      numberCross = 0;
    }
    return { ...s, numberIndex, numberCross };
  }
  const withD = (s: BotState, add: number): BotState => ({ ...s, dCross: Math.min(3, s.dCross + add) });
  const withT = (s: BotState, add: number): BotState => ({ ...s, tCross: Math.min(3, s.tCross + add) });
  const withBull = (s: BotState, add: number): BotState => ({ ...s, bullCross: Math.min(3, s.bullCross + add) });

  function legalActions(s: BotState): BotAction[] {
    if (s.numberIndex < NUMBERS.length) {
      const actions: BotAction[] = ["NUMBER", "TRIPLE_ACTIVE", "DOUBLE_ACTIVE"];
      if (s.tCross < 3) actions.push("TRIPLE_OTHER");
      if (s.dCross < 3) actions.push("DOUBLE_OTHER");
      return actions;
    }
    if (s.dCross < 3 || s.tCross < 3) {
      const actions: BotAction[] = [];
      if (s.tCross < 3) actions.push("TRIPLE_OTHER");
      if (s.dCross < 3) actions.push("DOUBLE_OTHER");
      return actions;
    }
    return ["BULL"];
  }

  /**
   * The action set the race-aware ("gambling") policy is allowed to pick from —
   * deliberately narrower than legalActions: while a number is still active, it
   * never jumps to a *different* number's triple/double (TRIPLE_OTHER/DOUBLE_OTHER
   * pre-banking is a steady-play optimization, not a gamble). Behind, the bot should
   * throw harder at the number it's already on, not skip around the board — see
   * botChooseThrow's doc comment. Once no number is active, there's nothing to
   * "stay on", so it falls back to the normal legal set (just D/T/BULL by then).
   */
  function gambleActions(s: BotState): BotAction[] {
    if (s.numberIndex < NUMBERS.length) return ["NUMBER", "TRIPLE_ACTIVE", "DOUBLE_ACTIVE"];
    return legalActions(s);
  }

  // ---- Expectation (safe) DP — minimizes E[darts remaining] ----

  /** Expected value of an ambiguous triple/double hit on the active number — the bot
   *  always resolves it toward whichever branch leaves fewer expected darts, matching
   *  a player who's allowed to choose after seeing the throw land (see resolvePendingChoice). */
  function ambiguousValue(s: BotState, ring: "D" | "T", multiplier: number): number {
    const ringCross = ring === "D" ? s.dCross : s.tCross;
    const numberBranch = evaluate(withNumberCross(s, multiplier));
    if (ringCross >= 3) return numberBranch; // ring already full — redirect is forced, matches classifyThrow
    const ringBranch = evaluate(ring === "D" ? withD(s, 1) : withT(s, 1));
    return Math.min(numberBranch, ringBranch);
  }

  function ambiguousRedirects(s: BotState, ring: "D" | "T", multiplier: number): boolean {
    const ringCross = ring === "D" ? s.dCross : s.tCross;
    if (ringCross >= 3) return true;
    const numberBranch = evaluate(withNumberCross(s, multiplier));
    const ringBranch = evaluate(ring === "D" ? withD(s, 1) : withT(s, 1));
    return numberBranch <= ringBranch;
  }

  /**
   * E[darts remaining] for taking `action` at state `s`. The dart's "did nothing"
   * outcomes (selfLoopProb) are removed algebraically — E = (1 + Σ p·E(next)) /
   * (1 - selfLoopProb) — rather than recursing into E(s) itself, since every
   * non-self-loop transition strictly progresses toward the terminal state and a
   * naive self-referential recursion would never bottom out.
   */
  function evalAction(s: BotState, action: BotAction): number {
    if (action === "NUMBER" || action === "TRIPLE_ACTIVE" || action === "DOUBLE_ACTIVE") {
      const p = action === "NUMBER" ? profiles.S : action === "TRIPLE_ACTIVE" ? profiles.T : profiles.D;
      let selfLoop = p.otherS + p.bullOuter + p.bullInner + p.miss;
      let sum = p.sameS * evaluate(withNumberCross(s, 1)) + p.sameD * ambiguousValue(s, "D", 2) + p.sameT * ambiguousValue(s, "T", 3);
      // otherD/otherT drift onto a ring that's already capped changes nothing —
      // that probability mass is a self-loop too, not a (no-op) "transition".
      if (s.dCross < 3) sum += p.otherD * evaluate(withD(s, 1));
      else selfLoop += p.otherD;
      if (s.tCross < 3) sum += p.otherT * evaluate(withT(s, 1));
      else selfLoop += p.otherT;
      return (1 + sum) / (1 - selfLoop);
    }
    if (action === "TRIPLE_OTHER" || action === "DOUBLE_OTHER") {
      const p = action === "TRIPLE_OTHER" ? profiles.T : profiles.D;
      const pT = p.sameT + p.otherT;
      const pD = p.sameD + p.otherD;
      let selfLoop = 1 - pT - pD;
      let sum = 0;
      if (s.tCross < 3) sum += pT * evaluate(withT(s, 1));
      else selfLoop += pT;
      if (s.dCross < 3) sum += pD * evaluate(withD(s, 1));
      else selfLoop += pD;
      return (1 + sum) / (1 - selfLoop);
    }
    // BULL — bullCross is always < 3 here (legalActions only offers BULL once
    // numberIndex/D/T are all done and the state isn't already terminal).
    const p = profiles.BULL;
    const selfLoop = 1 - p.bullInner - p.bullOuter;
    const sum = p.bullInner * evaluate(withBull(s, 2)) + p.bullOuter * evaluate(withBull(s, 1));
    return (1 + sum) / (1 - selfLoop);
  }

  function evaluate(s: BotState): number {
    if (isTerminal(s)) return 0;
    const key = stateKey(s);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = Infinity;
    let bestAction: BotAction = "NUMBER";
    for (const action of legalActions(s)) {
      const value = evalAction(s, action);
      if (value < best) {
        best = value;
        bestAction = action;
      }
    }
    memo.set(key, best);
    actionMemo.set(key, bestAction);
    return best;
  }

  // Fully populate memo/actionMemo for every reachable state up front — Part 2's
  // finish-distribution table below needs every state's fixed safe action already known.
  allStates().forEach((s) => evaluate(s));

  // ---- Finish-distribution table — P(finish within d more darts) under the safe policy ----

  /** Same outcome-probability structure evalAction uses, generalized to score any
   *  `action` (not just the state's fixed safe one) against any continuation value
   *  `V` — shared by the table-building pass below (V = previous d-1 layer) and by
   *  the live "under budget" decision (V = probFinishWithin at the race's budget). */
  function ambiguousProb(s: BotState, ring: "D" | "T", multiplier: number, V: (s: BotState) => number): number {
    const ringCross = ring === "D" ? s.dCross : s.tCross;
    const numberNext = withNumberCross(s, multiplier);
    const numberProb = isTerminal(numberNext) ? 1 : V(numberNext);
    if (ringCross >= 3) return numberProb; // forced redirect, matches ambiguousValue/classifyThrow
    const ringNext = ring === "D" ? withD(s, 1) : withT(s, 1);
    const ringProb = isTerminal(ringNext) ? 1 : V(ringNext);
    return Math.max(numberProb, ringProb);
  }

  function actionFinishProb(s: BotState, action: BotAction, V: (s: BotState) => number): number {
    if (action === "NUMBER" || action === "TRIPLE_ACTIVE" || action === "DOUBLE_ACTIVE") {
      const p = action === "NUMBER" ? profiles.S : action === "TRIPLE_ACTIVE" ? profiles.T : profiles.D;
      const sameSNext = withNumberCross(s, 1);
      let total = p.sameS * (isTerminal(sameSNext) ? 1 : V(sameSNext));
      total += p.sameD * ambiguousProb(s, "D", 2, V);
      total += p.sameT * ambiguousProb(s, "T", 3, V);
      if (s.dCross < 3) {
        const n = withD(s, 1);
        total += p.otherD * (isTerminal(n) ? 1 : V(n));
      } else {
        total += p.otherD * V(s);
      }
      if (s.tCross < 3) {
        const n = withT(s, 1);
        total += p.otherT * (isTerminal(n) ? 1 : V(n));
      } else {
        total += p.otherT * V(s);
      }
      const selfLoopMass = p.otherS + p.bullOuter + p.bullInner + p.miss;
      return total + selfLoopMass * V(s);
    }
    if (action === "TRIPLE_OTHER" || action === "DOUBLE_OTHER") {
      const p = action === "TRIPLE_OTHER" ? profiles.T : profiles.D;
      const pT = p.sameT + p.otherT;
      const pD = p.sameD + p.otherD;
      let total = 0;
      if (s.tCross < 3) {
        const n = withT(s, 1);
        total += pT * (isTerminal(n) ? 1 : V(n));
      } else {
        total += pT * V(s);
      }
      if (s.dCross < 3) {
        const n = withD(s, 1);
        total += pD * (isTerminal(n) ? 1 : V(n));
      } else {
        total += pD * V(s);
      }
      const selfLoopMass = 1 - pT - pD;
      return total + selfLoopMass * V(s);
    }
    // BULL
    const p = profiles.BULL;
    const innerNext = withBull(s, 2);
    const outerNext = withBull(s, 1);
    let total = p.bullInner * (isTerminal(innerNext) ? 1 : V(innerNext));
    total += p.bullOuter * (isTerminal(outerNext) ? 1 : V(outerNext));
    const selfLoopMass = 1 - p.bullInner - p.bullOuter;
    return total + selfLoopMass * V(s);
  }

  const states = allStates();
  const pFinishBy = new Map<string, Float64Array>();
  states.forEach((s) => pFinishBy.set(stateKey(s), new Float64Array(D_MAX + 1)));

  for (let d = 1; d <= D_MAX; d++) {
    const prevLayer = d - 1;
    const V = (s: BotState): number => pFinishBy.get(stateKey(s))![prevLayer];
    for (const s of states) {
      const action = actionMemo.get(stateKey(s))!;
      pFinishBy.get(stateKey(s))![d] = actionFinishProb(s, action, V);
    }
  }

  function probFinishWithin(s: BotState, d: number): number {
    if (isTerminal(s)) return 1;
    const clamped = Math.max(0, Math.min(D_MAX, Math.round(d)));
    return pFinishBy.get(stateKey(s))![clamped];
  }

  // ---- Race-aware ("gambling") decision — maximizes P(finish within budget) ----

  function bestActionUnderBudget(s: BotState, budget: number): BotAction {
    const V = (s2: BotState) => probFinishWithin(s2, budget - 1);
    let best = -Infinity;
    let bestAction: BotAction = "NUMBER";
    for (const action of gambleActions(s)) {
      const value = actionFinishProb(s, action, V);
      if (value > best) {
        best = value;
        bestAction = action;
      }
    }
    return bestAction;
  }

  function shouldRedirectUnderBudget(s: BotState, ring: "D" | "T", multiplier: number, budget: number): boolean {
    const ringCross = ring === "D" ? s.dCross : s.tCross;
    if (ringCross >= 3) return true;
    const V = (s2: BotState) => probFinishWithin(s2, budget - 1);
    const numberNext = withNumberCross(s, multiplier);
    const numberProb = isTerminal(numberNext) ? 1 : V(numberNext);
    const ringNext = ring === "D" ? withD(s, 1) : withT(s, 1);
    const ringProb = isTerminal(ringNext) ? 1 : V(ringNext);
    return numberProb >= ringProb;
  }

  return {
    bestAction(s: BotState): BotAction {
      evaluate(s);
      return actionMemo.get(stateKey(s))!;
    },
    shouldRedirect(s: BotState, ring: "D" | "T", multiplier: 2 | 3): boolean {
      return ambiguousRedirects(s, ring, multiplier);
    },
    expectedRemaining(s: BotState): number {
      return evaluate(s);
    },
    probFinishWithin(s: BotState, d: number): number {
      return probFinishWithin(s, d);
    },
    bestActionUnderBudget(s: BotState, budget: number): BotAction {
      return bestActionUnderBudget(s, budget);
    },
    shouldRedirectUnderBudget(s: BotState, ring: "D" | "T", multiplier: 2 | 3, budget: number): boolean {
      return shouldRedirectUnderBudget(s, ring, multiplier, budget);
    },
  };
}

/** Exported for calibration/scenario checks — not used by the app's own call sites,
 *  which go through botChooseThrow/botDecideRedirect instead. */
export function solverFor(level: BotLevel): Solver {
  const cached = solverCache.get(level);
  if (cached) return cached;
  const solver = buildSolver(profilesFor(level));
  solverCache.set(level, solver);
  return solver;
}

function otherNumber(activeNumber: number | null): number {
  return activeNumber === REFERENCE_NUMBER ? REFERENCE_NUMBER - 1 : REFERENCE_NUMBER;
}

function aimPointForAction(action: BotAction, activeNumber: number | null): [number, number] {
  switch (action) {
    case "NUMBER":
      return aimPointFor({ ring: "S", number: activeNumber! });
    case "TRIPLE_ACTIVE":
      return aimPointFor({ ring: "T", number: activeNumber! });
    case "DOUBLE_ACTIVE":
      return aimPointFor({ ring: "D", number: activeNumber! });
    case "TRIPLE_OTHER":
      return aimPointFor({ ring: "T", number: otherNumber(activeNumber) });
    case "DOUBLE_OTHER":
      return aimPointFor({ ring: "D", number: otherNumber(activeNumber) });
    case "BULL":
      return aimPointFor({ ring: "BULL" });
  }
}

/** When a bot's opponent is a real human, their true skill is unknown — assume they
 *  play about like level 3 ("Dave"), the user's own self-assessed level, rather than
 *  mirroring the deciding bot's own (possibly very different) skill. */
export const DEFAULT_HUMAN_PROXY_LEVEL: BotLevel = "3";

/** Only switch to gambling once meaningfully behind — avoids twitchy swings between
 *  the safe and race-aware policies when the race isn't actually close. */
const GAMBLE_MARGIN = 1.15;

/**
 * The fewest expected additional darts any *other* player at the table needs to
 * finish, estimated from their current progress — the "budget" a bot compares its
 * own expected remaining darts against to decide whether to gamble. Null with no
 * other players (solo practice), in which case a bot should always play safe.
 */
function estimateOpponentBudget(
  allProgress: PlayerProgress,
  activePlayer: string,
  botLevels: Record<string, BotLevel>
): number | null {
  let best: number | null = null;
  for (const name of Object.keys(allProgress)) {
    if (name === activePlayer) continue;
    const proxyLevel = botLevels[name] ?? DEFAULT_HUMAN_PROXY_LEVEL;
    const estimate = solverFor(proxyLevel).expectedRemaining(progressToBotState(allProgress[name]));
    if (best === null || estimate < best) best = estimate;
  }
  return best;
}

/**
 * Picks the bot's aim for its next dart and simulates where it lands. Ordinarily
 * this just plays the expectation-minimizing safe policy — but if the bot's own
 * expected remaining darts are meaningfully worse than its closest opponent's
 * estimated remaining darts, it switches to the race-aware policy instead: throw
 * harder at whichever number it's already on (favoring that number's own triple/
 * double over the safe single) for the best chance of a fast finish, even at the
 * cost of a worse average outcome. Deliberately narrower than the safe policy's
 * full repertoire — it never skips ahead to a *different* number's triple/double
 * (see gambleActions inside buildSolver); that's a steady-play optimization, not
 * a gamble. The caller scores the result through the exact same sectorAt/
 * parseSector pipeline a real Scolia throw goes through — this only supplies the
 * coordinate.
 */
export function botChooseThrow(
  level: BotLevel,
  allProgress: PlayerProgress,
  activePlayer: string,
  botLevels: Record<string, BotLevel>
): [number, number] {
  const state = progressToBotState(allProgress[activePlayer]);
  const solver = solverFor(level);
  const oppBudget = estimateOpponentBudget(allProgress, activePlayer, botLevels);
  const myE = solver.expectedRemaining(state);
  const action =
    oppBudget !== null && myE > oppBudget * GAMBLE_MARGIN
      ? solver.bestActionUnderBudget(state, Math.max(1, Math.round(oppBudget)))
      : solver.bestAction(state);
  const activeNumber = state.numberIndex < NUMBERS.length ? Number(NUMBERS[state.numberIndex]) : null;
  const aim = aimPointForAction(action, activeNumber);
  const sigma = sigmaForLevel(level);
  return [aim[0] + gaussianSample(sigma), aim[1] + gaussianSample(sigma)];
}

/**
 * Decides keep-vs-redirect for a triple/double the bot just landed on its own
 * active number — race-aware in the same way as botChooseThrow (see there).
 * `progressBeforeThrow` must reflect state *before* that dart — i.e. with the
 * ring's prevCount, the same convention resolvePendingChoice itself uses to
 * compute the redirect branch (see MikkeMusApp.tsx).
 */
export function botDecideRedirect(
  level: BotLevel,
  allProgress: PlayerProgress,
  progressBeforeThrow: Progress,
  activePlayer: string,
  botLevels: Record<string, BotLevel>,
  ringStep: "D" | "T",
  multiplier: 2 | 3
): boolean {
  const state = progressToBotState(progressBeforeThrow);
  const solver = solverFor(level);
  const oppBudget = estimateOpponentBudget(allProgress, activePlayer, botLevels);
  const myE = solver.expectedRemaining(state);
  if (oppBudget !== null && myE > oppBudget * GAMBLE_MARGIN) {
    return solver.shouldRedirectUnderBudget(state, ringStep, multiplier, Math.max(1, Math.round(oppBudget)));
  }
  return solver.shouldRedirect(state, ringStep, multiplier);
}
