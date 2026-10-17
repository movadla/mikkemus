import { describe, expect, it } from "vitest";
import { START_RATING, expectedScore, initialRating, kFor, ratingChange } from "./rating";

describe("rating", () => {
  it("starts the regulars where the seeding puts them, and everyone else on 1 500", () => {
    expect(initialRating("Vadla")).toBeGreaterThan(initialRating("Monge"));
    expect(initialRating("monge")).toBe(initialRating("Lars"));
    expect(initialRating("sondre")).toBeLessThan(initialRating("Vegard"));
    expect(initialRating("Ukjent")).toBe(START_RATING);
  });

  it("gives the chances the group guessed", () => {
    const at = (a: string, b: string) => expectedScore(initialRating(a), initialRating(b));
    expect(at("Vadla", "Monge")).toBeCloseTo(0.6, 1);
    expect(at("Monge", "Moen")).toBeCloseTo(0.5, 6);
    expect(at("Moen", "Hans")).toBeCloseTo(0.65, 1);
    expect(at("Hans", "Vegard")).toBeCloseTo(0.8, 1);
    expect(at("Vegard", "Sondre")).toBeCloseTo(0.75, 1);
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
