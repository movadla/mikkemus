import { describe, expect, it } from "vitest";
import { averageOf, canGrow, judge, newGame, playRound, pressDigit, remainingOf, undoRound, winnerOf } from "./countdown";

describe("301 and 501", () => {
  it("takes each round off what the player has left, one player after the other", () => {
    let g = newGame(501, false, ["Lars", "Vadla"]);
    g = playRound(g, 60);
    g = playRound(g, 100);
    g = playRound(g, 45);
    expect(remainingOf(g, "Lars")).toBe(396);
    expect(remainingOf(g, "Vadla")).toBe(401);
  });

  it("counts a round over the line for nothing, and on 1 too when the finish has to be a double", () => {
    expect(judge(40, 41, false)).toBe("bust");
    expect(judge(40, 39, false)).toBe("counts");
    expect(judge(40, 39, true)).toBe("bust");
    expect(judge(40, 40, true)).toBe("finish");
    const g = playRound(newGame(301, false, ["Lars"]), 180);
    const busted = playRound(playRound(g, 100), 50);
    expect(remainingOf(busted, "Lars")).toBe(21);
    expect(busted.turns[2].bust).toBe(true);
  });

  it("ends when a round takes the player to nothing, with the darts the finish took", () => {
    let g = newGame(301, true, ["Lars", "Vadla"]);
    g = playRound(g, 180);
    g = playRound(g, 60);
    g = playRound(g, 121, 2);
    expect(winnerOf(g)).toBe("Lars");
    expect(remainingOf(g, "Lars")).toBe(0);
    // Lars threw five darts: three, then two for the finish. 301 in five darts is 301 / 5 * 3.
    expect(averageOf(g, "Lars")).toBeCloseTo((301 / 5) * 3, 5);
  });

  it("takes the last round back, and the average follows", () => {
    let g = newGame(501, false, ["Lars"]);
    g = playRound(g, 60);
    g = playRound(g, 30);
    expect(averageOf(g, "Lars")).toBeCloseTo(45, 5);
    g = undoRound(g);
    expect(averageOf(g, "Lars")).toBeCloseTo(60, 5);
    expect(averageOf(newGame(501, false, ["Lars"]), "Lars")).toBeNull();
  });

  it("knows when a number written in cannot grow into a longer one: 19 and up, and 0, are done", () => {
    expect(canGrow("")).toBe(false);
    for (const t of ["1", "2", "9", "10", "17", "18"]) expect(canGrow(t), t).toBe(true);
    for (const t of ["19", "20", "99", "100", "180", "0"]) expect(canGrow(t), t).toBe(false);
  });

  it("does not take a number over 180", () => {
    expect(pressDigit("18", 5)).toBe("18");
    expect(pressDigit("18", 0)).toBe("180");
    expect(pressDigit("", 7)).toBe("7");
    expect(pressDigit("0", 5)).toBe("0");
  });
});
