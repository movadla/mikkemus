import { describe, expect, it } from "vitest";
import { emptyProgress, type PendingAmbiguous, type Progress, type Step } from "./game";
import { applyDartToBoard } from "./turnResolution";

function board(overrides: Partial<Record<Step, number>>): Progress {
  return { ...emptyProgress(), ...overrides };
}

function parkedOn(ringStep: "D" | "T", number: Step, prevCount: number): PendingAmbiguous {
  return {
    key: 1,
    ringStep,
    number,
    multiplier: ringStep === "T" ? 3 : 2,
    hitRecord: { player: "A", step: ringStep, prevCount, newCount: prevCount + 1, turnIndex: 0 },
  };
}

/** Every cross the caller is told about must be a cross the board actually gained. This is the
 *  invariant the whole turn log rests on — see progressLogMismatch. */
function totalGained(before: Progress, after: Progress): number {
  return (Object.keys(before) as Step[]).reduce((sum, s) => sum + (after[s] - before[s]), 0);
}

describe("applyDartToBoard — ordinary darts", () => {
  it("adds one cross to the step", () => {
    const before = board({ "20": 1 });
    const result = applyDartToBoard(before, "20", 1, null);
    expect(result.board["20"]).toBe(2);
    expect(result.added).toEqual([{ step: "20", prevCount: 1, newCount: 2 }]);
  });

  it("stacks a multi-cross dart and reports each cross separately", () => {
    const result = applyDartToBoard(board({}), "20", 3, null);
    expect(result.board["20"]).toBe(3);
    expect(result.added).toHaveLength(3);
  });

  it("adds nothing to a full step", () => {
    const before = board({ T: 3 });
    const result = applyDartToBoard(before, "T", 1, null);
    expect(result.board).toEqual(before);
    expect(result.added).toEqual([]);
  });

  it("leaves the board untouched apart from the step it lands on", () => {
    const before = board({ "20": 1, "19": 2, D: 1 });
    const after = applyDartToBoard(before, "19", 1, null).board;
    expect(after["20"]).toBe(1);
    expect(after.D).toBe(1);
  });
});

describe("applyDartToBoard — freeing a parked triple/double", () => {
  it("moves the parked dart to its number and lets this one take the ring", () => {
    // The turn that started all of this: 17 on 1/3, T on 2/3, and a T17 parked on T. A slenger
    // on T then arrives to a full row. Both rows should end up closed, not one.
    const before = board({ "17": 2, T: 3 });
    const result = applyDartToBoard(before, "T", 1, parkedOn("T", "17", 2));
    expect(result.board["17"]).toBe(3);
    expect(result.board.T).toBe(3);
    expect(result.unparked).toBe(true);
  });

  it("reports exactly the crosses the board gained, and no others", () => {
    const before = board({ "17": 2, T: 3 });
    const result = applyDartToBoard(before, "T", 1, parkedOn("T", "17", 2));
    const reported = result.added.length;
    // One off the ring, one onto 17, one back onto the ring: net +1, and two records.
    expect(totalGained(before, result.board)).toBe(1);
    expect(reported).toBe(2);
  });

  it("takes one cross off the ring rather than restoring a stale prevCount", () => {
    // The parked dart went 1 -> 2, but a later dart in the same turn took the ring to 3.
    // Writing prevCount back would drop the row to 1 and erase that later dart's cross.
    const before = board({ "19": 0, T: 3 });
    const result = applyDartToBoard(before, "T", 1, parkedOn("T", "19", 1));
    // 3 -> 2 for the un-park, then this dart puts it back to 3.
    expect(result.board.T).toBe(3);
    expect(result.board["19"]).toBe(3);
  });

  it("still frees the ring when the number is already full, costing nothing", () => {
    const before = board({ "18": 3, D: 3 });
    const result = applyDartToBoard(before, "D", 1, parkedOn("D", "18", 2));
    expect(result.board["18"]).toBe(3);
    expect(result.board.D).toBe(3);
    expect(totalGained(before, result.board)).toBe(0);
  });

  it("caps the redirected payout instead of overfilling the number", () => {
    const before = board({ "20": 2, T: 3 });
    const result = applyDartToBoard(before, "T", 1, parkedOn("T", "20", 2));
    expect(result.board["20"]).toBe(3);
    expect(result.added.filter((a) => a.step === "20")).toHaveLength(1);
  });

  it("never mutates the board it was given", () => {
    const before = board({ "17": 2, T: 3 });
    const snapshot = { ...before };
    applyDartToBoard(before, "T", 1, parkedOn("T", "17", 2));
    expect(before).toEqual(snapshot);
  });
});
