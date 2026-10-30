import { describe, expect, it } from "vitest";
import { BULL, MISS, SECTIONS, burnedBy, fieldOfLabel, isOut, livesLeft, newGame, playDart, safeLeft, sectionLabel, stateOf, undoDart, type LavaGame } from "./lava";

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

describe("lava: a section opens again when all are on fire", () => {
  const burnAll = (g: LavaGame) => throwAll(g, ...SECTIONS);
  const seeded = (fields?: "all") => ({ ...newGame(9, ["A", "B"], fields), seed: 42 });

  it("opens one section at random as safe once all of them are on fire, and never the one just hit", () => {
    const s = stateOf(burnAll(seeded()));
    expect(safeLeft(s)).toBe(1);
    const last = s.log.at(-1)!;
    expect(last.opened).toBeDefined();
    expect(last.opened).not.toBe(last.section);
    expect(s.burned.has(last.opened!)).toBe(false);
  });

  it("burns the opened section when it is hit, and opens another", () => {
    const g = burnAll(seeded());
    const open = stateOf(g).log.at(-1)!.opened!;
    const s = stateOf(playDart(g, open));
    const dart = s.log.at(-1)!;
    expect(dart.outcome).toBe("burn");
    expect(dart.opened).toBeDefined();
    expect(dart.opened).not.toBe(open);
    expect(safeLeft(s)).toBe(1);
  });

  it("is the same every time for the same game, and taking a dart back puts it back", () => {
    const g = burnAll(seeded());
    expect(stateOf(g).log.at(-1)!.opened).toBe(stateOf({ ...g, darts: [...g.darts] }).log.at(-1)!.opened);
    const back = stateOf(undoDart(g));
    expect(safeLeft(back)).toBe(1);
    expect(back.log.at(-1)!.opened).toBeUndefined();
  });

  it("has the double and the treble of every number as sections of their own when they are on", () => {
    const g = seeded("all");
    expect(safeLeft(stateOf(g), "all")).toBe(61);
    // The number itself, its double and its treble are three sections: a dart in each is a new fire, not lava.
    const s = stateOf(throwAll(g, 20, 120, 220));
    expect(s.log.map((d) => d.outcome)).toEqual(["burn", "burn", "burn"]);
    expect(safeLeft(s, "all")).toBe(58);
    expect(stateOf(throwAll(g, 220, MISS, MISS, 220)).lives.B).toBe(8);
  });

  it("names the sections: 20, D20, T20", () => {
    expect([sectionLabel(20), sectionLabel(120), sectionLabel(220), sectionLabel(BULL)]).toEqual(["20", "D20", "T20", "Bull"]);
    expect([fieldOfLabel("T20", 20, "all"), fieldOfLabel("D16", 16, "all"), fieldOfLabel("20", 20, "all"), fieldOfLabel("T20", 20, "numbers"), fieldOfLabel("BULL", BULL, "all")]).toEqual([220, 116, 20, 20, BULL]);
  });
});
