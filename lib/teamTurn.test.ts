import { describe, expect, it } from "vitest";
import type { TurnAction } from "./turnResolution";
import { trailingRun } from "./teamTurn";

const dart = (scored: boolean, i = 0): TurnAction => ({ kind: "dart", dartIndex: i, sector: "T20", bounceout: false, scored, coordinates: [0, 0] });

describe("trailingRun", () => {
  it("is what the turn ends on: a miss then two hits ends on two", () => {
    expect(trailingRun([dart(false, 0), dart(true, 1), dart(true, 2)])).toBe(2);
  });

  it("is none after a miss at the end: two hits then a miss", () => {
    expect(trailingRun([dart(true, 0), dart(true, 1), dart(false, 2)])).toBe(0);
  });

  it("is three for three hits, and nothing for no darts", () => {
    expect(trailingRun([dart(true, 0), dart(true, 1), dart(true, 2)])).toBe(3);
    expect(trailingRun([])).toBe(0);
  });

  it("follows taps and take-backs", () => {
    expect(trailingRun([{ kind: "tap", step: "20" }, { kind: "tap", step: "20" }, { kind: "untap", step: "20" }])).toBe(1);
    expect(trailingRun([{ kind: "untap", step: "20" }])).toBe(0);
  });
});
