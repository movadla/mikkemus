/**
 * The results of the games that have no place in the match statistics: 301 and 501, Highstriker and Lava. A finished game is written down
 * as a GameResult (who won, who played, what each of them made), and the tab «Andre spill» works the tables out from the list of them.
 * Bots are in the result, so that a game against one can be told, but they are left out of the tables: those are the people's.
 */
import { bestRoundOf, dartsOf, remainingOf, roundsOf, tonsOf, winnerOf as countdownWinner, type CountdownGame } from "./countdown";
import { burnedBy, stateOf as lavaState, type LavaGame } from "./lava";
import { stateOf as killerState, type KillerGame } from "./killer";
import { ROUNDS_IN_ALL, halvingsOf, stateOf as halvitState, type HalvItGame } from "./halvit";
import { livesLeft as highstrikerLives, winnerOf as highstrikerWinner, type HighstrikerGame } from "./highstriker";

export type GameKind = "301" | "501" | "highstriker" | "lava" | "halvit" | "killer";

/** In the order the tab shows them. */
export const GAME_KINDS: GameKind[] = ["301", "501", "highstriker", "lava", "halvit", "killer"];
export const GAME_NAMES: Record<GameKind, string> = { "301": "301", "501": "501", highstriker: "Highstriker", lava: "Lava", halvit: "Halv It", killer: "Killer" };

/** What one player made in a game. What a game has no use for is 0. */
export type PlayerFigures = {
  darts: number;
  /** 301/501: what came off the number. Highstriker: the sum of the rounds. */
  points: number;
  rounds: number;
  /** The best round (301/501 and Highstriker). */
  best: number;
  /** Rounds of 100 or more (301/501). */
  tons: number;
  /** Sections set on fire (Lava). */
  burned: number;
  /** Lives lost (Highstriker and Lava). */
  lostLives: number;
  /** What the winner went out on (301/501). */
  finish?: number;
};

export type GameResult = {
  id: string;
  game: GameKind;
  /** ISO timestamp of when it finished. */
  playedAt: string;
  winner: string;
  players: string[];
  bots: string[];
  figures: Record<string, PlayerFigures>;
};

const none = (): PlayerFigures => ({ darts: 0, points: 0, rounds: 0, best: 0, tons: 0, burned: 0, lostLives: 0 });

/** A finished 301 or 501, or null while it has no winner or only one player. */
export function countdownResult(g: CountdownGame, bots: string[], id: string, playedAt: string): GameResult | null {
  const winner = countdownWinner(g);
  if (!winner || g.players.length < 2) return null;
  const figures: Record<string, PlayerFigures> = {};
  for (const p of g.players) {
    figures[p] = {
      ...none(),
      darts: dartsOf(g, p),
      points: g.start - remainingOf(g, p),
      rounds: roundsOf(g, p).length,
      best: bestRoundOf(g, p),
      tons: tonsOf(g, p),
    };
  }
  figures[winner].finish = g.turns[g.turns.length - 1].scored;
  return { id, game: String(g.start) as GameKind, playedAt, winner, players: g.players, bots: bots.filter((b) => g.players.includes(b)), figures };
}

export function highstrikerResult(g: HighstrikerGame, bots: string[], id: string, playedAt: string): GameResult | null {
  const winner = highstrikerWinner(g);
  if (!winner) return null;
  const figures: Record<string, PlayerFigures> = {};
  for (const p of g.players) {
    const mine = g.turns.filter((t) => t.player === p);
    figures[p] = {
      ...none(),
      darts: mine.length * 3,
      points: mine.reduce((s, t) => s + t.scored, 0),
      rounds: mine.length,
      best: Math.max(0, ...mine.map((t) => t.scored)),
      lostLives: g.lives - highstrikerLives(g, p),
    };
  }
  return { id, game: "highstriker", playedAt, winner, players: g.players, bots: bots.filter((b) => g.players.includes(b)), figures };
}

export function lavaResult(g: LavaGame, bots: string[], id: string, playedAt: string): GameResult | null {
  const s = lavaState(g);
  if (!s.winner || g.players.length < 2) return null;
  const figures: Record<string, PlayerFigures> = {};
  for (const p of g.players) {
    figures[p] = { ...none(), darts: s.log.filter((d) => d.player === p).length, burned: burnedBy(s, p), lostLives: g.lives - (s.lives[p] ?? 0) };
  }
  return { id, game: "lava", playedAt, winner: s.winner, players: g.players, bots: bots.filter((b) => g.players.includes(b)), figures };
}

/** A finished Halv It between at least two (a game of one, or of teams, is not kept): the best figure is the score, and the lives lost are the halvings. */
export function halvitResult(g: HalvItGame, id: string, playedAt: string): GameResult | null {
  const s = halvitState(g);
  if (!s.winner || g.players.length < 2 || g.rosters) return null;
  const figures: Record<string, PlayerFigures> = {};
  for (const p of g.players) {
    figures[p] = { ...none(), points: s.scores[p], rounds: ROUNDS_IN_ALL, best: s.scores[p], lostLives: halvingsOf(s, p) };
  }
  return { id, game: "halvit", playedAt, winner: s.winner, players: g.players, bots: [], figures };
}

/** A finished Killer between at least two players (teams are not kept): the best figure is the players taken out. */
export function killerResult(g: KillerGame, id: string, playedAt: string): GameResult | null {
  const s = killerState(g);
  if (!s.winner || g.players.length < 2 || g.rosters) return null;
  const figures: Record<string, PlayerFigures> = {};
  for (const p of g.players) figures[p] = { ...none(), darts: s.log.filter((d) => d.player === p).length, rounds: s.rounds[p], best: s.kills[p], burned: s.kills[p], lostLives: g.lives - (s.lives[p] ?? 0) };
  return { id, game: "killer", playedAt, winner: s.winner, players: g.players, bots: [], figures };
}

/** One person's line in the table of a game. A number a game does not have stays null. */
export type TableRow = {
  name: string;
  games: number;
  wins: number;
  /** Whole percent. */
  winPct: number;
  /** 301/501: the average of three darts. Highstriker: the average round. */
  average: number | null;
  best: number | null;
  tons: number;
  bestFinish: number | null;
  fewestDarts: number | null;
  burned: number;
  lostLives: number;
};

export type GameTable = {
  game: GameKind;
  /** Games played in all, with the bots in them. */
  played: number;
  /** The ISO time of the last one. */
  last: string;
  rows: TableRow[];
  /** The last few games, newest first. */
  recent: GameResult[];
};

type Tally = TableRow & { points: number; darts: number; rounds: number };

/** The table of one game, or null when it has not been played. People who have played it are in it, the one with the most wins first. */
export function tableOf(results: GameResult[], game: GameKind, recentCount = 3): GameTable | null {
  const mine = results.filter((r) => r.game === game).sort((a, b) => (a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : 0));
  if (mine.length === 0) return null;
  const people = new Map<string, Tally>();
  for (const r of mine) {
    for (const name of r.players) {
      if (r.bots.includes(name)) continue;
      const f = r.figures[name];
      if (!f) continue;
      const row: Tally = people.get(name) ?? { name, games: 0, wins: 0, winPct: 0, average: null, best: null, tons: 0, bestFinish: null, fewestDarts: null, burned: 0, lostLives: 0, points: 0, darts: 0, rounds: 0 };
      row.games += 1;
      row.points += f.points;
      row.darts += f.darts;
      row.rounds += f.rounds;
      row.tons += f.tons;
      row.burned += f.burned;
      row.lostLives += f.lostLives;
      if (f.rounds > 0) row.best = Math.max(row.best ?? 0, f.best);
      if (r.winner === name) {
        row.wins += 1;
        if (f.finish !== undefined) row.bestFinish = Math.max(row.bestFinish ?? 0, f.finish);
        if (game === "301" || game === "501") row.fewestDarts = Math.min(row.fewestDarts ?? Infinity, f.darts);
      }
      people.set(name, row);
    }
  }
  const rows: TableRow[] = [...people.values()].map(({ points, darts, rounds, ...row }) => ({
    ...row,
    winPct: Math.round((row.wins / row.games) * 100),
    average: game === "highstriker" ? (rounds > 0 ? points / rounds : null) : game === "lava" ? null : darts > 0 ? (points / darts) * 3 : null,
  }));
  rows.sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || b.games - a.games || a.name.localeCompare(b.name, "no"));
  return { game, played: mine.length, last: mine[0].playedAt, rows, recent: mine.slice(0, recentCount) };
}

/** The tables of the games that have been played, in the usual order. Empty when none has. */
export function tablesOf(results: GameResult[]): GameTable[] {
  return GAME_KINDS.flatMap((g) => tableOf(results, g) ?? []);
}
