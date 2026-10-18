import { buildMatchLog } from "./matchLog";
import type { PlayerRecord } from "./playerRows";

/**
 * A rating for people and teams, as in chess (Elo): beating a stronger side gives a lot, beating a weaker
 * one little, and what the winner gets the loser gives up. Only matches between two sides count.
 *
 * Everyone starts on 1 500, players and teams alike: the seeding of the regulars is not in the rating, only in the
 * odds. The rating is what the matches have made of that start, and it is worked out again from every match on
 * record (replayRatings), so it is the same whichever order the matches reached the records in. New ratings
 * move faster for the first few matches.
 */
export const START_RATING = 1500;
/** How many rated matches a rating is provisional for. */
export const PROVISIONAL_MATCHES = 8;

/** The chance `a` beats `b` on these ratings (0 to 1). */
export const expectedScore = (a: number, b: number): number => 1 / (1 + Math.pow(10, (b - a) / 400));

/** How far one match can move a rating: more while the rating is new. */
export const kFor = (ratedMatches: number): number => (ratedMatches < PROVISIONAL_MATCHES ? 40 : 24);

export type Rated = { rating: number; rated: number };

/** What a win does to the two ratings, in whole points (the winner's is positive, the loser's negative). */
export function ratingChange(winner: Rated, loser: Rated): { winnerDelta: number; loserDelta: number } {
  const surprise = 1 - expectedScore(winner.rating, loser.rating);
  return { winnerDelta: Math.round(kFor(winner.rated) * surprise), loserDelta: -Math.round(kFor(loser.rated) * surprise) };
}

/**
 * Every rating, worked out from the start: the matches of every record in the order they were played, each between
 * two sides with a record (a bot or a guest gives no rating) of the same kind, the loser having thrown at least a
 * dart. What is returned is what recordRating would have made of the same matches one at a time.
 */
export function replayRatings(records: PlayerRecord[]): Map<string, Rated> {
  const out = new Map<string, Rated>();
  const get = (name: string): Rated => out.get(name) ?? { rating: START_RATING, rated: 0 };
  const matches = buildMatchLog(records).reverse();
  for (const m of matches) {
    if (m.sides.length !== 2 || !m.winner) continue;
    const [a, b] = m.sides;
    if (a.kind === "other" || b.kind === "other" || a.kind !== b.kind || !a.entry || !b.entry) continue;
    const [w, l] = a.won ? [a, b] : b.won ? [b, a] : [null, null];
    if (!w || !l || !l.entry || l.entry.dartsUsed <= 0) continue;
    const c = ratingChange(get(w.name), get(l.name));
    out.set(w.name, { rating: get(w.name).rating + c.winnerDelta, rated: get(w.name).rated + 1 });
    out.set(l.name, { rating: get(l.name).rating + c.loserDelta, rated: get(l.name).rated + 1 });
  }
  return out;
}
