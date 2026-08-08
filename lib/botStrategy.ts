import { aimPointFor, sectorAt } from "./dartboard";
import { STEPS, type Progress, type Step } from "./game";
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

function progressToBotState(progress: Progress): BotState {
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
  // model the fixed difficulty presets use (see lib/botLevels.ts).
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
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
  const sigma = BOT_LEVELS[level].sigma;
  const profiles: LevelProfiles = {
    S: monteCarloProfile(aimPointFor({ ring: "S", number: REFERENCE_NUMBER }), sigma),
    D: monteCarloProfile(aimPointFor({ ring: "D", number: REFERENCE_NUMBER }), sigma),
    T: monteCarloProfile(aimPointFor({ ring: "T", number: REFERENCE_NUMBER }), sigma),
    BULL: monteCarloProfile(aimPointFor({ ring: "BULL" }), sigma),
  };
  profileCache.set(level, profiles);
  return profiles;
}

type Solver = {
  bestAction(state: BotState): BotAction;
  /** Whether redirecting to the number beats staying on the ring, for a ring/multiplier
   *  ambiguity arising from `state` (the state *before* this dart was thrown). */
  shouldRedirect(state: BotState, ring: "D" | "T", multiplier: 2 | 3): boolean;
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

  return {
    bestAction(s: BotState): BotAction {
      evaluate(s);
      return actionMemo.get(stateKey(s))!;
    },
    shouldRedirect(s: BotState, ring: "D" | "T", multiplier: 2 | 3): boolean {
      return ambiguousRedirects(s, ring, multiplier);
    },
  };
}

function solverFor(level: BotLevel): Solver {
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

/**
 * Picks the bot's aim for its next dart (weighing the whole rest of the game's
 * expected remaining darts, not just this throw) and simulates where it lands.
 * The caller scores the result through the exact same sectorAt/parseSector
 * pipeline a real Scolia throw goes through — this only supplies the coordinate.
 */
export function botChooseThrow(level: BotLevel, progress: Progress): [number, number] {
  const state = progressToBotState(progress);
  const solver = solverFor(level);
  const action = solver.bestAction(state);
  const activeNumber = state.numberIndex < NUMBERS.length ? Number(NUMBERS[state.numberIndex]) : null;
  const aim = aimPointForAction(action, activeNumber);
  const sigma = BOT_LEVELS[level].sigma;
  return [aim[0] + gaussianSample(sigma), aim[1] + gaussianSample(sigma)];
}

/**
 * Decides keep-vs-redirect for a triple/double the bot just landed on its own
 * active number. `progressBeforeThrow` must reflect state *before* that dart —
 * i.e. with the ring's prevCount, the same convention resolvePendingChoice itself
 * uses to compute the redirect branch (see MikkeMusApp.tsx).
 */
export function botDecideRedirect(
  level: BotLevel,
  progressBeforeThrow: Progress,
  ringStep: "D" | "T",
  multiplier: 2 | 3
): boolean {
  const state = progressToBotState(progressBeforeThrow);
  return solverFor(level).shouldRedirect(state, ringStep, multiplier);
}
