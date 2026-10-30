import { describe, expect, it } from "vitest";
import { ROUNDS, ROUNDS_IN_ALL, bestRoundOf, entryForSum, halve, halvingsOf, newGame, playEntry, possibleSum, stateOf, undoEntry, type HalvItGame } from "./halvit";

const pts = (points: number) => ({ points, bom: false });
const BOM = { points: 0, bom: true };
const play = (g: HalvItGame, ...entries: { points: number; bom: boolean }[]) => entries.reduce(playEntry, g);

describe("halv it", () => {
  it("has ten rounds in the order of the rules", () => {
    expect(ROUNDS.map((r) => r.name)).toEqual(["20-feltet", "Dobbel", "Eksakt 57", "60 ut", "Trippel", "46 eller mer", "Bull", "Trippel 20", "Siste pil i bull", "40 ut"]);
    expect(ROUNDS).toHaveLength(ROUNDS_IN_ALL);
  });

  it("halves rounded up: 85 becomes 43 and 1 stays 1", () => {
    expect(halve(85)).toBe(43);
    expect(halve(60)).toBe(30);
    expect(halve(1)).toBe(1);
    expect(halve(0)).toBe(0);
  });

  it("starts everyone on nothing, with the first player up in round 1", () => {
    const s = stateOf(newGame(["A", "B"]));
    expect(s.scores).toEqual({ A: 0, B: 0 });
    expect(s.round).toBe(1);
    expect(s.up).toBe("A");
  });

  it("adds the points of a throw, and halves the whole score on a bom", () => {
    const s = stateOf(play(newGame(["A", "B"]), pts(60), pts(40), BOM, pts(20)));
    // Round 1: A 60, B 40. Round 2: A bom (30), B 20+40 = 60.
    expect(s.scores).toEqual({ A: 30, B: 60 });
    expect(s.round).toBe(3);
    expect(s.up).toBe("A");
    expect(halvingsOf(s, "A")).toBe(1);
    expect(halvingsOf(s, "B")).toBe(0);
    expect(bestRoundOf(s, "A")).toBe(60);
  });

  it("is the first player's throw again after everyone has thrown, and keeps the round", () => {
    const g = play(newGame(["A", "B", "C"]), pts(20), pts(40), pts(60));
    const s = stateOf(g);
    expect(s.round).toBe(2);
    expect(s.up).toBe("A");
  });

  it("knows what a sum can be: a double round cannot make an odd sum, a 20 round only multiples of 20", () => {
    const [r1, r2, , , r5, r6, r7, r8] = ROUNDS;
    expect(possibleSum(r1, 40)).toBe(true);
    expect(possibleSum(r1, 50)).toBe(false);
    expect(possibleSum(r2, 24)).toBe(true);
    expect(possibleSum(r2, 25)).toBe(false);
    expect(possibleSum(r2, 130)).toBe(false);
    expect(possibleSum(r5, 57)).toBe(true);
    expect(possibleSum(r5, 58)).toBe(false);
    expect(possibleSum(r6, 12)).toBe(true);
    expect(possibleSum(r7, 75)).toBe(true);
    expect(possibleSum(r7, 70)).toBe(false);
    expect(possibleSum(r8, 120)).toBe(true);
    expect(possibleSum(r8, 100)).toBe(false);
  });

  it("makes a sum under the least of round 6 a bom", () => {
    const r6 = ROUNDS[5];
    expect(entryForSum(r6, 45)).toEqual({ points: 0, bom: true });
    expect(entryForSum(r6, 46)).toEqual({ points: 46, bom: false });
    expect(entryForSum(r6, 100)).toEqual({ points: 100, bom: false });
    expect(entryForSum(ROUNDS[0], 0)).toEqual({ points: 0, bom: true });
  });

  it("gives a team one score, and its members throw a round each in turn", () => {
    const g = newGame(["T1", "T2"], { T1: [{ name: "Lars", isBot: false }, { name: "Per", isBot: false }], T2: [{ name: "Ola", isBot: false }, { name: "Kari", isBot: false }] });
    let s = stateOf(g);
    expect(s.member?.name).toBe("Lars");
    s = stateOf(play(g, pts(20)));
    expect(s.up).toBe("T2");
    expect(s.member?.name).toBe("Ola");
    s = stateOf(play(g, pts(20), pts(40)));
    expect(s.up).toBe("T1");
    expect(s.member?.name).toBe("Per");
    expect(s.log[0].by).toBe("Lars");
  });

  const tenRounds = (a: number[], b: number[]) => a.flatMap((x, i) => [pts(x), pts(b[i])]).map((e) => (e.points === 0 ? BOM : e));

  it("has a winner after round 10: the most points", () => {
    const s = stateOf(play(newGame(["A", "B"]), ...tenRounds([20, 40, 57, 60, 60, 46, 50, 60, 50, 40], [20, 20, 57, 60, 30, 46, 25, 60, 25, 40])));
    expect(s.winner).toBe("A");
  });

  it("settles a tie with one dart each at the bull: the one who hits wins, and when nobody does everyone throws again", () => {
    const base = newGame(["A", "B"]);
    const tied = play(base, ...tenRounds([20, 20, 20, 20, 20, 20, 20, 20, 20, 20], [20, 20, 20, 20, 20, 20, 20, 20, 20, 20]));
    let s = stateOf(tied);
    expect(s.winner).toBeNull();
    expect(s.tieBreak).toBe(true);
    expect(s.contenders).toEqual(["A", "B"]);
    expect(s.up).toBe("A");
    // Both miss: again.
    s = stateOf(play(tied, BOM, BOM));
    expect(s.winner).toBeNull();
    expect(s.up).toBe("A");
    // A misses and B hits: B wins.
    s = stateOf(play(tied, BOM, BOM, BOM, { points: 0, bom: false }));
    expect(s.winner).toBe("B");
    // The scores are not touched by the tie-break.
    expect(s.scores).toEqual({ A: 200, B: 200 });
  });

  it("takes only the ones who hit into the next round of a tie-break among three", () => {
    const base = newGame(["A", "B", "C"]);
    const tied = play(base, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(() => [pts(20), pts(20), pts(20)]));
    const hit = { points: 0, bom: false };
    let s = stateOf(play(tied, hit, BOM, hit));
    expect(s.winner).toBeNull();
    expect(s.contenders).toEqual(["A", "C"]);
    s = stateOf(play(tied, hit, BOM, hit, hit, BOM));
    expect(s.winner).toBe("A");
  });

  it("takes the last throw back, also out of a win, and takes nothing more once there is a winner", () => {
    const won = play(newGame(["A", "B"]), ...tenRounds([20, 40, 57, 60, 60, 46, 50, 60, 50, 40], [20, 20, 57, 60, 30, 46, 25, 60, 25, 40]));
    expect(stateOf(won).winner).toBe("A");
    expect(playEntry(won, pts(20))).toBe(won);
    const back = undoEntry(won);
    expect(stateOf(back).winner).toBeNull();
    expect(stateOf(back).up).toBe("B");
    expect(undoEntry(newGame(["A", "B"])).entries).toEqual([]);
  });
});

describe("halv it: both members of a team throw in every round", () => {
  const rosters = { T1: [{ name: "Lars", isBot: false }, { name: "Per", isBot: false }], T2: [{ name: "Ola", isBot: false }, { name: "Kari", isBot: false }] };
  const g0 = newGame(["T1", "T2"], rosters, true);

  it("lets the first of them throw, then the second, before the other team", () => {
    let s = stateOf(g0);
    expect(s.member?.name).toBe("Lars");
    expect(s.part).toEqual({ n: 1, of: 2 });
    s = stateOf(play(g0, pts(20)));
    // Nothing has happened to the score yet: the round is the two together.
    expect(s.scores.T1).toBe(0);
    expect(s.up).toBe("T1");
    expect(s.member?.name).toBe("Per");
    expect(s.part).toEqual({ n: 2, of: 2 });
    s = stateOf(play(g0, pts(20), pts(40)));
    expect(s.scores.T1).toBe(60);
    expect(s.up).toBe("T2");
    expect(s.member?.name).toBe("Ola");
  });

  it("adds both throws, and halves only when neither made any", () => {
    // Round 1: T1 gets 60, T2 gets nothing from either. Round 2: T1 one bom and 24 (adds), T2 20 and a bom (adds). Round 3: T1 both bom.
    const g = play(g0, pts(20), pts(40), BOM, BOM, BOM, pts(24), pts(20), BOM, BOM, BOM);
    const s = stateOf(g);
    expect(s.scores).toEqual({ T1: 42 + 0, T2: 20 });
    expect(halvingsOf(s, "T1")).toBe(1);
    expect(halvingsOf(s, "T2")).toBe(1);
    expect(s.round).toBe(3);
    expect(s.up).toBe("T2");
  });

  it("is a round of one throw for a side with no team, and for the tie-break", () => {
    const solo = newGame(["A", "B"], undefined, true);
    expect(stateOf(solo).part).toEqual({ n: 1, of: 1 });
    expect(stateOf(play(solo, pts(20))).scores.A).toBe(20);
  });

  it("takes the first of two throws back, and the best round is the two together", () => {
    const g = play(g0, pts(20), pts(40));
    expect(stateOf(undoEntry(g)).part).toEqual({ n: 2, of: 2 });
    expect(bestRoundOf(stateOf(g), "T1")).toBe(60);
  });
});
