import { describe, expect, it } from "vitest";
import { emptyProgress, STEPS, type Progress } from "./game";
import { dartsToFinish, finishState } from "./finishState";

/** A board with everything closed except what is listed (crosses already on those rows). */
const board = (open: Partial<Record<(typeof STEPS)[number], number>>): Progress => {
  const p = emptyProgress();
  STEPS.forEach((s) => (p[s] = s in open ? (open[s] as number) : 3));
  return p;
};

describe("matchdart and out", () => {
  it("is a match dart when only the bull is left and an inner bull would finish it", () => {
    expect(finishState(board({ BULL: 1 }), 3)).toBe("matchdart"); // two crosses missing
    expect(finishState(board({ BULL: 2 }), 3)).toBe("matchdart"); // one missing
  });

  it("is not a match dart when the bull is untouched: that takes a 25 and a bull", () => {
    expect(finishState(board({ BULL: 0 }), 3)).toBe("out"); // two darts, within one turn
  });

  it("says out for a double or a triple that is missing, alone", () => {
    expect(finishState(board({ D: 2 }), 3)).toBe("out");
    expect(finishState(board({ T: 2 }), 3)).toBe("out");
  });

  it("says out for two or three missing on the last number", () => {
    expect(finishState(board({ "14": 1 }), 3)).toBe("out"); // a double 14 takes the two
    expect(finishState(board({ "14": 0 }), 3)).toBe("out"); // a triple takes the three
  });

  it("says out for a double, a 25 and a bull: three darts", () => {
    const b = board({ D: 2, BULL: 0 });
    expect(dartsToFinish(b, 3)).toBe(3);
    expect(finishState(b, 3)).toBe("out");
  });

  it("says neither when it takes more than one turn", () => {
    expect(finishState(board({ D: 0 }), 3)).toBe("out"); // three doubles: three darts
    expect(finishState(board({ D: 0, BULL: 0 }), 3)).toBeNull(); // five
    expect(finishState(board({ "14": 0, D: 2, T: 2, BULL: 1 }), 3)).toBeNull();
    expect(finishState(emptyProgress(), 3)).toBeNull();
  });

  it("says neither for a finished board or nothing", () => {
    expect(finishState(board({}), 3)).toBeNull();
    expect(finishState(undefined, 3)).toBeNull();
  });

  it("works for a board that closes on fewer crosses", () => {
    const p = emptyProgress();
    STEPS.forEach((s) => (p[s] = 1));
    p.BULL = 0;
    expect(finishState(p, 1)).toBe("matchdart"); // one cross on the bull
  });
});
