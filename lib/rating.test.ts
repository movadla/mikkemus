import { describe, expect, it } from "vitest";
import { START_RATING, expectedScore, kFor, ratingChange, replayRatings } from "./rating";
import { emptyRecord, type MatchHistoryEntry } from "./playerRows";

const entry = (date: string, won: boolean, over: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({ date, won, dartsUsed: 60, hitPct: 50, med: null, mhd: null, mvd: null, ...over });
const rec = (name: string, h: MatchHistoryEntry[], over: object = {}) => ({ ...emptyRecord(name), matchesPlayed: h.length, matchHistory: h, ...over });

describe("rating", () => {
  it("makes two sides on the same rating a coin toss", () => {
    expect(expectedScore(START_RATING, START_RATING)).toBeCloseTo(0.5, 6);
  });

  it("gives a lot for beating a stronger side and little for beating a weaker one", () => {
    const upset = ratingChange({ rating: 1400, rated: 20 }, { rating: 1600, rated: 20 });
    const expected = ratingChange({ rating: 1600, rated: 20 }, { rating: 1400, rated: 20 });
    expect(upset.winnerDelta).toBeGreaterThan(expected.winnerDelta);
    expect(upset.winnerDelta).toBeGreaterThan(15);
    expect(expected.winnerDelta).toBeLessThan(8);
  });

  it("takes from the loser what the winner gets, when both are settled", () => {
    const c = ratingChange({ rating: 1500, rated: 30 }, { rating: 1500, rated: 30 });
    expect(c.winnerDelta).toBe(12);
    expect(c.loserDelta).toBe(-12);
  });

  it("moves a new rating faster", () => {
    expect(kFor(0)).toBeGreaterThan(kFor(20));
    const fresh = ratingChange({ rating: 1500, rated: 0 }, { rating: 1500, rated: 30 });
    expect(fresh.winnerDelta).toBeGreaterThan(-fresh.loserDelta);
  });
});

describe("replayed ratings", () => {
  const a = rec("Per", [entry("2026-10-10T18:00:00.000Z", true, { matchId: "m1", vs: ["Ola"] }), entry("2026-10-11T18:00:00.000Z", false, { matchId: "m2", vs: ["Ola"] })]);
  const b = rec("Ola", [entry("2026-10-10T18:00:00.100Z", false, { matchId: "m1", vs: ["Per"] }), entry("2026-10-11T18:00:00.100Z", true, { matchId: "m2", vs: ["Per"] })]);

  it("starts everyone on 1 500 and plays the matches in order", () => {
    const r = replayRatings([a, b]);
    const first = ratingChange({ rating: START_RATING, rated: 0 }, { rating: START_RATING, rated: 0 });
    const afterFirst = { per: START_RATING + first.winnerDelta, ola: START_RATING + first.loserDelta };
    const second = ratingChange({ rating: afterFirst.ola, rated: 1 }, { rating: afterFirst.per, rated: 1 });
    expect(r.get("Per")).toEqual({ rating: afterFirst.per + second.loserDelta, rated: 2 });
    expect(r.get("Ola")).toEqual({ rating: afterFirst.ola + second.winnerDelta, rated: 2 });
  });

  it("does not rate a match against a bot", () => {
    const vsBot = rec("Per", [entry("2026-10-10T18:00:00.000Z", true, { matchId: "m1", vs: ["Bot 2"] })]);
    expect(replayRatings([vsBot]).size).toBe(0);
  });

  it("is the same whatever order the records come in", () => {
    expect(replayRatings([b, a])).toEqual(replayRatings([a, b]));
  });
});
