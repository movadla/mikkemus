import { describe, expect, it } from "vitest";
import { emptyProgress, type PendingAmbiguous, type Progress, type Step } from "./game";
import { applyDartToBoard, replayDiscardedSingles, type TurnDart } from "./turnResolution";

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

function dart(dartIndex: number, sector: string, scored: boolean, bounceout = false): TurnDart {
  return { dartIndex, sector, bounceout, scored };
}

describe("replayDiscardedSingles — darts thrown at a number that only became active afterwards", () => {
  it("pays out the single on the next number thrown after the parked dart (the 17/16 case)", () => {
    // On 17: T17 parked at dart 0, S16 thrown away at dart 1, redirect fills 17 at Confirm.
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "T17", true), dart(1, "S16", false)], 0);
    expect(result.board["16"]).toBe(1);
    expect(result.added).toEqual([{ step: "16", prevCount: 0, newCount: 1, dartIndex: 1 }]);
  });

  it("leaves darts thrown BEFORE the parked one alone — 17 really was active then", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "S16", false), dart(1, "T17", true)], 1);
    expect(result.board["16"]).toBe(0);
    expect(result.added).toEqual([]);
  });

  it("does nothing when the redirect did not finish the number", () => {
    // D17 from 0/3 leaves 17 on 2 — still the active number, nothing has changed for later darts.
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 2 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "D17", true), dart(1, "S16", false)], 0);
    expect(result.board["16"]).toBe(0);
    expect(result.added).toEqual([]);
  });

  it("skips darts that already scored on the number and darts on other numbers", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3 });
    const darts = [
      dart(0, "T17", true),
      dart(1, "S15", false), // wrong number
      dart(2, "D5", false), // wrong number, and a double at that
    ];
    const result = replayDiscardedSingles(afterRedirect, darts, 0);
    expect(result.added).toEqual([]);
    expect(result.reopened).toEqual([]);
  });

  it("reopens a double or triple on the newly active number as a choice instead of leaving it on the ring", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3, D: 1 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "T17", true), dart(1, "D16", true)], 0);
    // Nothing moves yet — the cross stays on D until the player answers.
    expect(result.board["16"]).toBe(0);
    expect(result.board.D).toBe(1);
    expect(result.reopened).toEqual([{ dartIndex: 1, ring: "D", multiplier: 2 }]);
  });

  it("does not reopen a ring dart once the singles before it have filled the number", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3, "16": 2, T: 1 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "T17", true), dart(1, "S16", false), dart(2, "T16", true)], 0);
    expect(result.board["16"]).toBe(3);
    expect(result.reopened).toEqual([]);
  });

  it("ignores bounce-outs and misses even when their sector string says the right number", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "T17", true), dart(1, "S16", false, true)], 0);
    expect(result.added).toEqual([]);
  });

  it("caps at 3/3 on the newly active number", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3, "16": 2 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "T17", true), dart(1, "S16", false), dart(2, "s16", false)], 0);
    expect(result.board["16"]).toBe(3);
    expect(result.added).toHaveLength(1);
  });

  it("does not replay into D, T or BULL — only a number can be entered this way", () => {
    const afterRedirect = board({ "20": 3, "19": 3, "18": 3, "17": 3, "16": 3, "15": 3, "14": 3 });
    const result = replayDiscardedSingles(afterRedirect, [dart(0, "T14", true), dart(1, "D5", false)], 0);
    expect(result.added).toEqual([]);
  });

  it("never mutates the board it was given", () => {
    const before = board({ "20": 3, "19": 3, "18": 3, "17": 3 });
    const snapshot = { ...before };
    replayDiscardedSingles(before, [dart(0, "T17", true), dart(1, "S16", false)], 0);
    expect(before).toEqual(snapshot);
  });
});
