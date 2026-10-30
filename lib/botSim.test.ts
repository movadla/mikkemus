import { describe, expect, it } from "vitest";
import { buildCupParticipants, makeCup } from "./botCup";
import { playElsewhere, simulateMatch, winChanceOf } from "./botSim";
import { createKnockout, nextPlayable, recordKnockoutResult } from "./knockout";
import type { Tournament } from "./tournament";

function cup(size: number, own = 1, seed = 42): Tournament {
  const config = makeCup("em", "4", true, seed);
  const house = Array.from({ length: own }, (_, i) => ({ name: `Hus${i + 1}`, isBot: false }));
  return createKnockout("individual", buildCupParticipants("individual", house, size, config), "t", "2026-01-01", "standard", config);
}

describe("matches between bots", () => {
  it("gives the same result every time for the same match", () => {
    const t = cup(8);
    const m = t.matches.find((x) => x.participantA && x.participantB && !t.participants.find((p) => p.name === x.participantA)!.isBot === false)!;
    const bots = t.matches.filter((x) => x.participantA && x.participantB && t.participants.find((p) => p.name === x.participantA)?.isBot && t.participants.find((p) => p.name === x.participantB)?.isBot);
    expect(m).toBeTruthy();
    expect(bots.length).toBeGreaterThan(0);
    const a = simulateMatch(t, bots[0])!;
    const b = simulateMatch(t, bots[0])!;
    expect(a).toEqual(b);
    expect(a.placements).toHaveLength(2);
    const [w, l] = a.placements;
    expect(a.stats[w].darts).toBeGreaterThan(0);
    expect(a.stats[w].darts).toBeLessThanOrEqual(a.stats[l].darts + 12);
  });

  it("makes the stronger side the more likely winner", () => {
    const t = cup(8);
    // The same bot against a stronger and a weaker one: the chance goes down with the opposition.
    const strong = t.participants.find((p) => p.botLevel === "1" || Number(p.botLevel) <= 3);
    expect(winChanceOf(new Float64Array([0, 0.9, 1, 1]), new Float64Array([0, 0.1, 0.5, 1]))).toBeGreaterThan(0.6);
    expect(winChanceOf(new Float64Array([0, 0.1, 0.5, 1]), new Float64Array([0, 0.9, 1, 1]))).toBeLessThan(0.4);
    expect(strong === undefined || strong.isBot).toBe(true);
  });

  it("decides the bot matches of the round the house is in, and leaves the house match to be thrown", () => {
    const t = cup(8);
    const { tournament, decided } = playElsewhere(t);
    expect(decided.length).toBeGreaterThan(0);
    const next = nextPlayable(tournament)!;
    expect([next.participantA, next.participantB]).toContain("Hus1");
    expect(tournament.matches.filter((m) => m.simulated).length).toBe(decided.length);
    // Nothing of the house was decided for them.
    expect(tournament.matches.filter((m) => m.simulated).every((m) => m.participantA !== "Hus1" && m.participantB !== "Hus1")).toBe(true);
  });

  it("does not run the bot half ahead of the house", () => {
    const t = cup(16);
    const { tournament } = playElsewhere(t);
    const done = tournament.matches.filter((m) => m.winner && !m.isBye);
    expect(done.every((m) => m.bracketRoundSize === 8)).toBe(true);
  });

  it("plays the whole cup out once the house has gone", () => {
    let t = cup(8);
    // The house loses its first match.
    t = playElsewhere(t).tournament;
    const m = nextPlayable(t)!;
    const other = [m.participantA, m.participantB].find((n) => n !== "Hus1")!;
    t = recordKnockoutResult(t, m.id, [other, "Hus1"], { [other]: { hits: 1, misses: 0, darts: 30, hitsByStep: {}, missesByStep: {} }, Hus1: { hits: 1, misses: 5, darts: 40, hitsByStep: {}, missesByStep: {} } });
    const finished = playElsewhere(t).tournament;
    expect(finished.status).toBe("done");
    expect(finished.winner).toBeTruthy();
    expect(finished.winner).not.toBe("Hus1");
  });

  it("never touches a tournament that is not a cup", () => {
    const t = createKnockout("individual", [{ name: "A", isBot: true, botLevel: "3" }, { name: "B", isBot: true, botLevel: "4" }], "t", "2026-01-01");
    expect(playElsewhere(t).decided).toEqual([]);
  });

  it("handles a VM of 128: all names are different, and the whole cup can be played out", () => {
    const t = cup(128, 3);
    expect(t.participants).toHaveLength(128);
    expect(new Set(t.participants.map((p) => p.name)).size).toBe(128);
    expect(t.participants.filter((p) => p.isBot).every((p) => !/ d+$/.test(p.name))).toBe(true);
    // Three of the house: only the bot matches of the first round are played elsewhere, and 64 matches are all it takes to start.
    const first = playElsewhere(t).tournament;
    expect(first.matches.filter((m) => m.simulated).every((m) => m.bracketRoundSize === 64)).toBe(true);
    // With the house out of the way the rest is one call.
    const bots = createKnockout("individual", t.participants.filter((p) => p.isBot), "t2", "2026-01-01", "standard", t.cup);
    const done = playElsewhere(bots).tournament;
    expect(done.status).toBe("done");
    expect(done.winner).toBeTruthy();
    // A cup of 128 is slow when every test runs at once: it gets the time it needs.
  }, 30_000);
});
