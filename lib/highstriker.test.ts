import { describe, expect, it } from "vitest";
import { leastToKeep, livesLeft, newGame, playRound, playerUp, targetOf, undoRound, winnerOf } from "./highstriker";

describe("highstriker", () => {
  it("has nothing to beat in the first round, and then what the round before made", () => {
    let g = newGame(3, ["Lars", "Vadla", "Moen"]);
    expect(targetOf(g)).toBeNull();
    expect(leastToKeep(g)).toBeNull();
    g = playRound(g, 60);
    expect(targetOf(g)).toBe(60);
    expect(leastToKeep(g)).toBe(61);
    expect(playerUp(g)).toBe("Vadla");
  });

  it("takes a life for a round that is not more than the one before, a tie included", () => {
    let g = newGame(3, ["Lars", "Vadla"]);
    g = playRound(g, 60);
    g = playRound(g, 60);
    expect(livesLeft(g, "Vadla")).toBe(2);
    g = playRound(g, 61);
    expect(livesLeft(g, "Lars")).toBe(3);
    g = playRound(g, 100);
    expect(livesLeft(g, "Vadla")).toBe(2);
  });

  it("passes over someone who is out, and ends with the last one standing", () => {
    let g = newGame(1, ["Lars", "Vadla", "Moen"]);
    g = playRound(g, 50);
    g = playRound(g, 10); // Vadla is out
    expect(playerUp(g)).toBe("Moen");
    g = playRound(g, 40); // Moen beats the 10 and keeps his life
    expect(livesLeft(g, "Moen")).toBe(1);
    expect(playerUp(g)).toBe("Lars");
    g = playRound(g, 20); // Lars is out
    expect(winnerOf(g)).toBe("Moen");
  });

  it("takes the last round back, a lost life with it", () => {
    let g = newGame(3, ["Lars", "Vadla"]);
    g = playRound(g, 60);
    g = playRound(g, 10);
    expect(livesLeft(g, "Vadla")).toBe(2);
    g = undoRound(g);
    expect(livesLeft(g, "Vadla")).toBe(3);
    expect(playerUp(g)).toBe("Vadla");
  });
});
