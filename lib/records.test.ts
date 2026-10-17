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
