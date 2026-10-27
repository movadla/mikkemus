/**
 * Highstriker: each round the thrower writes in what the three darts made, and it has to be more than the one before them made. Not more,
 * and a life is lost. Whoever is out of lives is out; the last one standing wins. The first round has nothing to beat.
 */
export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 9;

export type HighstrikerTurn = {
  player: string;
  /** What the round made. */
  scored: number;
  /** What it had to beat: the round before it. Null for the very first round. */
  target: number | null;
  /** The round did not beat it. */
  lostLife: boolean;
};

export type HighstrikerGame = {
  lives: number;
  players: string[];
  turns: HighstrikerTurn[];
};

export function newGame(lives: number, players: string[]): HighstrikerGame {
  return { lives: Math.max(MIN_LIVES, Math.min(MAX_LIVES, lives)), players, turns: [] };
}

/** Lives a player has left. */
export function livesLeft(g: HighstrikerGame, player: string): number {
  return g.turns.reduce((n, t) => (t.player === player && t.lostLife ? n - 1 : n), g.lives);
}

export const isOut = (g: HighstrikerGame, player: string) => livesLeft(g, player) <= 0;

/** The one still in the game, if only one is: the winner. */
export function winnerOf(g: HighstrikerGame): string | null {
  if (g.players.length < 2 || g.turns.length === 0) return null;
  const alive = g.players.filter((p) => !isOut(g, p));
  return alive.length === 1 ? alive[0] : null;
}

/** Who throws next: after the last round, the next player in order who still has a life. */
export function playerUp(g: HighstrikerGame): string {
  const last = g.turns[g.turns.length - 1];
  if (!last) return g.players[0];
  const from = g.players.indexOf(last.player);
  for (let step = 1; step <= g.players.length; step++) {
    const p = g.players[(from + step) % g.players.length];
    if (!isOut(g, p)) return p;
  }
  return last.player;
}

/** What the next round has to beat: what the round before it made. Null in the first round. */
export function targetOf(g: HighstrikerGame): number | null {
  const last = g.turns[g.turns.length - 1];
  return last ? last.scored : null;
}

/** The least that keeps the life: one more than the target. */
export function leastToKeep(g: HighstrikerGame): number | null {
  const t = targetOf(g);
  return t === null ? null : t + 1;
}

export function playRound(g: HighstrikerGame, scored: number): HighstrikerGame {
  const target = targetOf(g);
  return { ...g, turns: [...g.turns, { player: playerUp(g), scored, target, lostLife: target !== null && scored <= target }] };
}

export function undoRound(g: HighstrikerGame): HighstrikerGame {
  return { ...g, turns: g.turns.slice(0, -1) };
}

/** The best round a player has made. */
export function bestOf(g: HighstrikerGame, player: string): number | null {
  const mine = g.turns.filter((t) => t.player === player).map((t) => t.scored);
  return mine.length > 0 ? Math.max(...mine) : null;
}

/** The average round of a player. */
export function averageOf(g: HighstrikerGame, player: string): number | null {
  const mine = g.turns.filter((t) => t.player === player);
  return mine.length > 0 ? mine.reduce((s, t) => s + t.scored, 0) / mine.length : null;
}
