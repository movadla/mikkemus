import { describe, expect, it } from "vitest";
import { tierOf, towerScale, towerShare } from "./roundTier";

describe("round tiers", () => {
  it("has a tier from 100, 140 and 180", () => {
    expect(tierOf(99)).toBe("none");
    expect(tierOf(100)).toBe("ton");
    expect(tierOf(139)).toBe("ton");
    expect(tierOf(140)).toBe("big");
    expect(tierOf(179)).toBe("big");
    expect(tierOf(180)).toBe("max");
  });
});

describe("the tower", () => {
  it("has a scale that leaves room above the mark and stays between 60 and 180", () => {
    expect(towerScale(null)).toBe(120);
    expect(towerScale(10)).toBe(60);
    expect(towerScale(51)).toBe(80);
    expect(towerScale(150)).toBe(180);
    expect(towerScale(180)).toBe(180);
  });

  it("keeps a value on the tower", () => {
    expect(towerShare(40, 80)).toBe(0.5);
    expect(towerShare(200, 80)).toBe(1);
    expect(towerShare(-5, 80)).toBe(0);
  });
});
