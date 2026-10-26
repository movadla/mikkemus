import { describe, expect, it } from "vitest";
import { applyRound, bullOffDone, bullOffScore, currentGroup, simulateBullDarts, startBullOff, tieGroups, withGroupOrder } from "./bullOff";

describe("who is level for a place", () => {
  it("finds nobody when every place is its own", () => {
    expect(tieGroups(["A", "B", "C", "D"], { A: 0, B: 3, C: 6, D: 9 })).toEqual([]);
  });

  it("finds two level for second", () => {
    expect(tieGroups(["A", "B", "C", "D"], { A: 0, B: 5, C: 5, D: 9 })).toEqual([["B", "C"]]);
  });

  it("finds three level, and two groups at once", () => {
    expect(tieGroups(["A", "B", "C", "D"], { A: 0, B: 7, C: 7, D: 7 })).toEqual([["B", "C", "D"]]);
    expect(tieGroups(["A", "B", "C", "D", "E"], { A: 0, B: 4, C: 4, D: 8, E: 8 })).toEqual([["B", "C"], ["D", "E"]]);
  });

  it("never counts the winner in a group", () => {
    expect(tieGroups(["A", "B"], { A: 0, B: 0 })).toEqual([]);
  });

  it("puts a group in the order the bull-off gave it, and leaves the rest", () => {
    expect(withGroupOrder(["A", "B", "C", "D"], ["B", "C"], ["C", "B"])).toEqual(["A", "C", "B", "D"]);
    expect(withGroupOrder(["A", "B", "C", "D"], ["C", "D"], ["D", "C"])).toEqual(["A", "B", "D", "C"]);
  });
});

describe("the bull-off", () => {
  it("scores the outer bull 1 and the bullseye 2", () => {
    expect(bullOffScore([0, 1, 2])).toBe(3);
    expect(bullOffScore([2, 2, 2])).toBe(6);
    expect(bullOffScore([0, 0, 0])).toBe(0);
  });

  it("settles two in one round when one has more", () => {
    const done = applyRound(startBullOff(["B", "C"]), { B: 1, C: 3 });
    expect(bullOffDone(done)).toBe(true);
    expect(done.resolved).toEqual(["C", "B"]);
  });

  it("throws again for the ones who are still level, and only them", () => {
    let s = startBullOff(["B", "C", "D"]);
    s = applyRound(s, { B: 2, C: 2, D: 1 });
    // D is last, B and C are level for the places above.
    expect(s.resolved).toEqual([]);
    expect(currentGroup(s)).toEqual(["B", "C"]);
    s = applyRound(s, { B: 0, C: 0 });
    expect(currentGroup(s)).toEqual(["B", "C"]);
    s = applyRound(s, { B: 1, C: 0 });
    expect(bullOffDone(s)).toBe(true);
    expect(s.resolved).toEqual(["B", "C", "D"]);
  });

  it("settles a leader at once and goes on with the rest", () => {
    let s = startBullOff(["B", "C", "D"]);
    s = applyRound(s, { B: 4, C: 1, D: 1 });
    expect(s.resolved).toEqual(["B"]);
    expect(currentGroup(s)).toEqual(["C", "D"]);
  });
});

describe("a bot's three darts", () => {
  it("is mostly nothing for a wide scatter and mostly a bull for a tight one", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const score = (sigma: number) => Array.from({ length: 400 }, () => bullOffScore(simulateBullDarts(sigma, rand))).reduce((a, b) => a + b, 0);
    expect(score(60)).toBeLessThan(score(8));
    for (const d of simulateBullDarts(30, rand)) expect([0, 1, 2]).toContain(d);
  });
});
