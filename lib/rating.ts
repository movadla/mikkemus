/**
 * A rating for people and teams, as in chess (Elo): beating a stronger side gives a lot, beating a weaker
 * one little, and what the winner gets the loser gives up. Only matches between two sides count.
 *
 * Everyone starts on 1 500, except the regulars, who start where the group's seeding puts them (see
 * lib/odds/seeding.ts): the gaps below are the ratings that give the chances the group guessed (Vadla
 * 6 of 10 against Monge, Monge, Moen and Lars level, Hans 6 to 7 of 10 behind them, and so on). New
 * ratings move faster for the first few matches, so a wrong start is corrected within an evening or two.
 */
export const START_RATING = 1500;
/** How many rated matches a rating is provisional for. */
export const PROVISIONAL_MATCHES = 8;

const SEED_RATING: Record<string, number> = {
  vadla: 1570,
  monge: 1500,
  moen: 1500,
  lars: 1500,
  hans: 1392,
  vegard: 1151,
  sondre: 960,
};

export const initialRating = (name: string): number => SEED_RATING[name.trim().toLowerCase()] ?? START_RATING;

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
