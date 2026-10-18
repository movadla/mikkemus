import { describe, expect, it } from "vitest";
import { nodeIndexFor, SCENARIOS } from "./odds/skill";
import { emptyRecord, shownHitPct, crossesPerDartPct, type MatchHistoryEntry } from "./playerRows";
import { longestRun } from "./turnStats";
import { nightOf } from "./nights";
import type { TurnResult } from "./game";

const entry = (over: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({ date: "2026-10-17T18:00:00.000Z", won: true, dartsUsed: 60, hitPct: 50, med: null, mhd: null, mvd: null, ...over });
const turn = (counted: number, tail?: number): TurnResult => ({ hitsByStep: { "20": counted }, missStep: "20", misses: 3 - counted, darts: 3, counted, ...(tail !== undefined ? { tail } : {}) }) as TurnResult;

describe("every member of a team plays through all the skill nodes", () => {
  it("gives each member a permutation of the seven nodes, the fourth and eleventh included", () => {
    for (const member of [0, 1, 2, 3, 4, 10]) {
      const nodes = new Set(Array.from({ length: SCENARIOS }, (_, sc) => nodeIndexFor(sc, member, SCENARIOS)));
      expect(nodes.size).toBe(SCENARIOS);
    }
  });
  it("keeps the first three members where they were", () => {
    expect(nodeIndexFor(2, 0, 7)).toBe(2);
    expect(nodeIndexFor(2, 1, 7)).toBe(6);
    expect(nodeIndexFor(2, 2, 7)).toBe(3);
  });
});

describe("the hit share of a match", () => {
  it("is read as it was stored for new matches and held to 100 for old ones", () => {
    expect(shownHitPct(entry({ hitPct: 62, cpd: 90 }))).toBe(62);
    expect(shownHitPct(entry({ hitPct: 140 }))).toBe(100);
  });
  it("is worked out from the rows where an old match kept them", () => {
    expect(shownHitPct(entry({ hitPct: 140, steps: { "20": [30, 20] } }))).toBe(60);
  });
  it("keeps crosses per dart for the odds", () => {
    expect(crossesPerDartPct(entry({ hitPct: 62, cpd: 90 }))).toBe(90);
    expect(crossesPerDartPct(entry({ hitPct: 75 }))).toBe(75);
  });
  it("has nothing odd with an empty record", () => {
    expect(emptyRecord("Per").matchHistory).toEqual([]);
  });
});

describe("the longest run of counting darts", () => {
  it("counts three for each perfect turn and the counting darts a turn ended on", () => {
    // 3 + 3 = 6, then a broken turn ending on two (2), then a perfect turn: 2 + 3 = 5
    expect(longestRun([turn(3), turn(3), turn(1, 2), turn(3)], "Per")).toBe(6);
    expect(longestRun([turn(1, 2), turn(3), turn(3)], "Per")).toBe(8);
  });
  it("is zero with nothing counting", () => {
    expect(longestRun([turn(0), turn(1)], "Per")).toBe(0);
  });
});

describe("the night a match belongs to", () => {
  it("takes a match after midnight to the evening before", () => {
    const late = new Date(2026, 9, 18, 0, 30).toISOString();
    const evening = new Date(2026, 9, 17, 20, 0).toISOString();
    expect(nightOf(late)).toBe("2026-10-17");
    expect(nightOf(evening)).toBe("2026-10-17");
    expect(nightOf(new Date(2026, 9, 18, 9, 0).toISOString())).toBe("2026-10-18");
  });
});
