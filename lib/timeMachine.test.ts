import { describe, expect, it } from "vitest";
import type { TurnResult } from "./game";
import { buildTimeline } from "./timeMachine";

const turn = (hits: Record<string, number>, thrower?: string): TurnResult => ({ hitsByStep: hits, missStep: null, misses: 0, darts: 3, ...(thrower ? { thrower } : {}) });

describe("the match, turn by turn", () => {
  // Vadla and Monge, target 3. Vadla: 3, 3, 4; Monge: 1, 3, 0 (turns taken in that order).
  const log = {
    Vadla: [turn({ "20": 3 }), turn({ "19": 3 }), turn({ "18": 3, "17": 1 })],
    Monge: [turn({ "20": 1 }), turn({ "20": 2, "19": 1 }), turn({})],
  };
  const odds = [0.55, 0.62, 0.7, 0.8, 0.75, 0.9].map((p, i) => ({ key: String(i), sides: [{ name: "Vadla", p, odds: 1 / p }, { name: "Monge", p: 1 - p, odds: 1 / (1 - p) }] }));
  const t = buildTimeline({ players: ["Vadla", "Monge"], turnLog: log, snapshots: odds, target: 3, winner: "Vadla" });

  it("has a frame for before the first dart and one per turn, in the order they were thrown", () => {
    expect(t.frames.length).toBe(7);
    expect(t.frames.map((f) => f.side)).toEqual([null, "Vadla", "Monge", "Vadla", "Monge", "Vadla", "Monge"]);
    expect(t.frames[0].total).toEqual({ Vadla: 0, Monge: 0 });
  });

  it("adds each turn's crosses to the board, capped at what a row takes", () => {
    const f = t.frames[4]; // after Vadla 3, Monge 1, Vadla 3, Monge 3
    expect(f.total).toEqual({ Vadla: 6, Monge: 4 });
    expect(f.progress.Monge["20"]).toBe(3);
    expect(f.progress.Monge["19"]).toBe(1);
    expect(t.frames[6].total.Vadla).toBe(10);
  });

  it("takes the odds from the start of each turn, and the last frame is the result", () => {
    expect(t.frames[2].chance!.Vadla).toBeCloseTo(0.7, 6);
    expect(t.frames[6].chance).toEqual({ Vadla: 1, Monge: 0 });
  });

  it("finds the big moments", () => {
    const text = t.events.map((e) => e.text);
    expect(text).toContain("Storrunde: Vadla +4");
    expect(text).toContain("Seier: Vadla");
    expect(t.events[t.events.length - 1].kind).toBe("win");
  });

  it("reads a lead that changes hands", () => {
    // Monge leads after turn 2 (3 against 1), then Vadla retakes it.
    const log2 = { A: [turn({ "20": 1 }), turn({ "19": 3 }), turn({ "18": 3 })], B: [turn({ "20": 3 }), turn({ "19": 1 }), turn({ "18": 1 })] };
    const e = buildTimeline({ players: ["A", "B"], turnLog: log2, snapshots: [], target: 3, winner: "A" }).events;
    expect(e.some((x) => x.kind === "lead")).toBe(true);
  });

  it("has no odds to show when none were kept", () => {
    const x = buildTimeline({ players: ["Vadla", "Monge"], turnLog: log, snapshots: [], target: 3, winner: "Vadla" });
    expect(x.frames.every((f) => f.chance === null)).toBe(true);
  });

  it("copes with a missing turn and a team's thrower", () => {
    const x = buildTimeline({ players: ["Lag", "Solo"], turnLog: { Lag: [turn({ "20": 4 }, "Ola"), undefined, turn({}, "Per")], Solo: [turn({ "20": 1 })] }, snapshots: [], target: 3, winner: "Lag" });
    expect(x.frames[1].thrower).toBe("Ola");
    expect(x.events.find((e) => e.kind === "big")!.text).toBe("Storrunde: Ola +4");
  });
});
