import { describe, expect, it } from "vitest";
import {
  aggregateTurns,
  applyHit,
  currentStepFor,
  emptyProgress,
  isFinished,
  isRegistrable,
  nextStepAfter,
  remainingMarks,
  STEPS,
  summarizeTurn,
  type HitRecord,
} from "./game";

describe("emptyProgress", () => {
  it("starts every step at 0 crosses", () => {
    const progress = emptyProgress();
    STEPS.forEach((s) => expect(progress[s]).toBe(0));
  });
});

describe("currentStepFor", () => {
  it("is the first step with fewer than 3 crosses", () => {
    const progress = emptyProgress();
    progress["20"] = 3;
    progress["19"] = 2;
    expect(currentStepFor(progress)).toBe("19");
  });

  it("is null once every step has 3 crosses", () => {
    const progress = emptyProgress();
    STEPS.forEach((s) => (progress[s] = 3));
    expect(currentStepFor(progress)).toBeNull();
  });
});

describe("nextStepAfter", () => {
  it("returns the following step in the fixed order", () => {
    expect(nextStepAfter("20")).toBe("19");
    expect(nextStepAfter("T")).toBe("BULL");
  });

  it("is null after the last step", () => {
    expect(nextStepAfter("BULL")).toBeNull();
  });
});

describe("isRegistrable", () => {
  it("only allows number/BULL steps on the player's own active step", () => {
    const progress = emptyProgress();
    expect(isRegistrable("20", "20", progress)).toBe(true);
    expect(isRegistrable("19", "20", progress)).toBe(false);
  });

  it("allows T and D to be pre-banked regardless of the active step", () => {
    const progress = emptyProgress();
    expect(isRegistrable("T", "20", progress)).toBe(true);
    expect(isRegistrable("D", "20", progress)).toBe(true);
  });

  it("refuses a step that's already closed (3 crosses)", () => {
    const progress = emptyProgress();
    progress["20"] = 3;
    expect(isRegistrable("20", "20", progress)).toBe(false);
  });

  it("refuses everything once there's no active step", () => {
    const progress = emptyProgress();
    expect(isRegistrable("T", null, progress)).toBe(false);
  });
});

describe("applyHit", () => {
  it("adds one cross", () => {
    expect(applyHit(0)).toBe(1);
    expect(applyHit(1)).toBe(2);
  });

  it("caps at 3 — a triple on an already-closed step doesn't overflow", () => {
    expect(applyHit(3)).toBe(3);
  });
});

describe("isFinished", () => {
  it("is false until every step has 3 crosses", () => {
    const progress = emptyProgress();
    STEPS.forEach((s) => (progress[s] = 3));
    progress["BULL"] = 2;
    expect(isFinished(progress)).toBe(false);
  });

  it("is true once every step has 3 crosses", () => {
    const progress = emptyProgress();
    STEPS.forEach((s) => (progress[s] = 3));
    expect(isFinished(progress)).toBe(true);
  });
});

describe("remainingMarks", () => {
  it("is 30 for a fresh player (10 steps x 3 crosses)", () => {
    expect(remainingMarks(emptyProgress())).toBe(30);
  });

  it("counts down as crosses land, ignoring any overflow above 3", () => {
    const progress = emptyProgress();
    progress["20"] = 3;
    progress["19"] = 1;
    expect(remainingMarks(progress)).toBe(30 - 3 - 1);
  });
});

describe("summarizeTurn", () => {
  const hit = (step: HitRecord["step"], prevCount: number, newCount: number): HitRecord => ({
    player: "Test",
    step,
    prevCount,
    newCount,
    turnIndex: 0,
  });

  it("is 3 bom on the active step when nothing was registered", () => {
    const result = summarizeTurn([], "20");
    expect(result).toEqual({ hitsByStep: {}, missStep: "20", misses: 3 });
  });

  it("counts a triple's 3 crosses as 3 treff from a single dart", () => {
    const result = summarizeTurn([hit("20", 0, 3)], "20");
    expect(result.hitsByStep["20"]).toBe(3);
    expect(result.misses).toBe(0);
  });

  it("attributes leftover darts as bom on the last hit step, not the pre-turn active step", () => {
    const result = summarizeTurn([hit("20", 2, 3)], "19");
    expect(result.hitsByStep["20"]).toBe(1);
    expect(result.missStep).toBe("20");
    expect(result.misses).toBe(2);
  });
});

describe("aggregateTurns", () => {
  it("sums hits and misses across turns, skipping rewound holes in the array", () => {
    const turns = [
      { hitsByStep: { "20": 2 }, missStep: "20" as const, misses: 1 },
      undefined,
      { hitsByStep: { "19": 1 }, missStep: "19" as const, misses: 2 },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately sparse, matching a rewound turn slot
    const totals = aggregateTurns(turns as any);
    expect(totals.hits).toBe(3);
    expect(totals.misses).toBe(3);
    expect(totals.hitsByStep).toEqual({ "20": 2, "19": 1 });
    expect(totals.missesByStep).toEqual({ "20": 1, "19": 2 });
  });
});
