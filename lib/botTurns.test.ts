import { describe, expect, it } from "vitest";
import { undoThroughBots } from "./botTurns";

const game = (...players: string[]) => ({ turns: players.map((player) => ({ player })) });
const isBot = (p: string) => p.startsWith("B");

describe("undoThroughBots", () => {
  it("takes back only the last round when a human threw it", () => {
    expect(undoThroughBots(game("H", "B", "H"), isBot).turns.map((t) => t.player)).toEqual(["H", "B"]);
  });
  it("takes the bots' rounds back with the human's before them", () => {
    expect(undoThroughBots(game("H", "B", "B2"), isBot).turns).toEqual([]);
    expect(undoThroughBots(game("H", "B", "H", "B"), isBot).turns.map((t) => t.player)).toEqual(["H", "B"]);
  });
  it("leaves nothing to take back when there is nothing", () => {
    expect(undoThroughBots(game(), isBot).turns).toEqual([]);
    expect(undoThroughBots(game("B"), isBot).turns).toEqual([]);
  });
});
