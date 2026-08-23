import type { BotLevel } from "./botLevels";
import { sigmaForLevel, gaussianSample } from "./botStrategy";
import { aimPointFor, luckForBullDuelThrow } from "./dartboard";
import { DARTS_PER_TURN } from "./game";
import { parseSector, stepForSector } from "./scoliaMapping";

/** Running per-match totals behind a player's kast/poeng/treff%/xG row on the
 *  Bull-duell winner screen — same shape lib/storage.ts's career BullDuelStat
 *  accumulates into across matches. `redHits`/`greenHits` back the
 *  rødt/grønt drilldown — "treff" alone is `redHits + greenHits`. */
export type BullDuelPlayerStats = { throws: number; points: number; redHits: number; greenHits: number; luckSum: number; luckCount: number };

function emptyBullDuelStats(): BullDuelPlayerStats {
  return { throws: 0, points: 0, redHits: 0, greenHits: 0, luckSum: 0, luckCount: 0 };
}

/** Sensible default target for the picker screen — a normal handful of bull
 *  hits, not so low the match is over in one turn. */
export const DEFAULT_BULL_DUEL_TARGET = 21;

/** One dart's outcome this turn, for the 3-box shot indicator. */
export type BullDuelShot = { label: string; points: number };

export type BullDuelState = {
  players: string[];
  target: number;
  points: Record<string, number>;
  activeIdx: number;
  dartsThisTurn: number;
  /** This turn's darts so far, oldest first — reset on advanceBullDuelTurn. */
  turnShots: BullDuelShot[];
  stats: Record<string, BullDuelPlayerStats>;
  /** Set the instant someone reaches or passes `target` — overshooting still
   *  wins, so this can happen mid-turn, before all 3 darts are thrown. */
  winner: string | null;
};

export function startBullDuel(players: string[], target: number): BullDuelState {
  const points: Record<string, number> = {};
  const stats: Record<string, BullDuelPlayerStats> = {};
  players.forEach((p) => {
    points[p] = 0;
    stats[p] = emptyBullDuelStats();
  });
  return { players, target, points, activeIdx: 0, dartsThisTurn: 0, turnShots: [], stats, winner: null };
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
  const stats: BullDuelPlayerStats = {
    throws: prev.throws + 1,
    points: prev.points + points,
    redHits: prev.redHits + (points === 2 ? 1 : 0),
    greenHits: prev.greenHits + (points === 1 ? 1 : 0),
    luckSum: prev.luckSum + (luck ?? 0),
    luckCount: prev.luckCount + (luck !== null ? 1 : 0),
  };

  const newPoints = state.points[player] + points;
  const label = points === 2 ? "Rødt" : points === 1 ? "Grønt" : "Bom";

  return {
    ...state,
    points: { ...state.points, [player]: newPoints },
    stats: { ...state.stats, [player]: stats },
    dartsThisTurn: state.dartsThisTurn + 1,
    turnShots: [...state.turnShots, { label, points }],
    winner: newPoints >= state.target ? player : null,
  };
}

/** True once the active player's turn is over — either they've thrown all 3
 *  darts, or the match already ended early on a winning dart. */
export function isTurnComplete(state: BullDuelState): boolean {
  return state.winner !== null || state.dartsThisTurn >= DARTS_PER_TURN;
}

/** Moves to the next player in the rotation. A no-op once there's a winner. */
export function advanceBullDuelTurn(state: BullDuelState): BullDuelState {
  if (state.winner) return state;
  return { ...state, activeIdx: (state.activeIdx + 1) % state.players.length, dartsThisTurn: 0, turnShots: [] };
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
