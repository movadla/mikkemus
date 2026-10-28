import { describe, expect, it } from "vitest";
import { newCareer } from "./career";
import { DRILL_ROUNDS, EXPECTED, MED_MAX, MED_MIN, averageOf, expectedAverage, medFromAverage, sessionFrom, trainCareer } from "./training";

const AT = "2026-10-28T20:00:00.000Z";
const rounds = (score: number, n = DRILL_ROUNDS) => Array.from({ length: n }, () => score);
const career = (level = "dyktig") => newCareer("Lars", level, AT);

describe("the table", () => {
  it("falls as the throw gets wider", () => {
    for (let i = 1; i < EXPECTED.length; i++) {
      expect(EXPECTED[i][0]).toBeGreaterThan(EXPECTED[i - 1][0]);
      expect(EXPECTED[i][1]).toBeLessThan(EXPECTED[i - 1][1]);
    }
  });

  it("reads between the rows, and stops at the ends", () => {
    expect(expectedAverage(30)).toBeCloseTo(45.8, 1);
    expect(expectedAverage(32.5)).toBeCloseTo((45.8 + 42.4) / 2, 1);
    expect(expectedAverage(5)).toBe(61.7);
    expect(expectedAverage(200)).toBe(30.9);
  });

  it("goes back from an average to the level it points to", () => {
    for (const med of [22, 30, 37, 45, 58]) expect(medFromAverage(expectedAverage(med))).toBeCloseTo(med, 5);
    expect(medFromAverage(100)).toBe(20);
    expect(medFromAverage(10)).toBe(75);
  });
});

describe("a session", () => {
  it("averages the rounds", () => {
    expect(averageOf([40, 50, 60])).toBe(50);
    expect(averageOf([])).toBe(0);
  });

  it("leaves the level where it is for a session that shows it", () => {
    const c = career();
    const s = sessionFrom(c, rounds(expectedAverage(37)), AT);
    expect(s.measured).toBeCloseTo(37, 0);
    expect(s.after).toBeCloseTo(37, 0);
  });

  it("moves a quarter of the way to what it shows, and never more than three mm", () => {
    const c = career();
    const small = sessionFrom(c, rounds(expectedAverage(41)), AT);
    expect(small.after).toBeCloseTo(38, 1);
    const wild = sessionFrom(c, rounds(60), AT);
    expect(wild.after).toBe(34);
    const poor = sessionFrom(c, rounds(20), AT);
    expect(poor.after).toBe(40);
  });

  it("keeps the level between the sharpest and the weakest", () => {
    expect(sessionFrom({ ...career(), skillMed: 21 }, rounds(180), AT).after).toBeGreaterThanOrEqual(MED_MIN);
    expect(sessionFrom({ ...career(), skillMed: 69 }, rounds(0), AT).after).toBeLessThanOrEqual(MED_MAX);
  });

  it("moves the career's level and keeps the session, the newest first and ten at most", () => {
    let c = career();
    c = trainCareer(c, rounds(60), AT);
    expect(c.skillMed).toBe(34);
    expect(c.training[0]).toMatchObject({ before: 37, after: 34 });
    for (let i = 0; i < 12; i++) c = trainCareer(c, rounds(40), AT);
    expect(c.training).toHaveLength(10);
  });

  it("is not counted before the whole drill is thrown", () => {
    const c = career();
    expect(trainCareer(c, rounds(60, DRILL_ROUNDS - 1), AT)).toBe(c);
  });
});
