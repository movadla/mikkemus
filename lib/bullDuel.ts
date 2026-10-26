import type { BotLevel } from "./botLevels";
import { sigmaForLevel, gaussianSample } from "./botStrategy";
import { aimPointFor, luckForBullDuelThrow } from "./dartboard";
import { DARTS_PER_TURN } from "./game";
import { parseSector, stepForSector } from "./scoliaMapping";

/** Running per-match totals behind a player's kast/poeng/treff%/xG row on the
 *  Bull-duell winner screen — same shape lib/storage.ts's career BullDuelStat
 *  accumulates into across matches. `redHits`/`greenHits` back the
 *  rødt/grønt drilldown — "treff" alone is `redHits + greenHits`. */
export type BullDuelPlayerStats = {
  throws: number;
  points: number;
  redHits: number;
  greenHits: number;
  luckSum: number;
  luckCount: number;
  /** The most darts in a row that scored (red or green), across turns. */
  bestRun: number;
  /** The run as it stands now; a miss ends it. */
  run: number;
  /** The most points in one turn. */
  bestTurn: number;
  /** Turns where all three darts scored. */
  perfectTurns: number;
};

function emptyBullDuelStats(): BullDuelPlayerStats {
  return { throws: 0, points: 0, redHits: 0, greenHits: 0, luckSum: 0, luckCount: 0, bestRun: 0, run: 0, bestTurn: 0, perfectTurns: 0 };
}

/** The two ways to play it: first to a number of points («Først til»), or the best of three darts each («Best av 3 piler»). */
export type BullDuelMode = "first" | "best3";

/** Where «Først til» starts in the picker, and the range it can be moved in. */
export const DEFAULT_BULL_DUEL_TARGET = 10;
export const MIN_BULL_DUEL_TARGET = 5;
export const MAX_BULL_DUEL_TARGET = 99;

/** The most three darts can score at the bull (two bullseyes' worth each), which is what «Best av 3 piler» is measured against. */
export const BEST_OF_THREE_MAX = 3 * 2;

/** One dart's outcome this turn, for the 3-box shot indicator. */
export type BullDuelShot = { label: string; points: number };

export type BullDuelState = {
  players: string[];
  /** «Først til» when absent (a match saved before there was a choice). */
  mode?: BullDuelMode;
  /** Best of three darts: who is still throwing for the win. Everyone to begin with; after a tie only the ones who were level. */
  contenders?: string[];
  /** Best of three darts: which round this is, 1 for the first and one more for each tie that is thrown off. */
  round?: number;
  /** First to: the points that win. Best of three darts: the most three darts can score (a bar to fill, nothing that wins). */
  target: number;
  points: Record<string, number>;
  /** Each player's total after every one of their turns, in order (the race chart reads these). */
  pointsByTurn: Record<string, number[]>;
  /** Where the measured darts landed, per player, oldest first — Scolia's coordinates only, never a keyed-in dart. */
  throws: Record<string, [number, number][]>;
  /** Points scored so far in the turn in progress. */
  turnPoints: number;
  activeIdx: number;
  dartsThisTurn: number;
  /** This turn's darts so far, oldest first — reset on advanceBullDuelTurn. */
  turnShots: BullDuelShot[];
  stats: Record<string, BullDuelPlayerStats>;
  /** Set the instant someone reaches or passes `target` — overshooting still
   *  wins, so this can happen mid-turn, before all 3 darts are thrown. */
  winner: string | null;
};

export function startBullDuel(players: string[], target: number, mode: BullDuelMode = "first"): BullDuelState {
  const points: Record<string, number> = {};
  const stats: Record<string, BullDuelPlayerStats> = {};
  const pointsByTurn: Record<string, number[]> = {};
  const throws: Record<string, [number, number][]> = {};
  players.forEach((p) => {
    points[p] = 0;
    stats[p] = emptyBullDuelStats();
    pointsByTurn[p] = [];
    throws[p] = [];
  });
  // Best of three darts: the bar is filled by what three darts can give, and everyone is in the round.
  return mode === "best3"
    ? { players, mode, contenders: [...players], round: 1, target: BEST_OF_THREE_MAX, points, pointsByTurn, throws, turnPoints: 0, activeIdx: 0, dartsThisTurn: 0, turnShots: [], stats, winner: null }
    : { players, target, points, pointsByTurn, throws, turnPoints: 0, activeIdx: 0, dartsThisTurn: 0, turnShots: [], stats, winner: null };
}

export function activePlayerFor(state: BullDuelState): string {
  return state.players[state.activeIdx];
}

/**
 * Registers one physical dart for the active player — updates their point
 * total and match stats, and sets `winner` the moment they reach or pass
 * the target. A no-op once the match already has a winner, so a stray dart
 * arriving after the match ended can never corrupt the result.
 *
 * `coords` is null for a manually-tapped dart (no Scolia connected) — same
 * as the main game's manual fallback, there's no real landing point to judge
 * proximity against, so throws/hits still count but xG is left out of the
 * average entirely rather than guessing a fake coordinate.
 */
export function registerBullDart(state: BullDuelState, sector: string, coords: [number, number] | null): BullDuelState {
  if (state.winner) return state;
  const player = activePlayerFor(state);
  const { step, crosses } = stepForSector(parseSector(sector, false));
  const points = step === "BULL" ? crosses : 0;

  const prev = state.stats[player];
  const luck = coords ? luckForBullDuelThrow(coords, state.points[player], state.target) : null;
  const run = points > 0 ? prev.run + 1 : 0;
  const turnPoints = state.turnPoints + points;
  const newPoints = state.points[player] + points;
  const dartsThisTurn = state.dartsThisTurn + 1;
  // First to: the dart that reaches the target wins, even mid-turn. Best of three darts: nobody wins before the last of those still in
  // the round has thrown; then the most points wins, and a tie is no winner (the ones who are level throw again, see advanceBullDuelTurn).
  let winner: string | null = state.mode === "best3" ? null : newPoints >= state.target ? player : null;
  if (state.mode === "best3" && dartsThisTurn >= DARTS_PER_TURN) {
    const contenders = state.contenders ?? state.players;
    if (contenders[contenders.length - 1] === player) {
      const round = Object.fromEntries(contenders.map((c) => [c, c === player ? newPoints : state.points[c]]));
      const max = Math.max(...Object.values(round));
      const top = contenders.filter((c) => round[c] === max);
      winner = top.length === 1 ? top[0] : null;
    }
  }
  const turnOver = winner !== null || dartsThisTurn >= DARTS_PER_TURN;
  const stats: BullDuelPlayerStats = {
    throws: prev.throws + 1,
    points: prev.points + points,
    redHits: prev.redHits + (points === 2 ? 1 : 0),
    greenHits: prev.greenHits + (points === 1 ? 1 : 0),
    luckSum: prev.luckSum + (luck ?? 0),
    luckCount: prev.luckCount + (luck !== null ? 1 : 0),
    run,
    bestRun: Math.max(prev.bestRun, run),
    // Only counted once the turn is over, when the whole turn is known (the winning dart ends it early).
    bestTurn: turnOver ? Math.max(prev.bestTurn, turnPoints) : prev.bestTurn,
    perfectTurns: prev.perfectTurns + (turnOver && dartsThisTurn >= DARTS_PER_TURN && state.turnShots.every((s) => s.points > 0) && points > 0 ? 1 : 0),
  };

  const label = points === 2 ? "Rødt" : points === 1 ? "Grønt" : "Bom";

  return {
    ...state,
    points: { ...state.points, [player]: newPoints },
    // Counted when the turn ends, so the chart has one point per turn played.
    pointsByTurn: turnOver ? { ...state.pointsByTurn, [player]: [...state.pointsByTurn[player], newPoints] } : state.pointsByTurn,
    throws: coords ? { ...state.throws, [player]: [...state.throws[player], coords] } : state.throws,
    stats: { ...state.stats, [player]: stats },
    turnPoints,
    dartsThisTurn,
    turnShots: [...state.turnShots, { label, points }],
    winner,
  };
}

/** True once the active player's turn is over — either they've thrown all 3
 *  darts, or the match already ended early on a winning dart. */
export function isTurnComplete(state: BullDuelState): boolean {
  return state.winner !== null || state.dartsThisTurn >= DARTS_PER_TURN;
}

/**
 * «Bust»: the active player missed with every dart left in the turn. Books each as a miss, so the throws and
 * the statistics are the same as for three taps on «Bom», and leaves the turn complete, ready for Bekreft.
 */
export function bustBullDuelTurn(state: BullDuelState): BullDuelState {
  let next = state;
  while (!isTurnComplete(next)) next = registerBullDart(next, "None", null);
  return next;
}

/** Moves to the next player in the rotation. A no-op once there's a winner. */
export function advanceBullDuelTurn(state: BullDuelState): BullDuelState {
  if (state.winner) return state;
  if (state.mode === "best3") {
    const contenders = state.contenders ?? state.players;
    const at = contenders.indexOf(activePlayerFor(state));
    // The next of those still throwing, in the order they sit.
    if (at < contenders.length - 1) {
      return { ...state, activeIdx: state.players.indexOf(contenders[at + 1]), dartsThisTurn: 0, turnShots: [], turnPoints: 0 };
    }
    // Everyone in the round has thrown and nobody is alone in front: the ones who are level throw again, from nothing.
    const max = Math.max(...contenders.map((c) => state.points[c]));
    const tied = contenders.filter((c) => state.points[c] === max);
    const fresh = Object.fromEntries(state.players.map((p) => [p, 0]));
    return { ...state, contenders: tied, round: (state.round ?? 1) + 1, points: fresh, activeIdx: state.players.indexOf(tied[0]), dartsThisTurn: 0, turnShots: [], turnPoints: 0 };
  }
  return { ...state, activeIdx: (state.activeIdx + 1) % state.players.length, dartsThisTurn: 0, turnShots: [], turnPoints: 0 };
}

/** Points the player still needs. */
export function remainingFor(state: BullDuelState, player: string): number {
  return Math.max(0, state.target - state.points[player]);
}

/**
 * How close a player is to winning, as for the main game's matchdart: «matchdart» when one dart can finish it (two points
 * or less to go), «out» when the darts left in this turn could (the player is up, so only the active player has darts
 * left to count), nothing otherwise. Overshooting wins, so an inner bull finishes two points and any hit finishes one.
 */
export function finishStateFor(state: BullDuelState, player: string): "matchdart" | "out" | null {
  if (state.winner || state.mode === "best3") return null;
  const remaining = remainingFor(state, player);
  if (remaining <= 0) return null;
  if (remaining <= 2) return "matchdart";
  const dartsLeft = activePlayerFor(state) === player ? DARTS_PER_TURN - state.dartsThisTurn : DARTS_PER_TURN;
  return remaining <= 2 * dartsLeft ? "out" : null;
}

/** Who leads, and alone: the side with the most points, or null on a tie or before anyone has scored. */
export function soleLeader(state: BullDuelState): string | null {
  const max = Math.max(...state.players.map((p) => state.points[p]));
  if (max <= 0) return null;
  const top = state.players.filter((p) => state.points[p] === max);
  return top.length === 1 ? top[0] : null;
}

/** Mean distance from the middle of the bull over a player's measured darts, in mm (MED for this game), or null. */
export function meanDistanceFor(state: BullDuelState, player: string): number | null {
  const t = state.throws[player];
  if (!t || t.length === 0) return null;
  return t.reduce((s, [x, y]) => s + Math.hypot(x, y), 0) / t.length;
}

/** A bot's Bull-duell throw: aim dead-center at bull, with Gaussian noise on
 *  each axis scaled by the bot's calibrated level — no race-aware strategy
 *  needed (unlike the main game's Monte Carlo solver), since there's nothing
 *  to decide: bull is always the only target. */
export function botChooseBullThrow(level: BotLevel): [number, number] {
  const [aimX, aimY] = aimPointFor({ ring: "BULL" });
  const sigma = sigmaForLevel(level);
  return [aimX + gaussianSample(sigma), aimY + gaussianSample(sigma)];
}
