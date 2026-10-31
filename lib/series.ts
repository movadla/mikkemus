import type { FigureSet } from "./nightFigures";
import type { NightBonus } from "./bonus";
/**
 * «Best av x»: a series of games, where the side that gets to the number of wins first (2 in a best of 3, 3 in a best of 5) wins the series. The
 * series keeps the winners of the games already played; the game that is on counts too when it has a winner, so the standing is the same on the
 * winner screen as after pressing Neste kamp.
 */
export type Series = { bestOf: number; history: string[]; /** The feats of the games so far (extra points), to be written with the series. */ bonus?: NightBonus[]; /** What each person made in the games so far, to be written with the series. */ figures?: FigureSet[] };

/** The lengths of a series to choose from: 1 is no series, one game. */
export const BEST_OF_CHOICES = [1, 3, 5, 7];

/** How many wins take a series: 2 of 3, 3 of 5. */
export const winsNeeded = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

export type Standing = {
  /** Wins of each side, the game that is on included when it has a winner. */
  wins: Record<string, number>;
  needed: number;
  /** The side that has won the series, when one has. */
  decided: string | null;
};

export function standing(series: Series, sides: string[], current: string | null): Standing {
  const wins: Record<string, number> = Object.fromEntries(sides.map((s) => [s, 0]));
  for (const w of [...series.history, ...(current ? [current] : [])]) if (w in wins) wins[w] += 1;
  const needed = winsNeeded(series.bestOf);
  return { wins, needed, decided: sides.find((s) => wins[s] >= needed) ?? null };
}

/** «Lars 1–0 Vadla», or for more than two «Lars 1 · Vadla 0 · Hans 0». */
export function standingText(s: Standing, sides: string[]): string {
  if (sides.length === 2) return `${sides[0]} ${s.wins[sides[0]]}–${s.wins[sides[1]]} ${sides[1]}`;
  return sides.map((p) => `${p} ${s.wins[p]}`).join(" · ");
}

/** What a game gets from the app that holds the series: the series so far, and what to tell it when a game is won or a new series begins. */
export type SeriesWiring = Series & { onWin: (winner: string, bonus?: NightBonus[], figures?: FigureSet) => void; onReset: () => void };
