import { describe, expect, it } from "vitest";
import { memberUp, newGame, playRound, playerUp, remainingOf, undoRound, winnerOf, type CountdownMember } from "./countdown";
import { undoThroughBots } from "./botTurns";
import { simulateMatch } from "./botSim";
import { createKnockout, nextPlayable } from "./knockout";
import type { Participant } from "./tournament";

const human: CountdownMember = { name: "Lars", isBot: false };
const bot = (name: string, level = 4): CountdownMember => ({ name, isBot: true, botLevel: level });

describe("a team in 501", () => {
  const game = () => newGame(501, true, ["Norge", "Nederland"], undefined, { Norge: [human, bot("Marcus")], Nederland: [bot("Littler", 1), bot("Cor Dekker", 2)] });

  it("has one score for the team, and its members throw a round each in turn", () => {
    let g = game();
    expect(playerUp(g)).toBe("Norge");
    expect(memberUp(g)?.name).toBe("Lars");
    g = playRound(g, 60);
    expect(playerUp(g)).toBe("Nederland");
    expect(memberUp(g)?.name).toBe("Littler");
    g = playRound(g, 100);
    expect(memberUp(g)?.name).toBe("Marcus");
    g = playRound(g, 41);
    expect(memberUp(g)?.name).toBe("Cor Dekker");
    expect(g.turns.map((t) => t.by)).toEqual(["Lars", "Littler", "Marcus"]);
    expect(remainingOf(g, "Norge")).toBe(501 - 60 - 41);
    expect(remainingOf(g, "Nederland")).toBe(401);
  });

  it("is won by the team that gets to nothing, whichever member did it", () => {
    let g = newGame(101 as never, false, ["A", "B"], undefined, { A: [human, bot("X")], B: [bot("Y"), bot("Z")] });
    g = playRound(g, 50); // A (Lars)
    g = playRound(g, 20); // B (Y)
    g = playRound(g, 51); // A (X) finishes
    expect(winnerOf(g)).toBe("A");
    expect(g.turns[g.turns.length - 1].by).toBe("X");
  });

  it("takes back the rounds of the bot members and then the last one of a person", () => {
    let g = game();
    g = playRound(g, 60); // Lars
    g = playRound(g, 80); // Littler
    g = playRound(g, 45); // Marcus (a bot)
    const isBot = (n: string) => ["Marcus", "Littler", "Cor Dekker"].includes(n);
    expect(undoThroughBots(g, isBot).turns.map((t) => t.by)).toEqual([]);
    expect(undoRound(g).turns).toHaveLength(2);
  });

  it("is a game without teams when there are none", () => {
    const g = newGame(301, true, ["A", "B"]);
    expect(memberUp(g)).toBeNull();
    expect(playRound(g, 20).turns[0].by).toBeUndefined();
  });
});

describe("a match between two teams of bots", () => {
  const team = (name: string, a: string, b: string, skill: number): Participant => ({ name, isBot: false, members: [a, b].map((m) => ({ name: m, isBot: true, botLevel: String(skill) as never, skill })) });
  const t = () => createKnockout("team", [team("Norge", "A1", "A2", 3), team("Nederland", "B1", "B2", 3), team("Tyskland", "C1", "C2", 5), team("Italia", "D1", "D2", 5)], "wc", "2026-01-01", "standard", { kind: "gs", name: "WC", trophy: "WC", level: "4", growth: true, seed: 3, career: true, countdown: { start: 501, doubleOut: true } });

  it("is decided with the darts each team used, and the sharper team wins more often", () => {
    const tour = t();
    const m = nextPlayable(tour)!;
    const r = simulateMatch(tour, m)!;
    expect(r.placements).toHaveLength(2);
    expect(r.stats[r.placements[0]].darts).toBeGreaterThan(8);
    let sharp = 0;
    for (let i = 0; i < 80; i++) {
      const cup = { ...tour, cup: { ...tour.cup!, seed: i } };
      const res = simulateMatch(cup, { ...m, participantA: "Norge", participantB: "Tyskland" })!;
      if (res.placements[0] === "Norge") sharp++;
    }
    expect(sharp).toBeGreaterThan(50);
  });
});
