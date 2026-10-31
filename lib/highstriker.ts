/**
 * Highstriker: each round the thrower writes in what the three darts made, and it has to be more than the one before them made. Not more,
 * and a life is lost. Whoever is out of lives is out; the last one standing wins. The first round has nothing to beat.
 */
import { memberAfter, type NextUp } from "./teamGame";
export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 9;

/** One person on a side that is a team. A bot's level is a MED in mm. */
export type HighstrikerMember = { name: string; isBot: boolean; botLevel?: number };

export type HighstrikerTurn = {
  player: string;
  /** Who of a team threw the round. */
  by?: string;
  /** What the round made. */
  scored: number;
  /** What it had to beat: the round before it. Null for the very first round. */
  target: number | null;
  /** The round did not beat it. */
  lostLife: boolean;
};

export type HighstrikerGame = {
  /** Who was chosen to start, when it was asked: the sides are in the order they throw from then on. */
  firstUp?: string;
  lives: number;
  players: string[];
  turns: HighstrikerTurn[];
  /** The people of the sides that are teams. A team has its lives together; its members throw a round each, in turn. */
  rosters?: Record<string, HighstrikerMember[]>;
};

export function newGame(lives: number, players: string[], rosters?: Record<string, HighstrikerMember[]>): HighstrikerGame {
  return { lives: Math.max(MIN_LIVES, Math.min(MAX_LIVES, lives)), players, turns: [], ...(rosters && Object.keys(rosters).length > 0 ? { rosters } : {}) };
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

/** Who throws the round that is up: for a team the member whose turn it is (they take turns, a round each), otherwise null. */
export function memberUp(g: HighstrikerGame): HighstrikerMember | null {
  const side = playerUp(g);
  const roster = g.rosters?.[side];
  if (!roster || roster.length === 0) return null;
  return roster[g.turns.filter((t) => t.player === side).length % roster.length];
}

/** Who throws after the round that is up: the next side in order that still has a life and, for a team, the member whose turn it is on it. */
export function nextUp(g: HighstrikerGame): NextUp<HighstrikerMember> | null {
  const from = g.players.indexOf(playerUp(g));
  for (let step = 1; step < g.players.length; step++) {
    const side = g.players[(from + step) % g.players.length];
    if (!isOut(g, side)) return { side, member: memberAfter(g.rosters, side, g.turns.filter((t) => t.player === side).length) };
  }
  return null;
}

export function playRound(g: HighstrikerGame, scored: number): HighstrikerGame {
  const target = targetOf(g);
  const by = memberUp(g)?.name;
  return { ...g, turns: [...g.turns, { player: playerUp(g), ...(by ? { by } : {}), scored, target, lostLife: target !== null && scored <= target }] };
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
