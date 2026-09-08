import { describe, expect, it } from "vitest";
import {
  aggregateTurns,
  ambiguousBlockingRing,
  applyHit,
  chainCrosses,
  currentStepFor,
  emptyProgress,
  isFinished,
  isRegistrable,
  meaningfulPending,
  nextStepAfter,
  remainingMarks,
  removeOneCross,
  STEPS,
  summarizeTurn,
  type HitRecord,
  type PendingAmbiguous,
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

describe("meaningfulPending", () => {
  function pendingOn(number: "19" | "18", key: number): PendingAmbiguous {
    return {
      key,
      hitRecord: { player: "A", step: "D", prevCount: 0, newCount: 1, turnIndex: 0 },
      ringStep: "D",
      number,
      multiplier: 2,
    };
  }

  it("keeps a choice whose number still has room", () => {
    const progress = { ...emptyProgress(), "19": 1 };
    expect(meaningfulPending([pendingOn("19", 1)], progress)).toHaveLength(1);
  });

  it("drops a choice whose number filled up after an earlier choice in the same turn", () => {
    // Two D19s while 19 sat at 1/3 queue two choices; answering the first with
    // "complete 19" fills it, so the second one can no longer change anything —
    // and answering it would roll its D cross back without adding any, losing a cross.
    const progress = { ...emptyProgress(), "19": 3 };
    expect(meaningfulPending([pendingOn("19", 1), pendingOn("19", 2)], progress)).toEqual([]);
  });

  it("only drops the choices whose own number is full", () => {
    const progress = { ...emptyProgress(), "19": 3, "18": 2 };
    const kept = meaningfulPending([pendingOn("19", 1), pendingOn("18", 2)], progress);
    expect(kept.map((p) => p.number)).toEqual(["18"]);
  });
});

describe("chainCrosses", () => {
  it("stacks a single dart's crosses in sequence", () => {
    expect(chainCrosses(0, 3)).toEqual([
      { prevCount: 0, newCount: 1 },
      { prevCount: 1, newCount: 2 },
      { prevCount: 2, newCount: 3 },
    ]);
  });

  it("stops at the cap instead of overfilling", () => {
    expect(chainCrosses(2, 3)).toEqual([{ prevCount: 2, newCount: 3 }]);
    expect(chainCrosses(3, 3)).toEqual([]);
  });
});

describe("ambiguousBlockingRing", () => {
  const parked = (key: number, ringStep: "D" | "T"): PendingAmbiguous => ({
    key,
    ringStep,
    number: "17",
    multiplier: ringStep === "T" ? 3 : 2,
    hitRecord: { player: "A", step: ringStep, prevCount: 2, newCount: 3, turnIndex: 0 },
  });

  it("frees the ring when it is full only because of an undecided triple", () => {
    const progress = { ...emptyProgress(), "17": 2, T: 3 };
    expect(ambiguousBlockingRing([parked(1, "T")], "T", progress)).toEqual(parked(1, "T"));
  });

  it("leaves the ring alone while it still has room", () => {
    const progress = { ...emptyProgress(), "17": 2, T: 2 };
    expect(ambiguousBlockingRing([parked(1, "T")], "T", progress)).toBeNull();
  });

  it("only frees the ring the incoming dart actually needs", () => {
    const progress = { ...emptyProgress(), T: 3, D: 3 };
    expect(ambiguousBlockingRing([parked(1, "T")], "D", progress)).toBeNull();
  });

  it("never applies to number steps or BULL", () => {
    const progress = { ...emptyProgress(), "17": 3, BULL: 3 };
    expect(ambiguousBlockingRing([parked(1, "T")], "17", progress)).toBeNull();
    expect(ambiguousBlockingRing([parked(1, "T")], "BULL", progress)).toBeNull();
  });

  it("picks the most recently parked dart on that ring", () => {
    const progress = { ...emptyProgress(), T: 3 };
    const pending = [parked(1, "T"), parked(2, "D"), parked(3, "T")];
    expect(ambiguousBlockingRing(pending, "T", progress)?.key).toBe(3);
  });

  it("does nothing when no dart is parked there", () => {
    const progress = { ...emptyProgress(), T: 3 };
    expect(ambiguousBlockingRing([], "T", progress)).toBeNull();
  });

  // The turn that surfaced the rule: 17 on 1/3 and T on 2/3, then T17 -> 17 -> T2.
  // Walked through the way processDart applies it, to pin the outcome end to end.
  it("closes both rows on the turn that used to throw the last dart away", () => {
    const board = { ...emptyProgress(), "17": 1, T: 2 };

    // Dart 1, T17: banked on T for now, and parked as undecided.
    board.T = 3;
    const held = parked(1, "T");
    held.hitRecord = { player: "A", step: "T", prevCount: 2, newCount: 3, turnIndex: 0 };

    // Dart 2, plain 17.
    board["17"] = 2;

    // Dart 3, T2 — a slenger, so it can only ever score on T, and T looks full.
    const blocking = ambiguousBlockingRing([held], "T", board);
    expect(blocking).not.toBeNull();

    // Un-park, pay the parked dart out on its number, then let this dart take the ring.
    board.T = blocking!.hitRecord.prevCount;
    for (const d of chainCrosses(board[blocking!.number], blocking!.multiplier)) board[blocking!.number] = d.newCount;
    for (const d of chainCrosses(board.T, 1)) board.T = d.newCount;

    expect(board["17"]).toBe(3);
    expect(board.T).toBe(3);
  });
});

describe("removeOneCross", () => {
  it("takes exactly one cross off", () => {
    expect(removeOneCross(3)).toBe(2);
    expect(removeOneCross(1)).toBe(0);
  });

  it("never goes below zero", () => {
    expect(removeOneCross(0)).toBe(0);
  });

  // The bug it exists for: a parked triple's stored prevCount goes stale the moment anything
  // else lands on the same ring, so restoring it wipes the later dart's cross too.
  it("is not the same as restoring a stale prevCount", () => {
    const parkedPrevCount = 1; // ring was 1 -> 2 when the triple parked there
    const ringNow = 3; // a later dart in the same turn took it 2 -> 3
    expect(removeOneCross(ringNow)).toBe(2);
    expect(parkedPrevCount).not.toBe(removeOneCross(ringNow));
  });
});
