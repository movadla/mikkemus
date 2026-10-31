import { describe, expect, it } from "vitest";
import { faceOffOf, isSkipKey, rankPlate, shouldWalkOn } from "./WalkOnLogic";

describe("shouldWalkOn", () => {
  it("is only on for the show code before a big match", () => {
    expect(shouldWalkOn({ show: true, big: true })).toBe(true);
    expect(shouldWalkOn({ show: false, big: true })).toBe(false);
    expect(shouldWalkOn({ show: true, big: false })).toBe(false);
  });
  it("is left out for a cup of teams", () => {
    expect(shouldWalkOn({ show: true, big: true, team: true })).toBe(false);
  });
});

describe("faceOffOf", () => {
  it("says nothing when they have not met", () => {
    expect(faceOffOf(undefined)).toBeNull();
    expect(faceOffOf({ w: 0, l: 0, last: "2026-01-01T10:00:00Z", lastWon: false })).toBeNull();
  });
  it("gives the score and who won last", () => {
    expect(faceOffOf({ w: 2, l: 1, last: "2026-10-30T12:00:00Z", lastWon: true })).toEqual({ score: "Innbyrdes 2–1", last: "Sist: seier 2026-10-30" });
    expect(faceOffOf({ w: 0, l: 1, last: "2026-10-30T12:00:00Z", lastWon: false })?.last).toBe("Sist: tap 2026-10-30");
  });
});

describe("rankPlate and keys", () => {
  it("shows a rank only when there is one", () => {
    expect(rankPlate(42)).toBe("Verden #42");
    expect(rankPlate(null)).toBe("");
    expect(rankPlate(0)).toBe("");
  });
  it("skips on escape, enter and space", () => {
    expect(["Escape", "Enter", " "].every(isSkipKey)).toBe(true);
    expect(isSkipKey("a")).toBe(false);
  });
});
