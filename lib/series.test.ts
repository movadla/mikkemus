import { describe, expect, it } from "vitest";
import { standing, standingText, winsNeeded } from "./series";

describe("best av x", () => {
  it("takes two wins in a best of 3 and three in a best of 5", () => {
    expect(winsNeeded(1)).toBe(1);
    expect(winsNeeded(3)).toBe(2);
    expect(winsNeeded(5)).toBe(3);
    expect(winsNeeded(7)).toBe(4);
  });
  it("counts the games played and the one that is on", () => {
    const s = standing({ bestOf: 3, history: ["A"] }, ["A", "B"], null);
    expect(s.wins).toEqual({ A: 1, B: 0 });
    expect(s.decided).toBeNull();
    const t = standing({ bestOf: 3, history: ["A"] }, ["A", "B"], "B");
    expect(t.wins).toEqual({ A: 1, B: 1 });
    expect(t.decided).toBeNull();
  });
  it("is decided when a side has got there first, the game that is on included", () => {
    expect(standing({ bestOf: 3, history: ["A", "B"] }, ["A", "B"], "A").decided).toBe("A");
    expect(standing({ bestOf: 3, history: ["A"] }, ["A", "B"], "A").decided).toBe("A");
    expect(standing({ bestOf: 5, history: ["A", "A", "B"] }, ["A", "B"], "B").decided).toBeNull();
  });
  it("works for more than two sides", () => {
    const s = standing({ bestOf: 3, history: ["C", "A"] }, ["A", "B", "C"], "C");
    expect(s.decided).toBe("C");
    expect(s.wins).toEqual({ A: 1, B: 0, C: 2 });
  });
  it("writes the standing", () => {
    const sides = ["Lars", "Vadla"];
    expect(standingText(standing({ bestOf: 3, history: ["Lars"] }, sides, null), sides)).toBe("Lars 1–0 Vadla");
    const three = ["A", "B", "C"];
    expect(standingText(standing({ bestOf: 3, history: ["C"] }, three, null), three)).toBe("A 0 · B 0 · C 1");
  });
});
