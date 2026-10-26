import { afterEach, describe, expect, it } from "vitest";
import { emptyProgress, isRegistrable, type Progress, type Step } from "./game";
import { baseOf, getRules, hasForcedRings, hasStandRule, normalizeVariant, setGameVariant, withBase, withForcedRings, withStandRule } from "./rules";
import { classifyThrow, parseSector } from "./scoliaMapping";

const board = (o: Partial<Record<Step, number>> = {}): Progress => ({ ...emptyProgress(), ...o });

afterEach(() => setGameVariant("standard"));

describe("the variant key with forced rings", () => {
  it("carries the row length, the stand rule and forced rings, in that order", () => {
    expect(withForcedRings("standard", true)).toBe("standard+forced");
    expect(withForcedRings(withStandRule("t4", true), true)).toBe("t4+stand+forced");
    expect(normalizeVariant("t4+stand+forced")).toBe("t4+stand+forced");
    expect(normalizeVariant("standard+forced")).toBe("standard+forced");
    expect(normalizeVariant("nonsense+forced")).toBe("standard+forced");
  });

  it("keeps the other parts when one is changed", () => {
    const key = "t2+stand+forced";
    expect(baseOf(key)).toBe("t2");
    expect(hasStandRule(key)).toBe(true);
    expect(hasForcedRings(key)).toBe(true);
    expect(withStandRule(key, false)).toBe("t2+forced");
    expect(withBase(key, "t5")).toBe("t5+stand+forced");
    expect(withForcedRings(key, false)).toBe("t2+stand");
  });

  it("makes the older keys the same as before", () => {
    for (const k of ["standard", "onehit", "t4", "standard+stand", "t5+stand"]) expect(normalizeVariant(k)).toBe(k);
    expect(hasForcedRings("standard+stand")).toBe(false);
  });

  it("is another game for the career figures", () => {
    setGameVariant("standard");
    expect(getRules().countsForStats).toBe(true);
    setGameVariant("standard+forced");
    expect(getRules().forcedRings).toBe(true);
    expect(getRules().countsForStats).toBe(false);
  });
});

describe("forced rings", () => {
  it("counts a double or triple on 14 to 20 for D and T, even on another number than the one being worked", () => {
    setGameVariant("standard+forced");
    expect(classifyThrow(parseSector("T18", false), "20", board())).toEqual({ step: "T", crosses: 1, ambiguous: null });
    expect(classifyThrow(parseSector("D14", false), "20", board())).toEqual({ step: "D", crosses: 1, ambiguous: null });
  });

  it("counts nothing for a double or triple on 13 or below", () => {
    setGameVariant("standard+forced");
    for (const s of ["D1", "T5", "D13", "T13", "D8"]) expect(classifyThrow(parseSector(s, false), "20", board()), s).toEqual({ step: null, crosses: 0, ambiguous: null });
  });

  it("does not turn the bullseye into a double before BULL is up", () => {
    setGameVariant("standard+forced");
    const r = classifyThrow(parseSector("Bull", false), "20", board());
    expect(isRegistrable(r.step as Step, "20", board())).toBe(false);
  });

  it("is the old game when not forced: a D1 is a double, and the bullseye early is one too", () => {
    setGameVariant("standard");
    expect(classifyThrow(parseSector("D1", false), "20", board())).toEqual({ step: "D", crosses: 1, ambiguous: null });
    expect(classifyThrow(parseSector("Bull", false), "20", board())).toEqual({ step: "D", crosses: 1, ambiguous: null });
  });

  it("still asks about the own number, as before", () => {
    setGameVariant("standard+forced");
    expect(classifyThrow(parseSector("T20", false), "20", board()).ambiguous).toEqual({ ringStep: "T", number: "20", multiplier: 3 });
  });
});
