import { describe, expect, it } from "vitest";
import {
  activePlayerFor,
  advanceBullDuelTurn,
  botChooseBullThrow,
  isTurnComplete,
  registerBullDart,
  startBullDuel,
} from "./bullDuel";

// [0, 0.1] lands dead-center of inner bull ("Bull", 2 points); [0, 200] is a
// clean miss well off the board ("None", 0 points) — same coordinate
// convention as lib/dartboard.test.ts.
const BULL_CENTER: [number, number] = [0, 0.1];
const MISS: [number, number] = [0, 200];

describe("startBullDuel", () => {
  it("initializes every player at 0 points with empty stats, first player active", () => {
    const state = startBullDuel(["Anna", "Bjørn"], 10);
    expect(state.points).toEqual({ Anna: 0, Bjørn: 0 });
    expect(state.stats.Anna).toEqual({ throws: 0, hits: 0, luckSum: 0, luckCount: 0 });
    expect(activePlayerFor(state)).toBe("Anna");
    expect(state.winner).toBeNull();
  });
});

describe("registerBullDart", () => {
  it("adds points and stats for the active player, not the others", () => {
    let state = startBullDuel(["Anna", "Bjørn"], 10);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    expect(state.points.Anna).toBe(2);
    expect(state.points.Bjørn).toBe(0);
    expect(state.stats.Anna).toMatchObject({ throws: 1, hits: 1 });
    expect(state.stats.Anna.luckCount).toBe(1);
  });

  it("counts a manually-tapped dart (no coordinates) toward throws/hits but excludes it from the xG average", () => {
    let state = startBullDuel(["Anna"], 10);
    state = registerBullDart(state, "Bull", null);
    expect(state.points.Anna).toBe(2);
    expect(state.stats.Anna).toMatchObject({ throws: 1, hits: 1, luckSum: 0, luckCount: 0 });
  });

  it("counts a miss as a thrown dart but not a hit", () => {
    let state = startBullDuel(["Anna"], 10);
    state = registerBullDart(state, "None", MISS);
    expect(state.points.Anna).toBe(0);
    expect(state.stats.Anna).toMatchObject({ throws: 1, hits: 0 });
  });

  it("declares a winner on an exact hit of the target", () => {
    let state = startBullDuel(["Anna"], 2);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    expect(state.points.Anna).toBe(2);
    expect(state.winner).toBe("Anna");
  });

  it("declares a winner on overshoot — reaching or passing the target both count", () => {
    let state = startBullDuel(["Anna"], 3);
    state = registerBullDart(state, "Bull", BULL_CENTER); // 2 points, not yet at 3
    expect(state.winner).toBeNull();
    state = registerBullDart(state, "Bull", BULL_CENTER); // 4 points, passes 3
    expect(state.points.Anna).toBe(4);
    expect(state.winner).toBe("Anna");
  });

  it("is a no-op once the match already has a winner", () => {
    let state = startBullDuel(["Anna"], 2);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    expect(state.winner).toBe("Anna");
    const afterWin = registerBullDart(state, "Bull", BULL_CENTER);
    expect(afterWin).toBe(state); // same reference — truly a no-op
  });
});

describe("turnShots", () => {
  it("accumulates labeled shots this turn and clears them on advance", () => {
    let state = startBullDuel(["Anna"], 100);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    state = registerBullDart(state, "None", MISS);
    expect(state.turnShots).toEqual([
      { label: "Rødt", points: 2 },
      { label: "Bom", points: 0 },
    ]);
    state = advanceBullDuelTurn(state);
    expect(state.turnShots).toEqual([]);
  });
});

describe("isTurnComplete / advanceBullDuelTurn", () => {
  it("is not complete before 3 darts, complete at 3", () => {
    let state = startBullDuel(["Anna", "Bjørn"], 100);
    expect(isTurnComplete(state)).toBe(false);
    state = registerBullDart(state, "None", MISS);
    state = registerBullDart(state, "None", MISS);
    expect(isTurnComplete(state)).toBe(false);
    state = registerBullDart(state, "None", MISS);
    expect(isTurnComplete(state)).toBe(true);
  });

  it("is complete early if a dart wins the match mid-turn", () => {
    let state = startBullDuel(["Anna"], 2);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    expect(state.dartsThisTurn).toBe(1);
    expect(isTurnComplete(state)).toBe(true);
  });

  it("cycles the active player and resets the turn's dart count", () => {
    let state = startBullDuel(["Anna", "Bjørn", "Cato"], 100);
    state = registerBullDart(state, "None", MISS);
    state = advanceBullDuelTurn(state);
    expect(activePlayerFor(state)).toBe("Bjørn");
    expect(state.dartsThisTurn).toBe(0);
    state = advanceBullDuelTurn(state);
    expect(activePlayerFor(state)).toBe("Cato");
    state = advanceBullDuelTurn(state);
    expect(activePlayerFor(state)).toBe("Anna"); // wraps around
  });

  it("does not advance once there's a winner", () => {
    let state = startBullDuel(["Anna", "Bjørn"], 2);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    const afterAdvance = advanceBullDuelTurn(state);
    expect(activePlayerFor(afterAdvance)).toBe("Anna");
  });
});

describe("botChooseBullThrow", () => {
  it("returns a finite coordinate pair", () => {
    const [x, y] = botChooseBullThrow("3");
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});
