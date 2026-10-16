import { describe, expect, it } from "vitest";
import type { TurnResult } from "./game";
import { currentRun, throwerStats } from "./turnStats";

const turn = (hits: number, over: Partial<TurnResult> = {}): TurnResult => ({
  hitsByStep: hits > 0 ? { "20": hits } : {},
  missStep: "20",
  misses: Math.max(0, 3 - hits),
  darts: 3,
  ...over,
});

describe("throwerStats", () => {
  it("splits a team's log by who threw, in the order they first threw", () => {
    const log = [turn(3, { thrower: "Per", counted: 3 }), turn(1, { thrower: "Ola", counted: 1 }), turn(2, { thrower: "Per", counted: 2 }), turn(0, { thrower: "Ola", counted: 0 })];
    const rows = throwerStats(log, "Per & Ola");
    expect(rows.map((r) => r.name)).toEqual(["Per", "Ola"]);
    expect(rows[0]).toMatchObject({ turns: 2, darts: 6, hits: 5, misses: 1, hitPct: 83, perfectTurns: 1, bestRun: 1, bestTurn: 3 });
    expect(rows[1]).toMatchObject({ turns: 2, darts: 6, hits: 1, misses: 5, hitPct: 17, perfectTurns: 0, bestRun: 0, bestTurn: 1 });
  });

  it("counts perfect turns in a row, and a turn without a count by its crosses", () => {
    const log = [turn(3, { counted: 3 }), turn(3, { counted: 3 }), turn(3, { counted: 2 }), turn(3), turn(3)];
    const [row] = throwerStats(log, "Per");
    expect(row.name).toBe("Per");
    expect(row.perfectTurns).toBe(4);
    expect(row.bestRun).toBe(2);
  });

  it("copes with holes in the log and an empty one", () => {
    expect(throwerStats([undefined, turn(1), undefined], "Per")[0].turns).toBe(1);
    expect(throwerStats([], "Per")).toEqual([]);
  });
});

describe("currentRun", () => {
  const full = (thrower?: string) => turn(3, { counted: 3, ...(thrower ? { thrower } : {}) });
  it("is three darts per unbroken perfect turn, counted back from the latest", () => {
    expect(currentRun([turn(1, { counted: 1 }), full(), full()], "Per")).toBe(6);
    expect(currentRun([full(), turn(2, { counted: 2 })], "Per")).toBe(0);
    expect(currentRun([], "Per")).toBe(0);
  });
  it("follows one member's own turns in a team log", () => {
    const log = [full("Per"), full("Ola"), full("Per"), turn(0, { thrower: "Ola", counted: 0 })];
    expect(currentRun(log, "Per")).toBe(6);
    expect(currentRun(log, "Ola")).toBe(0);
  });
});
