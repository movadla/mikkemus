import { describe, expect, it } from "vitest";
import { digitIndex, nextIndex } from "./arrowNav";

describe("the arrow keys in a list", () => {
  it("moves one row at a time and stops at the ends", () => {
    expect(nextIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextIndex("ArrowUp", 1, 3)).toBe(0);
    expect(nextIndex("ArrowUp", 0, 3)).toBe(0);
  });

  it("starts at the first row going down and the last going up when nothing has focus", () => {
    expect(nextIndex("ArrowDown", -1, 4)).toBe(0);
    expect(nextIndex("ArrowUp", -1, 4)).toBe(3);
  });

  it("jumps to the ends with Home and End, and leaves other keys alone", () => {
    expect(nextIndex("Home", 2, 5)).toBe(0);
    expect(nextIndex("End", 2, 5)).toBe(4);
    expect(nextIndex("a", 2, 5)).toBeNull();
    expect(nextIndex("ArrowDown", 0, 0)).toBeNull();
  });

  it("reads a digit as a place in a short list", () => {
    expect(digitIndex("1", 4)).toBe(0);
    expect(digitIndex("4", 4)).toBe(3);
    expect(digitIndex("5", 4)).toBeNull();
    expect(digitIndex("0", 4)).toBeNull();
    expect(digitIndex("x", 4)).toBeNull();
  });
});
