import { STEPS, aggregateTurns, currentStepFor, type PlayerProgress, type Step, type TurnResult } from "./game";

/**
 * The shape of a finished match, boiled down to the things worth saying about it: who led when,
 * where each player got stuck, how the second half compared to the first.
 *
 * The same facts feed two writers. `ruleBasedSummary` turns them into a few sentences with no
 * network and no cost, and is what the winner screen shows at once. The summary route hands the
 * very same facts to Claude, which writes the nicer version — and because it is given numbers to
 * write from rather than a transcript to interpret, it has nothing to invent. If the route is
 * unreachable or has no key, the rule-based text simply stays; nobody sees an error.
 */

export type PlayerFacts = {
  name: string;
  darts: number;
  /** Crosses banked — a triple is three. */
  crosses: number;
  /** The app's "treff" percentage — see pct. */
  hitPct: number;
  rounds: number;
  /** Cumulative crosses after each of the player's turns. */
  crossesByRound: number[];
  /** Hit % over the first and the second half of the player's turns; null if too few turns. */
  firstHalfPct: number | null;
  secondHalfPct: number | null;
  /** Misses charged to each row. */
  missesByStep: Partial<Record<Step, number>>;
  /** The row this player was still working on when the match ended; null for the winner. */
  stuckOn: Step | null;
  /** Crosses still missing in total. */
  crossesLeft: number;
};

export type MatchFacts = {
  winner: string;
  /** Crosses that close a row in this match. */
  target: number;
  /** Turns the winner took. */
  rounds: number;
  /** How many times the lead changed hands, counted round by round. */
  leadChanges: number;
  /** Who led after half the winner's turns; null if tied or too short to say. */
  leaderAtHalf: string | null;
  players: PlayerFacts[];
};

const MIN_TURNS_FOR_HALVES = 4;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The app's own "treff": crosses over crosses plus misses — the same figure the winner screen's
 *  table prints. Not crosses per dart, which passes 100 % as soon as a triple lands. */
function pct(hits: number, misses: number): number {
  const total = hits + misses;
  return total > 0 ? Math.round((hits / total) * 100) : 0;
}

function playerFacts(
  name: string,
  turns: TurnResult[],
  finalProgress: PlayerProgress[string] | undefined,
  winner: string,
  rowTarget: number,
): PlayerFacts {
  const real = turns.filter((t): t is TurnResult => !!t);
  const agg = aggregateTurns(real);
  let running = 0;
  const crossesByRound = real.map((t) => (running += sum(Object.values(t.hitsByStep).map((n) => n ?? 0))));
  const half = Math.floor(real.length / 2);
  const enough = real.length >= MIN_TURNS_FOR_HALVES;
  const part = (from: number, to: number) => {
    const slice = real.slice(from, to);
    const a = aggregateTurns(slice);
    return pct(a.hits, a.misses);
  };
  const stuck = finalProgress && name !== winner ? currentStepFor(finalProgress) : null;
  return {
    name,
    darts: agg.darts,
    crosses: agg.hits,
    hitPct: pct(agg.hits, agg.misses),
    rounds: real.length,
    crossesByRound,
    firstHalfPct: enough ? part(0, half) : null,
    secondHalfPct: enough ? part(half, real.length) : null,
    missesByStep: agg.missesByStep,
    stuckOn: stuck,
    crossesLeft: finalProgress ? STEPS.reduce((left, s) => left + Math.max(0, rowTarget - finalProgress[s]), 0) : 0,
  };
}

export function buildMatchFacts(input: {
  players: string[];
  winner: string;
  turnLog: Record<string, TurnResult[]>;
  finalProgress: PlayerProgress;
  target: number;
}): MatchFacts {
  const facts = input.players.map((p) => playerFacts(p, input.turnLog[p] ?? [], input.finalProgress[p], input.winner, input.target));

  // Round by round: who is ahead on crosses after each full round. A player who has not thrown
  // that many turns yet counts at what they had. Ties keep the previous leader, so a level
  // score is not reported as the lead changing.
  const rounds = Math.max(0, ...facts.map((f) => f.rounds));
  const at = (f: PlayerFacts, round: number) => f.crossesByRound[Math.min(round, f.crossesByRound.length) - 1] ?? 0;
  let leader: string | null = null;
  let leadChanges = 0;
  let leaderAtHalf: string | null = null;
  const halfRound = Math.floor(rounds / 2);
  for (let r = 1; r <= rounds; r++) {
    const scores = facts.map((f) => ({ name: f.name, crosses: at(f, r) }));
    const top = Math.max(...scores.map((s) => s.crosses));
    const leaders = scores.filter((s) => s.crosses === top);
    if (leaders.length === 1 && leaders[0].name !== leader) {
      if (leader !== null) leadChanges += 1;
      leader = leaders[0].name;
    }
    if (r === halfRound) leaderAtHalf = leaders.length === 1 ? leaders[0].name : null;
  }

  const winnerFacts = facts.find((f) => f.name === input.winner);
  return {
    winner: input.winner,
    target: input.target,
    rounds: winnerFacts?.rounds ?? rounds,
    leadChanges,
    leaderAtHalf: rounds >= MIN_TURNS_FOR_HALVES ? leaderAtHalf : null,
    players: facts,
  };
}

const STEP_WORDS: Partial<Record<Step, string>> = {
  D: "dobbel",
  T: "trippel",
  BULL: "bullen",
};

function describeStep(step: Step): string {
  return STEP_WORDS[step] ?? `${step}-en`;
}

/** The row a player threw most misses at — only worth naming when it clearly stands out. */
function worstMissRow(f: PlayerFacts): { step: Step; misses: number } | null {
  const entries = (Object.entries(f.missesByStep) as [Step, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [step, misses] = entries[0];
  const second = entries[1]?.[1] ?? 0;
  return misses >= 4 && misses >= second * 1.5 ? { step, misses } : null;
}

/** Norwegian, plain, three or four sentences at most. Never throws, never says anything the facts do not. */
export function ruleBasedSummary(facts: MatchFacts): string {
  const winner = facts.players.find((p) => p.name === facts.winner);
  if (!winner) return "";
  const others = facts.players.filter((p) => p.name !== facts.winner);
  const parts: string[] = [];

  parts.push(`${winner.name} vant på ${winner.rounds} ${winner.rounds === 1 ? "runde" : "runder"} med ${winner.hitPct} % treff og ${winner.darts} ${winner.darts === 1 ? "pil" : "piler"}.`);

  if (others.length > 0 && winner.rounds >= MIN_TURNS_FOR_HALVES) {
    if (facts.leadChanges === 0) {
      parts.push(`${winner.name} hadde ledelsen hele veien.`);
    } else if (facts.leaderAtHalf && facts.leaderAtHalf !== winner.name) {
      parts.push(`${facts.leaderAtHalf} ledet halvveis, men ${winner.name} snudde kampen.`);
    } else {
      parts.push(`Ledelsen skiftet ${facts.leadChanges} ${facts.leadChanges === 1 ? "gang" : "ganger"}.`);
    }
  }

  // Development: a clear drop or lift between the halves is the one thing worth saying.
  for (const p of facts.players) {
    if (p.firstHalfPct === null || p.secondHalfPct === null) continue;
    const delta = p.secondHalfPct - p.firstHalfPct;
    if (delta <= -15) parts.push(`${p.name} startet bra (${p.firstHalfPct} %), men falt av mot slutten (${p.secondHalfPct} %).`);
    else if (delta >= 15) parts.push(`${p.name} kom sterkere og sterkere: ${p.firstHalfPct} % først, ${p.secondHalfPct} % til slutt.`);
  }

  // Where the loser got stuck.
  const loser = [...others].sort((a, b) => a.crossesLeft - b.crossesLeft)[0];
  if (loser?.stuckOn) {
    const row = worstMissRow(loser);
    const left = loser.crossesLeft;
    const stuck = `${loser.name} hadde ${left} kryss igjen og stod fast på ${describeStep(loser.stuckOn)}`;
    parts.push(row && row.step === loser.stuckOn ? `${stuck} (${row.misses} bom der).` : `${stuck}.`);
  }

  return parts.join(" ");
}

/** Stable text of the facts, for remembering that one match has already been summarised. */
export function factsFingerprint(facts: MatchFacts): string {
  return JSON.stringify([facts.winner, facts.target, facts.rounds, facts.players.map((p) => [p.name, p.darts, p.crosses, p.crossesByRound.join(",")])]);
}

const MAX_PLAYERS = 12;
const MAX_ROUNDS = 400;

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown): string | null => (typeof x === "string" && x.length > 0 && x.length <= 60 ? x : null);
const stepSet = new Set<string>(STEPS);

/**
 * Whatever arrives at the summary route, into trusted facts — or null. The route is open to
 * anyone, and what it is given ends up in a prompt, so every string is length-limited and
 * every number checked, and anything unexpected is refused rather than repaired.
 */
export function validateFacts(raw: unknown): MatchFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const winner = str(r.winner);
  if (!winner || !isNum(r.target) || r.target < 1 || r.target > 5) return null;
  if (!isNum(r.rounds) || r.rounds < 0 || r.rounds > MAX_ROUNDS || !isNum(r.leadChanges) || r.leadChanges < 0 || r.leadChanges > MAX_ROUNDS) return null;
  if (!Array.isArray(r.players) || r.players.length < 1 || r.players.length > MAX_PLAYERS) return null;

  const players: PlayerFacts[] = [];
  for (const p of r.players) {
    if (!p || typeof p !== "object") return null;
    const q = p as Record<string, unknown>;
    const name = str(q.name);
    if (!name) return null;
    if (![q.darts, q.crosses, q.hitPct, q.rounds, q.crossesLeft].every(isNum)) return null;
    if (!Array.isArray(q.crossesByRound) || q.crossesByRound.length > MAX_ROUNDS || !q.crossesByRound.every(isNum)) return null;
    const half = (x: unknown) => (x === null ? null : isNum(x) ? x : undefined);
    const first = half(q.firstHalfPct);
    const second = half(q.secondHalfPct);
    if (first === undefined || second === undefined) return null;
    const misses: Partial<Record<Step, number>> = {};
    if (q.missesByStep && typeof q.missesByStep === "object") {
      for (const [k, v] of Object.entries(q.missesByStep as Record<string, unknown>)) {
        if (!stepSet.has(k) || !isNum(v)) return null;
        misses[k as Step] = v;
      }
    }
    const stuck = q.stuckOn === null || q.stuckOn === undefined ? null : typeof q.stuckOn === "string" && stepSet.has(q.stuckOn) ? (q.stuckOn as Step) : undefined;
    if (stuck === undefined) return null;
    players.push({
      name,
      darts: q.darts as number,
      crosses: q.crosses as number,
      hitPct: q.hitPct as number,
      rounds: q.rounds as number,
      crossesByRound: q.crossesByRound as number[],
      firstHalfPct: first,
      secondHalfPct: second,
      missesByStep: misses,
      stuckOn: stuck,
      crossesLeft: q.crossesLeft as number,
    });
  }
  if (!players.some((p) => p.name === winner)) return null;
  const leaderAtHalf = r.leaderAtHalf === null || r.leaderAtHalf === undefined ? null : str(r.leaderAtHalf);
  return { winner, target: r.target, rounds: r.rounds, leadChanges: r.leadChanges, leaderAtHalf, players };
}
