import { describe, expect, it } from "vitest";
import { BULL, MISS, burnedBy, isOut, livesLeft, newGame, playDart, safeLeft, stateOf, undoDart, type LavaGame } from "./lava";

const throwAll = (g: LavaGame, ...sections: number[]) => sections.reduce(playDart, g);

describe("lava", () => {
  it("starts with everything safe and the first player up", () => {
    const s = stateOf(newGame(3, ["A", "B"]));
    expect(s.up).toBe("A");
    expect(s.thrown).toBe(0);
    expect(safeLeft(s)).toBe(21);
    expect(s.lives).toEqual({ A: 3, B: 3 });
  });

  it("sets a section on fire for whoever hits it, and the round is three darts", () => {
    let g = throwAll(newGame(3, ["A", "B"]), 20, 5);
    let s = stateOf(g);
    expect(s.up).toBe("A");
    expect(s.thrown).toBe(2);
    expect([...s.burned.keys()]).toEqual([20, 5]);
    g = playDart(g, MISS);
    s = stateOf(g);
    expect(s.up).toBe("B");
    expect(s.thrown).toBe(0);
    expect(burnedBy(s, "A")).toBe(2);
  });

  it("costs a life to hit lava, whoever lit it, and a miss costs nothing", () => {
    const g = throwAll(newGame(3, ["A", "B"]), 20, MISS, MISS, 20, MISS, MISS);
    const s = stateOf(g);
    expect(livesLeft(s, "B")).toBe(2);
    expect(livesLeft(s, "A")).toBe(3);
    expect(s.log[3].outcome).toBe("lava");
  });

  it("makes a second dart in the same section in the same round lava", () => {
    const s = stateOf(throwAll(newGame(3, ["A", "B"]), 7, 7));
    expect(livesLeft(s, "A")).toBe(2);
  });

  it("counts the bull as one section", () => {
    const s = stateOf(throwAll(newGame(3, ["A", "B"]), BULL, MISS, MISS, BULL));
    expect(livesLeft(s, "B")).toBe(2);
  });

  it("ends the round when the last life goes, and skips the one who is out", () => {
    // B has one life. A burns 1, 2, 3. B hits 1: out. The round ends at once, and A is up (C is next after B, but there are only A and B).
    let g = throwAll(newGame(1, ["A", "B", "C"]), 1, 2, 3, 1);
    let s = stateOf(g);
    expect(isOut(s, "B")).toBe(true);
    expect(s.log[3].knockedOut).toBe(true);
    expect(s.up).toBe("C");
    expect(s.thrown).toBe(0);
    // C throws three misses, then A is up (B is skipped).
    g = throwAll(g, MISS, MISS, MISS);
    s = stateOf(g);
    expect(s.up).toBe("A");
  });

  it("has a winner when one is left, and takes no more darts", () => {
    const g = throwAll(newGame(1, ["A", "B"]), 20, MISS, MISS, 20);
    const s = stateOf(g);
    expect(s.winner).toBe("A");
    expect(playDart(g, 3)).toBe(g);
  });

  it("takes the last dart back, also across a round and out of a win", () => {
    let g = throwAll(newGame(1, ["A", "B"]), 20, MISS, MISS, 20);
    g = undoDart(g);
    let s = stateOf(g);
    expect(s.winner).toBeNull();
    expect(s.up).toBe("B");
    expect(s.thrown).toBe(0);
    g = undoDart(g);
    s = stateOf(g);
    expect(s.up).toBe("A");
    expect(s.thrown).toBe(2);
    expect(undoDart(newGame(3, ["A", "B"])).darts).toEqual([]);
  });

  it("does not make a single player the winner at once", () => {
    expect(stateOf(throwAll(newGame(1, ["A"]), 20, 20)).winner).toBeNull();
  });
});
