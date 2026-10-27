import { describe, expect, it } from "vitest";
import { newGame as countdown, playRound as countdownRound } from "./countdown";
import { countdownResult, highstrikerResult, lavaResult, tableOf, tablesOf, type GameResult } from "./gameResults";
import { newGame as highstriker, playRound as highstrikerRound } from "./highstriker";
import { newGame as lava, playDart } from "./lava";

const AT = "2026-10-27T20:00:00.000Z";

describe("countdownResult", () => {
  it("is nothing before somebody has won", () => {
    expect(countdownResult(countdown(301, false, ["Ola", "Kari"]), [], "a", AT)).toBeNull();
  });

  it("writes what each player made, and what the winner went out on", () => {
    let g = countdown(301, false, ["Ola", "Kari"]);
    g = countdownRound(g, 180); // Ola
    g = countdownRound(g, 100); // Kari
    g = countdownRound(g, 121, 2); // Ola, out on 121 with two darts
    const r = countdownResult(g, ["Kari"], "a", AT)!;
    expect(r.game).toBe("301");
    expect(r.winner).toBe("Ola");
    expect(r.bots).toEqual(["Kari"]);
    expect(r.figures.Ola).toMatchObject({ darts: 5, points: 301, rounds: 2, best: 180, tons: 2, finish: 121 });
    expect(r.figures.Kari).toMatchObject({ darts: 3, points: 100, rounds: 1, best: 100, tons: 1 });
    expect(r.figures.Kari.finish).toBeUndefined();
  });

  it("is nothing for one player alone", () => {
    const g = countdownRound(countdown(301, false, ["Ola"]), 301, 3);
    expect(countdownResult(g, [], "a", AT)).toBeNull();
  });
});

describe("highstrikerResult", () => {
  it("counts rounds, the sum, the best round and the lives lost", () => {
    let g = highstriker(1, ["Ola", "Kari"]);
    g = highstrikerRound(g, 60); // Ola
    g = highstrikerRound(g, 40); // Kari: not more than 60, the life is gone
    const r = highstrikerResult(g, [], "a", AT)!;
    expect(r.winner).toBe("Ola");
    expect(r.figures.Ola).toMatchObject({ rounds: 1, points: 60, best: 60, lostLives: 0 });
    expect(r.figures.Kari).toMatchObject({ rounds: 1, points: 40, best: 40, lostLives: 1 });
  });
});

describe("lavaResult", () => {
  it("counts the darts, the sections burned and the lives lost", () => {
    let g = lava(1, ["Ola", "Kari"]);
    g = playDart(g, 20); // Ola burns 20
    g = playDart(g, 0);
    g = playDart(g, 0);
    g = playDart(g, 20); // Kari hits the lava and is out
    const r = lavaResult(g, [], "a", AT)!;
    expect(r.winner).toBe("Ola");
    expect(r.figures.Ola).toMatchObject({ darts: 3, burned: 1, lostLives: 0 });
    expect(r.figures.Kari).toMatchObject({ darts: 1, burned: 0, lostLives: 1 });
  });
});

const result = (id: string, game: GameResult["game"], winner: string, players: string[], bots: string[], at: string, extra: Partial<GameResult["figures"][string]> = {}): GameResult => ({
  id,
  game,
  playedAt: at,
  winner,
  players,
  bots,
  figures: Object.fromEntries(players.map((p) => [p, { darts: 30, points: 301, rounds: 10, best: 100, tons: 1, burned: 0, lostLives: 0, ...(p === winner ? extra : {}) }])),
});

describe("tableOf", () => {
  it("is nothing for a game that has not been played", () => {
    expect(tableOf([result("1", "301", "Ola", ["Ola", "Kari"], [], AT)], "lava")).toBeNull();
    expect(tablesOf([])).toEqual([]);
  });

  it("ranks by wins, leaves bots out and works out the percent and the average", () => {
    const rs = [
      result("1", "301", "Ola", ["Ola", "Kari"], [], "2026-10-01T10:00:00Z", { finish: 40, darts: 24 }),
      result("2", "301", "Kari", ["Ola", "Kari"], [], "2026-10-02T10:00:00Z", { finish: 80, darts: 27 }),
      result("3", "301", "Ola", ["Ola", "Littler"], ["Littler"], "2026-10-03T10:00:00Z", { finish: 100, darts: 21 }),
    ];
    const t = tableOf(rs, "301")!;
    expect(t.played).toBe(3);
    expect(t.last).toBe("2026-10-03T10:00:00Z");
    expect(t.rows.map((r) => r.name)).toEqual(["Ola", "Kari"]);
    expect(t.rows[0]).toMatchObject({ games: 3, wins: 2, winPct: 67, bestFinish: 100, fewestDarts: 21, tons: 3 });
    expect(t.rows[1]).toMatchObject({ games: 2, wins: 1, winPct: 50, bestFinish: 80 });
    // 301 points over 30 darts, ×3: 30,1 a round.
    expect(t.rows[1].average).toBeCloseTo(((301 + 301) / (30 + 27)) * 3, 5);
    expect(t.recent.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });

  it("keeps the games apart", () => {
    const rs = [result("1", "301", "Ola", ["Ola", "Kari"], [], AT), result("2", "501", "Kari", ["Ola", "Kari"], [], AT), result("3", "lava", "Ola", ["Ola", "Kari"], [], AT)];
    expect(tablesOf(rs).map((t) => t.game)).toEqual(["301", "501", "lava"]);
  });
});
