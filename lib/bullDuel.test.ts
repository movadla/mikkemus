import { describe, expect, it } from "vitest";
import {
  activePlayerFor,
  finishStateFor,
  meanDistanceFor,
  soleLeader,
  advanceBullDuelTurn,
  botChooseBullThrow,
  bustBullDuelTurn,
  isTurnComplete,
  registerBullDart,
  startBullDuel,
  DEFAULT_BULL_DUEL_TARGET,
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
    expect(state.stats.Anna).toEqual({ throws: 0, points: 0, redHits: 0, greenHits: 0, luckSum: 0, luckCount: 0, bestRun: 0, run: 0, bestTurn: 0, perfectTurns: 0 });
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
    expect(state.stats.Anna).toMatchObject({ throws: 1, points: 2, redHits: 1, greenHits: 0 });
    expect(state.stats.Anna.luckCount).toBe(1);
  });

  it("counts a manually-tapped dart (no coordinates) toward throws/points but excludes it from the xG average", () => {
    let state = startBullDuel(["Anna"], 10);
    state = registerBullDart(state, "Bull", null);
    expect(state.points.Anna).toBe(2);
    expect(state.stats.Anna).toMatchObject({ throws: 1, points: 2, redHits: 1, greenHits: 0, luckSum: 0, luckCount: 0 });
  });

  it("counts a miss as a thrown dart but not a hit, and tracks red vs green separately", () => {
    let state = startBullDuel(["Anna"], 10);
    state = registerBullDart(state, "None", MISS);
    expect(state.points.Anna).toBe(0);
    expect(state.stats.Anna).toMatchObject({ throws: 1, points: 0, redHits: 0, greenHits: 0 });

    state = registerBullDart(state, "25", [0, 10]);
    expect(state.stats.Anna).toMatchObject({ throws: 2, points: 1, redHits: 0, greenHits: 1 });
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

describe("bustBullDuelTurn", () => {
  it("books a miss for every dart of the turn, so it is complete and ready to confirm", () => {
    const state = bustBullDuelTurn(startBullDuel(["Anna", "Bjørn"], 10));
    expect(state.dartsThisTurn).toBe(3);
    expect(state.turnShots.map((s) => s.label)).toEqual(["Bom", "Bom", "Bom"]);
    expect(state.points.Anna).toBe(0);
    expect(state.stats.Anna).toMatchObject({ throws: 3, points: 0, redHits: 0, greenHits: 0 });
    expect(isTurnComplete(state)).toBe(true);
    expect(activePlayerFor(state)).toBe("Anna"); // Bekreft moves on, not the bust itself
  });

  it("only fills in what is left of the turn", () => {
    let state = startBullDuel(["Anna", "Bjørn"], 10);
    state = registerBullDart(state, "Bull", BULL_CENTER);
    state = bustBullDuelTurn(state);
    expect(state.dartsThisTurn).toBe(3);
    expect(state.stats.Anna).toMatchObject({ throws: 3, points: 2, redHits: 1 });
    expect(state.turnShots.map((s) => s.label)).toEqual(["Rødt", "Bom", "Bom"]);
  });

  it("changes nothing once the turn is over", () => {
    const full = bustBullDuelTurn(startBullDuel(["Anna", "Bjørn"], 10));
    expect(bustBullDuelTurn(full)).toEqual(full);
    const won = registerBullDart(startBullDuel(["Anna"], 2), "Bull", BULL_CENTER);
    expect(bustBullDuelTurn(won)).toEqual(won);
  });
});

describe("botChooseBullThrow", () => {
  it("returns a finite coordinate pair", () => {
    const [x, y] = botChooseBullThrow("3");
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("bull-duell: runs, turns and the finish", () => {
  const dart = (s: ReturnType<typeof startBullDuel>, sector: string, coords: [number, number] | null = null) => registerBullDart(s, sector, coords);

  it("counts a run of scoring darts across turns, and a miss ends it", () => {
    let s = startBullDuel(["A", "B"], 21);
    s = dart(dart(dart(s, "Bull"), "25"), "None");
    expect(s.stats.A.bestRun).toBe(2);
    expect(s.stats.A.run).toBe(0);
    s = advanceBullDuelTurn(s);
    s = advanceBullDuelTurn(s); // back to A
    s = dart(dart(s, "25"), "25");
    expect(s.stats.A.run).toBe(2);
  });

  it("books the points per turn and the best turn, and a turn of three scoring darts is perfect", () => {
    let s = startBullDuel(["A", "B"], 99);
    s = dart(dart(dart(s, "Bull"), "Bull"), "25");
    expect(s.stats.A.bestTurn).toBe(5);
    expect(s.stats.A.perfectTurns).toBe(1);
    expect(s.pointsByTurn.A).toEqual([5]);
    s = advanceBullDuelTurn(s);
    s = dart(dart(dart(s, "None"), "25"), "25");
    expect(s.stats.B.perfectTurns).toBe(0);
    expect(s.pointsByTurn.B).toEqual([2]);
  });

  it("keeps the coordinates of measured darts only", () => {
    let s = startBullDuel(["A"], 21);
    s = dart(s, "Bull", [1, 2]);
    s = dart(s, "25", null);
    expect(s.throws.A).toEqual([[1, 2]]);
    expect(meanDistanceFor(s, "A")).toBeCloseTo(Math.hypot(1, 2), 6);
    expect(meanDistanceFor(startBullDuel(["A"], 21), "A")).toBeNull();
  });

  it("matchdart at two points or less, out when this turn's darts can take it", () => {
    let s = startBullDuel(["A", "B"], 10);
    expect(finishStateFor(s, "A")).toBeNull(); // 10 to go, three darts reach 6
    s = dart(dart(dart(s, "Bull"), "Bull"), "Bull"); // 6 points, 4 to go
    s = advanceBullDuelTurn(s);
    expect(finishStateFor(s, "A")).toBe("out"); // 4 to go, A is not up, a fresh turn of three darts reaches it
    s = advanceBullDuelTurn(s);
    s = dart(s, "None"); // two darts left in the turn: 4 to go is two inner bulls
    expect(finishStateFor(s, "A")).toBe("out");
    s = dart(s, "None");
    expect(finishStateFor(s, "A")).toBeNull(); // one dart left, 4 to go: out of reach this turn
    expect(finishStateFor({ ...s, points: { ...s.points, A: 8 } }, "A")).toBe("matchdart");
  });

  it("names the sole leader", () => {
    let s = startBullDuel(["A", "B"], 21);
    expect(soleLeader(s)).toBeNull();
    s = dart(s, "25");
    expect(soleLeader(s)).toBe("A");
    s = advanceBullDuelTurn(s);
    s = dart(s, "25");
    expect(soleLeader(s)).toBeNull();
  });
});

describe("Best av 3 piler", () => {
  // «Bull» is the bullseye (2), «25» the outer bull (1), «None» a miss.
  const throwDarts = (state: ReturnType<typeof startBullDuel>, darts: string[]) => darts.reduce((s, d) => registerBullDart(s, d, null), state);
  const turn = (state: ReturnType<typeof startBullDuel>, darts: string[]) => advanceBullDuelTurn(throwDarts(state, darts));

  it("starts with everyone in the round, a bar of six, and «Først til» left as it was", () => {
    const s = startBullDuel(["A", "B"], 0, "best3");
    expect(s.mode).toBe("best3");
    expect(s.contenders).toEqual(["A", "B"]);
    expect(s.round).toBe(1);
    expect(s.target).toBe(6);
    const first = startBullDuel(["A", "B"], DEFAULT_BULL_DUEL_TARGET);
    expect(first.mode).toBeUndefined();
    expect(first.target).toBe(10);
  });

  it("has no winner until the last of them has thrown three darts, and then the most points wins", () => {
    let s = startBullDuel(["A", "B"], 0, "best3");
    s = throwDarts(s, ["Bull", "Bull", "Bull"]); // A: 6, the most there is
    expect(s.winner).toBeNull();
    expect(isTurnComplete(s)).toBe(true);
    s = advanceBullDuelTurn(s);
    expect(activePlayerFor(s)).toBe("B");
    s = throwDarts(s, ["25", "25"]);
    expect(s.winner).toBeNull();
    s = registerBullDart(s, "None", null);
    expect(s.winner).toBe("A");
    expect(s.points).toMatchObject({ A: 6, B: 2 });
  });

  it("lets the one who throws last win when ahead, as well", () => {
    let s = startBullDuel(["A", "B"], 0, "best3");
    s = turn(s, ["25", "None", "None"]);
    s = throwDarts(s, ["Bull", "None", "None"]);
    expect(s.winner).toBe("B");
  });

  it("throws the tie off between the ones who are level, from nothing, and only those", () => {
    let s = startBullDuel(["A", "B", "C"], 0, "best3");
    s = turn(s, ["Bull", "None", "None"]); // A 2
    s = turn(s, ["25", "25", "None"]); // B 2
    s = throwDarts(s, ["25", "None", "None"]); // C 1
    expect(s.winner).toBeNull();
    s = advanceBullDuelTurn(s);
    expect(s.round).toBe(2);
    expect(s.contenders).toEqual(["A", "B"]);
    expect(s.points).toEqual({ A: 0, B: 0, C: 0 });
    expect(activePlayerFor(s)).toBe("A");
    s = turn(s, ["None", "None", "None"]);
    expect(activePlayerFor(s)).toBe("B");
    s = throwDarts(s, ["25", "None", "None"]);
    expect(s.winner).toBe("B");
  });

  it("goes on throwing off while it stays level", () => {
    let s = startBullDuel(["A", "B"], 0, "best3");
    s = turn(s, ["25", "None", "None"]);
    s = advanceBullDuelTurn(throwDarts(s, ["25", "None", "None"]));
    expect(s.round).toBe(2);
    s = turn(s, ["None", "None", "None"]);
    s = advanceBullDuelTurn(throwDarts(s, ["None", "None", "None"]));
    expect(s.round).toBe(3);
    expect(s.contenders).toEqual(["A", "B"]);
    expect(s.winner).toBeNull();
  });

  it("keeps the statistics across the rounds, though the points of the round start again", () => {
    let s = startBullDuel(["A", "B"], 0, "best3");
    s = turn(s, ["Bull", "None", "None"]);
    s = advanceBullDuelTurn(throwDarts(s, ["Bull", "None", "None"]));
    s = turn(s, ["Bull", "None", "None"]);
    expect(s.stats.A.points).toBe(4);
    expect(s.stats.A.throws).toBe(6);
    expect(s.points.A).toBe(2);
  });

  it("has no matchdart in it, and «Først til» still ends on the dart that reaches the target", () => {
    const s = startBullDuel(["A", "B"], 0, "best3");
    expect(finishStateFor(s, "A")).toBeNull();
    let f = startBullDuel(["A", "B"], 2);
    f = registerBullDart(f, "Bull", null);
    expect(f.winner).toBe("A");
  });
});
