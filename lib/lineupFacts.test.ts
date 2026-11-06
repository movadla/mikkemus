import { describe, expect, it } from "vitest";
import { bestAndWorst, headToHead } from "./lineupFacts";
import type { PlayerRecord } from "./playerRows";

const rec = (over: Partial<PlayerRecord>): PlayerRecord => ({ name: "X", kind: "team", matchesPlayed: 0, matchesWon: 0, dartsInWins: 0, bestDartsToFinish: null, overall: { hits: 0, misses: 0 }, steps: {} as never, accuracy: { sumDistance: 0, sumHorizontal: 0, sumVertical: 0, throws: 0 }, luck: {} as never, bullDuel: {} as never, tripleHits: {} as never, doubleHits: {} as never, matchHistory: [], ...over });
const m = (vs: string[], won: boolean) => ({ date: "2026-11-01", vs, won, dartsUsed: 30, hitPct: 40 }) as never;

describe("headToHead", () => {
  it("counts the matches the two have played against each other, and only those", () => {
    const a = rec({ matchHistory: [m(["B"], true), m(["B"], false), m(["B"], true), m(["C"], true)] });
    expect(headToHead(a, undefined, "A", "B")).toEqual([{ wins: 2, played: 3 }, { wins: 1, played: 3 }]);
  });

  it("reads the other side's record when this one has none", () => {
    const b = rec({ matchHistory: [m(["A"], true)] });
    expect(headToHead(undefined, b, "A", "B")).toEqual([{ wins: 0, played: 1 }, { wins: 1, played: 1 }]);
  });

  it("is nothing when they have never met", () => {
    expect(headToHead(rec({ matchHistory: [m(["C"], true)] }), rec({}), "A", "B")).toBeNull();
    expect(headToHead(undefined, undefined, "A", "B")).toBeNull();
  });
});

describe("bestAndWorst", () => {
  const steps = (o: Record<string, [number, number]>) => Object.fromEntries(Object.entries(o).map(([k, [hits, misses]]) => [k, { hits, misses }])) as never;

  it("is the row hit most often and the row hit least often", () => {
    expect(bestAndWorst(rec({ steps: steps({ "20": [30, 10], "19": [20, 20], D: [3, 17], BULL: [9, 31] }) }))).toEqual({ best: "20", worst: "D" });
  });

  it("leaves out a row with too few darts, and says nothing with fewer than two rows", () => {
    expect(bestAndWorst(rec({ steps: steps({ "20": [30, 10], BULL: [0, 2] }) }))).toBeNull();
    expect(bestAndWorst(undefined)).toBeNull();
  });
});
