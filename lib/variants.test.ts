import { afterEach, describe, expect, it } from "vitest";
import { applyHit, currentStepFor, emptyProgress, isFinished, remainingMarks, totalMarks, type Progress, type Step } from "./game";
import {
  RULES,
  VARIANT_ORDER,
  baseOf,
  botsSupported,
  getRules,
  hasStandRule,
  isPerfectClose,
  normalizeVariant,
  setGameVariant,
  withBase,
  withStandRule,
} from "./rules";
import { classifyThrow, parseSector } from "./scoliaMapping";
import { glyphFor } from "./markGlyph";
import { countingDarts, nextMemberIndex, standsAfterTurn } from "./teamTurn";
import { progressToBotState, solverFor } from "./botStrategy";

function board(overrides: Partial<Record<Step, number>>): Progress {
  return { ...emptyProgress(), ...overrides };
}

afterEach(() => setGameVariant("standard"));

describe("variant keys", () => {
  it("keeps the original names valid and knows five row lengths", () => {
    expect(VARIANT_ORDER.map((v) => RULES[v].target)).toEqual([1, 2, 3, 4, 5]);
    expect(normalizeVariant("standard")).toBe("standard");
    expect(normalizeVariant("onehit")).toBe("onehit");
  });

  it("falls back to standard on anything it does not know, and never throws", () => {
    for (const raw of [undefined, null, "", "nope", 3, {}, "t9", "+stand-nope"]) {
      expect(normalizeVariant(raw)).toBe("standard");
    }
  });

  it("keeps the stand rule when the base is unknown — the half that can still be honoured", () => {
    expect(normalizeVariant("nope+stand")).toBe("standard+stand");
  });

  it("carries the stand rule as a suffix and strips or adds it without touching the length", () => {
    expect(withStandRule("t4", true)).toBe("t4+stand");
    expect(withStandRule("t4+stand", false)).toBe("t4");
    expect(withStandRule("t4+stand", true)).toBe("t4+stand");
    expect(baseOf("t5+stand")).toBe("t5");
    expect(hasStandRule("t5+stand")).toBe(true);
    expect(hasStandRule("t5")).toBe(false);
    expect(hasStandRule(undefined)).toBe(false);
    expect(withBase("standard+stand", "onehit")).toBe("onehit+stand");
    expect(withBase("onehit", "t5")).toBe("t5");
  });

  it("sets the module-wide rules from a key, stand rule and all", () => {
    setGameVariant("t4+stand");
    expect(getRules()).toMatchObject({ target: 4, base: "t4", variant: "t4+stand", standOnThree: true });
    setGameVariant("t4");
    expect(getRules()).toMatchObject({ target: 4, standOnThree: false });
    setGameVariant(undefined);
    expect(getRules()).toMatchObject({ target: 3, base: "standard", standOnThree: false });
  });

  it("only the standard row length counts in the career statistics", () => {
    expect(VARIANT_ORDER.filter((v) => RULES[v].countsForStats)).toEqual(["standard"]);
    setGameVariant("standard+stand");
    expect(getRules().countsForStats).toBe(true);
  });
});

describe.each([2, 4, 5] as const)("%i treff per seksjon", (target) => {
  const key = `t${target}` as const;

  it("closes a row on that many crosses and counts the board accordingly", () => {
    setGameVariant(key);
    expect(applyHit(target - 1)).toBe(target);
    expect(applyHit(target)).toBe(target);
    expect(totalMarks()).toBe(10 * target);
    expect(remainingMarks(emptyProgress())).toBe(10 * target);
    expect(currentStepFor(board({ "20": target - 1 }))).toBe("20");
    expect(currentStepFor(board({ "20": target }))).toBe("19");
  });

  it("finishes only when all ten rows are full", () => {
    setGameVariant(key);
    const full = board({ "20": target, "19": target, "18": target, "17": target, "16": target, "15": target, "14": target, D: target, T: target, BULL: target });
    expect(isFinished(full)).toBe(true);
    expect(isFinished({ ...full, BULL: target - 1 })).toBe(false);
  });

  it("still asks the triple question when the number has more than one cross to go", () => {
    setGameVariant(key);
    const open = classifyThrow(parseSector("T17", false), "17", emptyProgress());
    expect(open.ambiguous).toEqual({ ringStep: "T", number: "17", multiplier: 3 });
    // One to go: redirecting pays the same single cross the ring does — not worth asking.
    const lastCross = classifyThrow(parseSector("T17", false), "17", board({ "17": target - 1 }));
    expect(lastCross).toEqual({ step: "T", crosses: 1, ambiguous: null });
  });

  it("a full ring forces the redirect onto the number", () => {
    setGameVariant(key);
    const result = classifyThrow(parseSector("T17", false), "17", board({ T: target }));
    expect(result).toEqual({ step: "17", crosses: 3, ambiguous: null });
  });

});

describe("bots", () => {
  it("play the shorter games only — the longer ones' model takes seconds to build", () => {
    expect(VARIANT_ORDER.filter((v) => botsSupported(v))).toEqual(["onehit", "t2", "standard"]);
    expect(botsSupported("t4")).toBe(false);
    expect(botsSupported("t5+stand")).toBe(false);
    expect(botsSupported("standard+stand")).toBe(true);
    expect(botsSupported(undefined)).toBe(true);
    expect(botsSupported("garbage" as never)).toBe(true);
  });

  it("at two crosses the bot gets a model of its own, and knows a fresh board is worse than a nearly finished one", () => {
    setGameVariant("t2");
    const solver = solverFor("3");
    const full = { "20": 2, "19": 2, "18": 2, "17": 2, "16": 2, "15": 2, "14": 2, D: 2, T: 2 } as const;
    const fresh = solver.expectedRemaining(progressToBotState(emptyProgress()));
    const nearly = solver.expectedRemaining(progressToBotState(board({ ...full, BULL: 1 })));
    expect(fresh).toBeGreaterThan(nearly);
    expect(nearly).toBeGreaterThan(0);
    setGameVariant("standard");
    expect(solverFor("3")).not.toBe(solver);
  });

  it("the stand rule does not change the bot's model: one solver per row length", () => {
    setGameVariant("t2");
    const plain = solverFor("3");
    setGameVariant("t2+stand");
    expect(solverFor("3")).toBe(plain);
  });
});

describe("isPerfectClose — the hard way exists only at three crosses", () => {
  it("is three darts, one cross each, closing a row at three", () => {
    setGameVariant("standard");
    expect(isPerfectClose(3, 3)).toBe(true);
    expect(isPerfectClose(2, 3)).toBe(false);
  });

  it("never happens at the other row lengths", () => {
    for (const key of ["onehit", "t2", "t4", "t5"] as const) {
      setGameVariant(key);
      expect(isPerfectClose(3, RULES[key].target)).toBe(false);
      expect(isPerfectClose(1, RULES[key].target)).toBe(false);
    }
  });
});

describe("glyphFor — one mark, any row length", () => {
  it("is exactly the old three stages at three crosses", () => {
    expect(glyphFor(0, 3)).toEqual({ slash: false, cross: false, ring: 0 });
    expect(glyphFor(1, 3)).toEqual({ slash: true, cross: false, ring: 0 });
    expect(glyphFor(2, 3)).toEqual({ slash: true, cross: true, ring: 0 });
    expect(glyphFor(3, 3)).toEqual({ slash: true, cross: true, ring: 1 });
  });

  it("a closed row looks the same at every length, and an over-full one too", () => {
    for (const target of [1, 2, 3, 4, 5]) {
      expect(glyphFor(target, target)).toEqual({ slash: true, cross: true, ring: 1 });
      expect(glyphFor(target + 2, target)).toEqual({ slash: true, cross: true, ring: 1 });
    }
  });

  it("spreads the ring over the crosses past the second on a longer row", () => {
    expect(glyphFor(3, 4).ring).toBeCloseTo(0.5);
    expect(glyphFor(3, 5).ring).toBeCloseTo(1 / 3);
    expect(glyphFor(4, 5).ring).toBeCloseTo(2 / 3);
    // Strictly growing, and never complete before the target.
    for (const target of [4, 5]) {
      let last = -1;
      for (let n = 0; n < target; n++) {
        const ring = glyphFor(n, target).ring;
        expect(ring).toBeGreaterThanOrEqual(last);
        expect(ring).toBeLessThan(1);
        last = ring;
      }
    }
  });

  it("two crosses close a row at two, and a negative count draws nothing", () => {
    expect(glyphFor(1, 2)).toEqual({ slash: true, cross: false, ring: 0 });
    expect(glyphFor(-3, 3)).toEqual({ slash: false, cross: false, ring: 0 });
  });
});

describe("the stand rule", () => {
  const dart = (scored: boolean, i = 0) => ({ kind: "dart" as const, dartIndex: i, sector: "S20", bounceout: false, scored, coordinates: [0, 0] as [number, number] });
  const tap = { kind: "tap" as const, step: "20" as Step };
  const untap = { kind: "untap" as const, step: "20" as Step };

  it("counts darts that scored, not crosses and not misses", () => {
    expect(countingDarts([dart(true), dart(false), dart(true)])).toBe(2);
    expect(countingDarts([dart(true), dart(true), dart(true)])).toBe(3);
    expect(countingDarts([])).toBe(0);
  });

  it("counts manual taps, and a take-back removes one", () => {
    expect(countingDarts([tap, tap, tap])).toBe(3);
    expect(countingDarts([tap, tap, tap, untap])).toBe(2);
    expect(countingDarts([untap])).toBe(0);
  });

  it("stands only with the rule on and all three darts counting", () => {
    expect(standsAfterTurn(true, 3)).toBe(true);
    expect(standsAfterTurn(true, 2)).toBe(false);
    expect(standsAfterTurn(true, 0)).toBe(false);
    expect(standsAfterTurn(false, 3)).toBe(false);
  });

  it("rotates normally, and stays put when standing", () => {
    expect(nextMemberIndex(0, 2, false)).toBe(1);
    expect(nextMemberIndex(1, 2, false)).toBe(0);
    expect(nextMemberIndex(0, 3, false)).toBe(1);
    expect(nextMemberIndex(2, 3, false)).toBe(0);
    expect(nextMemberIndex(1, 2, true)).toBe(1);
    expect(nextMemberIndex(0, 2, true)).toBe(0);
  });

  it("is harmless on a one-member team and on garbage", () => {
    expect(nextMemberIndex(0, 1, false)).toBe(0);
    expect(nextMemberIndex(0, 1, true)).toBe(0);
    expect(nextMemberIndex(5, 0, false)).toBe(0);
    expect(nextMemberIndex(-1, 2, false)).toBe(0);
    expect(nextMemberIndex(7, 2, false)).toBe(0);
  });

  it("a hand-over sequence reads right over several turns", () => {
    // Two members, rule on. Turn results: 3 counted, 3 counted, 1 counted, 3 counted.
    let idx = 0;
    const thrown: number[] = [];
    for (const counted of [3, 3, 1, 3]) {
      thrown.push(idx);
      idx = nextMemberIndex(idx, 2, standsAfterTurn(true, counted));
    }
    expect(thrown).toEqual([0, 0, 0, 1]);
    expect(idx).toBe(1);
  });
});
