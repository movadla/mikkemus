import { describe, expect, it } from "vitest";
import { chaseFraction, recordChase } from "./recordChase";
import { emptyProgress } from "./game";

describe("recordChase", () => {
  it("a fresh board has the whole bar: the record minus one, less the fewest darts a clean board takes (15)", () => {
    const c = recordChase(40, 0, emptyProgress(), 3)!;
    expect(c.slackAtStart).toBe(40 - 1 - 15);
    expect(c.slack).toBe(c.slackAtStart);
    expect(chaseFraction(c)).toBe(1);
  });

  it("a wasted dart takes one off; a dart that counts takes nothing off", () => {
    const board = emptyProgress();
    // One dart thrown, nothing counted: one wasted.
    expect(recordChase(40, 1, board, 3)!.slack).toBe(23);
    // One dart thrown, a triple on 20 closes it: still the same room.
    board["20"] = 3;
    expect(recordChase(40, 1, board, 3)!.slack).toBe(24);
  });

  it("is out of reach once the room is below zero, and the bar is empty", () => {
    const c = recordChase(40, 40, emptyProgress(), 3)!;
    expect(c.slack).toBeLessThan(0);
    expect(chaseFraction(c)).toBe(0);
  });

  it("has nothing to chase without a record, or with one no one could beat", () => {
    expect(recordChase(null, 0, emptyProgress(), 3)).toBeNull();
    expect(recordChase(0, 0, emptyProgress(), 3)).toBeNull();
    expect(recordChase(15, 0, emptyProgress(), 3)).toBeNull();
  });
});
