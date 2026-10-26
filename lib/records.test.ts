import { describe, expect, it } from "vitest";
import { buildRecords } from "./records";
import { emptyRecord, type MatchHistoryEntry } from "./playerRows";

const e = (won: boolean, over: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({ date: "2026-10-17T18:00:00.000Z", won, dartsUsed: 60, hitPct: 50, med: null, mhd: null, mvd: null, ...over });

describe("records", () => {
  it("ranks the best three and leaves out lists nobody is on", () => {
    const a = { ...emptyRecord("Per"), bestRun: 7, matchesWon: 3, matchHistory: [e(true), e(true), e(false), e(true, { hitPct: 71 })] };
    const b = { ...emptyRecord("Ola"), bestRun: 9, matchesWon: 1, bestDartsToFinish: 48, matchHistory: [e(true, { hitPct: 40 })] };
    const lists = buildRecords([a, b]);
    expect(lists.find((l) => l.key === "run")!.holders.map((h) => h.name)).toEqual(["Ola", "Per"]);
    expect(lists.find((l) => l.key === "fast")!.holders[0]).toMatchObject({ name: "Ola", value: 48 });
    expect(lists.find((l) => l.key === "streak")!.holders[0]).toMatchObject({ name: "Per", value: 2 });
    expect(lists.find((l) => l.key === "hit")!.holders[0].value).toBe(71);
    expect(lists.find((l) => l.key === "med")).toBeUndefined();
  });

  it("is empty with no records", () => {
    expect(buildRecords([emptyRecord("Per")])).toEqual([]);
  });
});

describe("records point to the match they were set in", () => {
  const a = {
    ...emptyRecord("Per"),
    bestRun: 7,
    matchesWon: 2,
    matchHistory: [
      e(true, { matchId: "m1", vs: ["Littler"], dartsUsed: 51, hitPct: 61, date: "2026-10-17T18:00:00.000Z" }),
      e(true, { matchId: "m2", vs: ["Ola"], dartsUsed: 66, hitPct: 73, date: "2026-10-17T19:00:00.000Z" }),
    ],
  };

  it("gives the match of a record that was set in one, with who it was against", () => {
    const lists = buildRecords([a]);
    expect(lists.find((l) => l.key === "hit")!.holders[0]).toMatchObject({ value: 73, matchId: "m2" });
    expect(lists.find((l) => l.key === "hit")!.holders[0].note).toContain("mot Ola");
    expect(lists.find((l) => l.key === "fast")!.holders[0]).toMatchObject({ value: 51, matchId: "m1" });
  });

  it("gives none for a record that is made of many matches, or of a figure no match shows", () => {
    const lists = buildRecords([a, { ...emptyRecord("Ola"), bestDartsToFinish: 45, matchesWon: 1, matchHistory: [e(true, { matchId: "m3", dartsUsed: 80 })] }]);
    expect(lists.find((l) => l.key === "run")!.holders[0].matchId).toBeUndefined();
    expect(lists.find((l) => l.key === "wins")!.holders[0].matchId).toBeUndefined();
    // Ola's 45 is a stored figure that none of the matches on record reaches.
    expect(lists.find((l) => l.key === "fast")!.holders[0]).toMatchObject({ name: "Ola", value: 45 });
    expect(lists.find((l) => l.key === "fast")!.holders[0].matchId).toBeUndefined();
  });
});
