import { describe, expect, it } from "vitest";
import { newCareer } from "./career";
import { statsOf, withLines } from "./careerStats";

const AT = "2026-10-30T20:00:00.000Z";

describe("the statistics of a career", () => {
  it("are empty for a new career", () => {
    expect(statsOf(newCareer("Lars", "dyktig", AT))).toEqual({ matches: 0, won: 0 });
  });

  it("give the average, the best round, the 180s and the highest checkout in 501, and the hit rate in Mikke Mus", () => {
    const c = withLines(newCareer("Lars", "dyktig", AT), [
      { at: AT, won: true, darts: 15, rounds: [180, 100, 81, 100, 40], checkout: 40 },
      { at: AT, won: false, darts: 18, rounds: [60, 60, 0, 45, 85, 100] },
      { at: AT, won: true, darts: 30, hits: 20, misses: 10 },
    ]);
    const s = statsOf(c);
    expect(s.matches).toBe(3);
    expect(s.won).toBe(2);
    expect(s.countdown).toEqual({ average: Math.round(((501 + 350) / 33) * 30) / 10, best: 180, max180: 1, checkout: 40 });
    expect(s.mm).toEqual({ hitRate: 67, darts: 30 });
  });
});
