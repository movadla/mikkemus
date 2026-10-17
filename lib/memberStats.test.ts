import { describe, expect, it } from "vitest";
import type { TurnResult } from "./game";
import { emptyMemberStat, memberDeltas, memberHitPct, memberMed, mergeMemberStats } from "./memberStats";

const turn = (thrower: string, hits: number, misses: number, darts = 3): TurnResult => ({ hitsByStep: hits ? { "20": hits } : {}, missStep: misses ? "20" : null, misses, darts, thrower });

describe("member stats", () => {
  const log = [turn("Vadla", 3, 0), turn("Hans", 1, 2), turn("Vadla", 2, 1), turn("Hans", 0, 3)];

  it("splits a team's turns by who threw them", () => {
    const d = memberDeltas(log, ["Vadla", "Hans", "Ingen"], { Vadla: { throws: 6, sumR: 180 } });
    expect(Object.keys(d)).toEqual(["Vadla", "Hans"]); // a member who threw nothing is left out
    expect(d.Vadla).toMatchObject({ matches: 1, turns: 2, darts: 6, hits: 5, misses: 1, throws: 6, sumR: 180 });
    expect(d.Hans).toMatchObject({ turns: 2, darts: 6, hits: 1, misses: 5, throws: 0 });
    expect(memberHitPct(d.Vadla)).toBe(83);
    expect(memberMed(d.Vadla)).toBe(30);
    expect(memberMed(d.Hans)).toBeNull();
  });

  it("adds a match to the running totals and keeps the best run", () => {
    const a = memberDeltas(log, ["Vadla"], undefined);
    const b = mergeMemberStats(mergeMemberStats(undefined, a), a);
    expect(b.Vadla.matches).toBe(2);
    expect(b.Vadla.darts).toBe(12);
    expect(b.Vadla.hits).toBe(10);
    expect(b.Vadla.steps["20"].hits).toBe(10);
    expect(emptyMemberStat().darts).toBe(0);
  });
});
