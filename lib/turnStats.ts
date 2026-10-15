import { DARTS_PER_TURN, type TurnResult } from "./game";

/**
 * One thrower's numbers for a match, read off the turn log — for the detail card on the winner
 * screen. In team play the log is the team's, and each turn says who threw it, so this is where
 * a member's own hit percentage comes from.
 */
export type ThrowerStats = {
  name: string;
  turns: number;
  darts: number;
  hits: number;
  misses: number;
  /** Crosses per dart, 0–100. */
  hitPct: number;
  /** Turns where every dart counted — "tre tellende". */
  perfectTurns: number;
  /** The most of those in a row. */
  bestRun: number;
  /** The most crosses in one turn. */
  bestTurn: number;
};

function hitsOf(turn: TurnResult): number {
  return Object.values(turn.hitsByStep).reduce((a, b) => a + (b ?? 0), 0);
}

/** Whether every dart of the turn counted. A turn without a count — logged before it was
 *  tracked — is judged by its crosses, which is what the count would have been by hand. */
function perfect(turn: TurnResult): boolean {
  return (turn.counted ?? hitsOf(turn)) >= DARTS_PER_TURN;
}

/**
 * The turns of one log, by who threw them: one row per thrower, in the order they first threw.
 * A turn without a thrower is the player's own (`fallback`).
 */
export function throwerStats(turns: readonly (TurnResult | undefined)[], fallback: string): ThrowerStats[] {
  const rows = new Map<string, ThrowerStats & { run: number }>();
  for (const turn of turns) {
    if (!turn) continue;
    const name = turn.thrower ?? fallback;
    const row = rows.get(name) ?? { name, turns: 0, darts: 0, hits: 0, misses: 0, hitPct: 0, perfectTurns: 0, bestRun: 0, bestTurn: 0, run: 0 };
    const hits = hitsOf(turn);
    row.turns += 1;
    row.darts += turn.darts ?? DARTS_PER_TURN;
    row.hits += hits;
    row.misses += turn.misses;
    row.bestTurn = Math.max(row.bestTurn, hits);
    if (perfect(turn)) {
      row.perfectTurns += 1;
      row.run += 1;
      row.bestRun = Math.max(row.bestRun, row.run);
    } else {
      row.run = 0;
    }
    rows.set(name, row);
  }
  return [...rows.values()].map((row) => ({
    name: row.name,
    turns: row.turns,
    darts: row.darts,
    hits: row.hits,
    misses: row.misses,
    hitPct: row.hits + row.misses === 0 ? 0 : Math.round((row.hits / (row.hits + row.misses)) * 100),
    perfectTurns: row.perfectTurns,
    bestRun: row.bestRun,
    bestTurn: row.bestTurn,
  }));
}
