/**
 * The plain countdown games, 301 and 501: each round the thrower says what the three darts made, the number comes off what is left, and
 * whoever gets to exactly nothing wins. Nothing here knows about darts one by one: a round is a total from 0 to 180.
 */
export type CountdownStart = 301 | 501;

/** The most three darts can make. */
export const MAX_ROUND = 180;

export type CountdownTurn = {
  player: string;
  /** What the round made, as written in. */
  scored: number;
  /** Over the line (below nothing, or on 1 when the finish has to be a double): the round counts for nothing. */
  bust: boolean;
  /** Darts thrown in the round: three, but fewer in the round that finished it, where the thrower says how many it took. */
  darts: number;
};

export type CountdownGame = {
  start: CountdownStart;
  /** The finish has to be a double, so that what is left on 1 can never be finished. */
  doubleOut: boolean;
  players: string[];
  turns: CountdownTurn[];
  /** A start of their own for some of the players (a handicap: the one who starts lower has the head start). The others start at `start`. */
  starts?: Record<string, number>;
};

export const DARTS_PER_ROUND = 3;

export function newGame(start: CountdownStart, doubleOut: boolean, players: string[], starts?: Record<string, number>): CountdownGame {
  return { start, doubleOut, players, turns: [], ...(starts ? { starts } : {}) };
}

/** Where a player starts: the start of the game, or their own when they have a handicap. */
export const startOf = (g: CountdownGame, player: string): number => g.starts?.[player] ?? g.start;

/** What a player has left: the start, less every round that counted. */
export function remainingOf(g: CountdownGame, player: string): number {
  return g.turns.reduce<number>((left, t) => (t.player === player && !t.bust ? left - t.scored : left), startOf(g, player));
}

/** Who throws next: the players in turn, one round each. */
export function playerUp(g: CountdownGame): string {
  return g.players[g.turns.length % g.players.length];
}

/** What a round written in would be, from what the thrower has left: it counts, it is over the line, or it is the finish. */
export function judge(left: number, scored: number, doubleOut: boolean): "counts" | "bust" | "finish" {
  const after = left - scored;
  if (after === 0) return "finish";
  if (after < 0 || (doubleOut && after === 1)) return "bust";
  return "counts";
}

/** The round that is written in. A round over the line is kept, and counts for nothing. */
export function playRound(g: CountdownGame, scored: number, darts = DARTS_PER_ROUND): CountdownGame {
  const player = playerUp(g);
  const verdict = judge(remainingOf(g, player), scored, g.doubleOut);
  return { ...g, turns: [...g.turns, { player, scored, bust: verdict === "bust", darts: verdict === "bust" ? DARTS_PER_ROUND : darts }] };
}

/** Takes the last round back. */
export function undoRound(g: CountdownGame): CountdownGame {
  return { ...g, turns: g.turns.slice(0, -1) };
}

/** The winner: the one whose last round took them to nothing. */
export function winnerOf(g: CountdownGame): string | null {
  const last = g.turns[g.turns.length - 1];
  return last && !last.bust && remainingOf(g, last.player) === 0 ? last.player : null;
}

/** Darts a player has thrown. */
export function dartsOf(g: CountdownGame, player: string): number {
  return g.turns.reduce((n, t) => (t.player === player ? n + t.darts : n), 0);
}

/** The average of three darts: what the rounds made, over the darts thrown, times three. Null before a dart is thrown. */
export function averageOf(g: CountdownGame, player: string): number | null {
  const darts = dartsOf(g, player);
  if (darts === 0) return null;
  const made = g.turns.reduce((sum, t) => (t.player === player && !t.bust ? sum + t.scored : sum), 0);
  return (made / darts) * DARTS_PER_ROUND;
}

/** The last round that counted, for the line under a name. */
export function lastRoundOf(g: CountdownGame, player: string): CountdownTurn | null {
  return [...g.turns].reverse().find((t) => t.player === player) ?? null;
}

/**
 * Whether more digits could still be written after these and make a round: 1 could be 10 to 18 or 100 to 180, but 19 can only be 19, as 190
 * is more than three darts can make. So a round written as 19 or more is done at once, with nothing to confirm; 0 is done at once too.
 */
export function canGrow(typed: string): boolean {
  return typed !== "" && typed !== "0" && Number(typed + "0") <= MAX_ROUND;
}

/** The digits after one more is pressed: a number over 180 is not taken. */
export function pressDigit(typed: string, digit: number): string {
  if (typed === "0") return typed;
  const next = typed + String(digit);
  return Number(next) > MAX_ROUND ? typed : next;
}

/** What each round of a player made, in order; a round over the line counts as nothing. */
export function roundsOf(g: CountdownGame, player: string): number[] {
  return g.turns.filter((t) => t.player === player).map((t) => (t.bust ? 0 : t.scored));
}

/** The best round a player has made. */
export const bestRoundOf = (g: CountdownGame, player: string): number => Math.max(0, ...roundsOf(g, player));

/** How many rounds of 100 or more a player has made. */
export const tonsOf = (g: CountdownGame, player: string): number => roundsOf(g, player).filter((n) => n >= 100).length;

/** The one with the least left, when it is one and the game has begun; null on a tie or before the first round. */
export function leaderOf(g: CountdownGame): string | null {
  if (g.turns.length === 0) return null;
  const left = g.players.map((p) => ({ p, n: remainingOf(g, p) })).sort((a, b) => a.n - b.n);
  return left.length > 1 && left[0].n === left[1].n ? null : left[0].p;
}
