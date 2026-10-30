import { describe, expect, it } from "vitest";
import { countdownBonuses, mikkeBull3, NO_BONUS } from "./bonus";
import { newGame, playRound } from "./countdown";
import type { TurnResult } from "./game";

const ALL = { s180: true, bull3: true, co100: true };

describe("ekstrapoeng", () => {
  it("gives a point for a 180, to the person who threw it (the member, in a team)", () => {
    const g = playRound(playRound(newGame(501, true, ["A", "B"]), 180), 60);
    expect(countdownBonuses(g, ALL)).toEqual([{ who: "A", feat: "180" }]);
    expect(countdownBonuses(g, { ...ALL, s180: false })).toEqual([]);
    expect(countdownBonuses(g, NO_BONUS)).toEqual([]);
    expect(countdownBonuses(g, undefined)).toEqual([]);
  });
  it("gives a point for three bulls only when the round was said to be three bulls, and not when it went over the line", () => {
    const g = playRound(newGame(501, true, ["A", "B"]), 150, undefined, true);
    expect(countdownBonuses(g, ALL)).toEqual([{ who: "A", feat: "bull3" }]);
    expect(countdownBonuses(playRound(newGame(501, true, ["A", "B"]), 150), ALL)).toEqual([]);
    // 150 over the line from 100: nothing, even if it was said to be three bulls.
    const over = playRound(newGame(501, true, ["A", "B"], { A: 100 }), 150, undefined, true);
    expect(countdownBonuses(over, ALL)).toEqual([]);
  });
  it("gives a point to the winner for a checkout of 100 or more", () => {
    const g = playRound(playRound(newGame(301, true, ["A", "B"]), 180), 60);
    // A has 121 left after the 180 and finishes with 121.
    const won = playRound(g, 121, 2);
    expect(countdownBonuses(won, { ...NO_BONUS, co100: true })).toEqual([{ who: "A", feat: "co100" }]);
    // A finish on 40 is not one of 100 or more.
    const small = playRound(newGame(301, true, ["A", "B"], { A: 40 }), 40, 1);
    expect(countdownBonuses(small, { ...NO_BONUS, co100: true })).toEqual([]);
  });
  it("finds three crosses on the bull in one turn of the main game", () => {
    const turn = (bull: number, thrower?: string): TurnResult => ({ hitsByStep: { BULL: bull }, missStep: null, misses: 0, ...(thrower ? { thrower } : {}) }) as TurnResult;
    expect(mikkeBull3({ A: [turn(2), turn(3)], B: [turn(1)] }, { s180: false, co100: false, bull3: true })).toEqual([{ who: "A", feat: "bull3" }]);
    expect(mikkeBull3({ T: [turn(3, "Lars")] }, { s180: false, co100: false, bull3: true })).toEqual([{ who: "Lars", feat: "bull3" }]);
    expect(mikkeBull3({ A: [turn(3)] }, NO_BONUS)).toEqual([]);
  });
});
