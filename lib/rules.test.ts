import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyHit, currentStepFor, emptyProgress, isFinished, isRegistrable, remainingMarks, totalMarks, type Progress, type Step } from "./game";
import { RULES, getRules, setGameVariant } from "./rules";
import { classifyThrow, parseSector } from "./scoliaMapping";
import { progressToBotState, solverFor } from "./botStrategy";

function board(overrides: Partial<Record<Step, number>>): Progress {
  return { ...emptyProgress(), ...overrides };
}

describe("rules — standard is the default", () => {
  it("is standard until told otherwise, and falls back to standard on nonsense", () => {
    expect(getRules().variant).toBe("standard");
    setGameVariant(undefined);
    expect(getRules().target).toBe(3);
    setGameVariant("nope" as never);
    expect(getRules().variant).toBe("standard");
  });
});

describe("1 treff", () => {
  beforeEach(() => setGameVariant("onehit"));
  afterEach(() => setGameVariant("standard"));

  it("closes a row on one cross and needs ten in total", () => {
    expect(applyHit(0)).toBe(1);
    expect(applyHit(1)).toBe(1);
    expect(totalMarks()).toBe(10);
    expect(remainingMarks(emptyProgress())).toBe(10);
    expect(remainingMarks(board({ "20": 1, T: 1 }))).toBe(8);
  });

  it("walks the numbers in order, then D and T, then bull — same order, one cross each", () => {
    expect(currentStepFor(emptyProgress())).toBe("20");
    expect(currentStepFor(board({ "20": 1 }))).toBe("19");
    const allNumbers = board({ "20": 1, "19": 1, "18": 1, "17": 1, "16": 1, "15": 1, "14": 1 });
    expect(currentStepFor(allNumbers)).toBe("D");
    expect(currentStepFor({ ...allNumbers, D: 1, T: 1 })).toBe("BULL");
    expect(isFinished({ ...allNumbers, D: 1, T: 1, BULL: 1 })).toBe(true);
    expect(isFinished({ ...allNumbers, D: 1, T: 1 })).toBe(false);
  });

  it("a T20 while on 20 is a triple and nothing else — no choice", () => {
    const result = classifyThrow(parseSector("T20", false), "20", emptyProgress());
    expect(result).toEqual({ step: "T", crosses: 1, ambiguous: null });
  });

  it("a double or triple on another number banks the ring; a single on another number is nothing", () => {
    expect(classifyThrow(parseSector("D5", false), "20", emptyProgress()).step).toBe("D");
    const single = classifyThrow(parseSector("S19", false), "20", emptyProgress());
    expect(single.step).toBe("19");
    expect(isRegistrable("19", "20", emptyProgress())).toBe(false);
  });

  it("a ring already banked refuses a second cross", () => {
    expect(isRegistrable("T", "20", board({ T: 1 }))).toBe(false);
    expect(isRegistrable("D", "20", board({ T: 1 }))).toBe(true);
  });

  it("the bull before everything is done is a double; on BULL the outer ring is enough", () => {
    expect(classifyThrow(parseSector("Bull", false), "20", emptyProgress())).toEqual({ step: "D", crosses: 1, ambiguous: null });
    const onBull = classifyThrow(parseSector("25", false), "BULL", emptyProgress());
    expect(onBull.step).toBe("BULL");
    expect(applyHit(0)).toBe(1);
  });

  it("the bot's model is built against one cross per row", () => {
    const state = progressToBotState(board({ "20": 1, "19": 1 }));
    expect(state.numberIndex).toBe(2);
    const solver = solverFor("3");
    const fresh = solver.expectedRemaining(progressToBotState(emptyProgress()));
    const nearlyDone = solver.expectedRemaining(progressToBotState(board({ "20": 1, "19": 1, "18": 1, "17": 1, "16": 1, "15": 1, "14": 1, D: 1, T: 1 })));
    expect(fresh).toBeGreaterThan(nearlyDone);
    expect(nearlyDone).toBeGreaterThan(0);
    // The standard solver is a different object, built against three.
    setGameVariant("standard");
    expect(solverFor("3")).not.toBe(solver);
    expect(RULES.standard.target).toBe(3);
  });
});
