import { describe, expect, it } from "vitest";
import { emptyProgress, type PlayerProgress, type Step, type TurnResult } from "./game";
import { buildMatchFacts, factsFingerprint, ruleBasedSummary, validateFacts, type MatchFacts } from "./matchSummary";

/** A turn that banked `hits` crosses on one row and missed the rest of its three darts. */
const turn = (hits: number, step: Step = "20", misses?: number): TurnResult => ({
  hitsByStep: hits > 0 ? { [step]: hits } : {},
  missStep: step,
  misses: misses ?? Math.max(0, 3 - hits),
  darts: 3,
});

function finalProgress(winner: string, loser: string, loserStuck: Step = "T"): PlayerProgress {
  const full = { ...emptyProgress() };
  (Object.keys(full) as Step[]).forEach((s) => (full[s] = 3));
  const partial = { ...full };
  const order: Step[] = ["20", "19", "18", "17", "16", "15", "14", "D", "T", "BULL"];
  for (let i = order.indexOf(loserStuck); i < order.length; i++) partial[order[i]] = 0;
  return { [winner]: full, [loser]: partial };
}

describe("buildMatchFacts", () => {
  it("counts rounds, crosses and the lead round by round", () => {
    const facts = buildMatchFacts({
      players: ["A", "B"],
      winner: "A",
      turnLog: {
        A: [turn(1), turn(1), turn(3), turn(3), turn(3)],
        B: [turn(3), turn(3), turn(0), turn(0), turn(0)],
      },
      finalProgress: finalProgress("A", "B"),
      target: 3,
    });
    expect(facts.rounds).toBe(5);
    const a = facts.players.find((p) => p.name === "A")!;
    expect(a.crossesByRound).toEqual([1, 2, 5, 8, 11]);
    // B led after rounds 1 and 2 (3, 6 vs 1, 2); A took over in round 3 (5 vs 6? no — 5 < 6), round 4 (8 > 6).
    expect(facts.leadChanges).toBe(1);
    expect(facts.leaderAtHalf).toBe("B");
  });

  it("a level score is not a change of lead", () => {
    const facts = buildMatchFacts({
      players: ["A", "B"],
      winner: "A",
      turnLog: { A: [turn(2), turn(2), turn(2), turn(2)], B: [turn(2), turn(2), turn(2), turn(1)] },
      finalProgress: finalProgress("A", "B"),
      target: 3,
    });
    expect(facts.leadChanges).toBe(0);
  });

  it("handles a player with no turns and an empty log without throwing", () => {
    const facts = buildMatchFacts({ players: ["A", "B"], winner: "A", turnLog: { A: [turn(3)] }, finalProgress: finalProgress("A", "B"), target: 3 });
    expect(facts.players.find((p) => p.name === "B")).toMatchObject({ darts: 0, rounds: 0, hitPct: 0 });
    expect(() => ruleBasedSummary(facts)).not.toThrow();
  });

  it("measures the halves only with enough turns, and reports the row a loser was stuck on", () => {
    const short = buildMatchFacts({ players: ["A", "B"], winner: "A", turnLog: { A: [turn(3), turn(3)], B: [turn(1), turn(1)] }, finalProgress: finalProgress("A", "B"), target: 3 });
    expect(short.players[0].firstHalfPct).toBeNull();
    const longer = buildMatchFacts({
      players: ["A", "B"],
      winner: "A",
      turnLog: { A: Array.from({ length: 6 }, () => turn(3)), B: [turn(3), turn(3), turn(3), turn(0), turn(0), turn(0)] },
      finalProgress: finalProgress("A", "B", "D"),
      target: 3,
    });
    const b = longer.players.find((p) => p.name === "B")!;
    expect(b.firstHalfPct).toBe(100);
    expect(b.secondHalfPct).toBe(0);
    expect(b.stuckOn).toBe("D");
    expect(longer.players.find((p) => p.name === "A")!.stuckOn).toBeNull();
  });
});

describe("hit percentage", () => {
  it("matches the winner screen's table: a triple does not push it past 100 %", () => {
    // Three darts, one of them a triple closing a whole row (3 crosses) and two misses: the app
    // prints 3 / (3 + 0)... a turn with a triple and nothing else lost is still 100 %.
    const triple: TurnResult = { hitsByStep: { "20": 3 }, missStep: "20", misses: 0, darts: 1 };
    const facts = buildMatchFacts({ players: ["A", "B"], winner: "A", turnLog: { A: [triple, triple], B: [turn(1)] }, finalProgress: finalProgress("A", "B"), target: 3 });
    expect(facts.players[0].hitPct).toBe(100);
    expect(facts.players[1].hitPct).toBe(33);
  });
});

describe("ruleBasedSummary", () => {
  const base = (over: Partial<MatchFacts> = {}): MatchFacts => {
    const winnerTurns = Array.from({ length: 8 }, () => turn(3));
    return {
      ...buildMatchFacts({
        players: ["A", "B"],
        winner: "A",
        turnLog: { A: winnerTurns, B: Array.from({ length: 8 }, () => turn(1)) },
        finalProgress: finalProgress("A", "B", "T"),
        target: 3,
      }),
      ...over,
    };
  };

  it("names the winner, the rounds and the numbers", () => {
    const text = ruleBasedSummary(base());
    expect(text).toContain("A vant på 8 runder");
    expect(text).toContain("100 % treff");
    expect(text).toContain("24 piler");
  });

  it("says the winner led all the way when the lead never changed hands", () => {
    expect(ruleBasedSummary(base())).toContain("A hadde ledelsen hele veien.");
  });

  it("describes a comeback when someone else led at half time", () => {
    const text = ruleBasedSummary(base({ leaderAtHalf: "B", leadChanges: 2 }));
    expect(text).toContain("B ledet halvveis, men A snudde kampen.");
  });

  it("reports a clear drop between the halves — the 'started well, struggled late' story", () => {
    const facts = buildMatchFacts({
      players: ["A", "B"],
      winner: "A",
      turnLog: { A: Array.from({ length: 8 }, () => turn(3)), B: [turn(3), turn(3), turn(3), turn(3), turn(0), turn(0), turn(0), turn(0)] },
      finalProgress: finalProgress("A", "B", "T"),
      target: 3,
    });
    expect(ruleBasedSummary(facts)).toMatch(/B startet bra \(100 %\), men falt av mot slutten \(0 %\)\./);
  });

  it("names where the loser got stuck, and the misses there when they stand out", () => {
    const facts = buildMatchFacts({
      players: ["A", "B"],
      winner: "A",
      turnLog: {
        A: Array.from({ length: 6 }, () => turn(3)),
        B: [turn(3), turn(3), turn(3), turn(0, "T", 5), turn(0, "T", 5), turn(1, "20", 2)],
      },
      finalProgress: finalProgress("A", "B", "T"),
      target: 3,
    });
    const text = ruleBasedSummary(facts);
    expect(text).toMatch(/B hadde \d+ kryss igjen og stod fast på trippel/);
    expect(text).toContain("bom der");
  });

  it("returns an empty string rather than throwing when the winner is not among the players", () => {
    expect(ruleBasedSummary({ ...base(), winner: "Ghost" })).toBe("");
  });

  it("never claims a drop or a lift that the numbers do not show", () => {
    const text = ruleBasedSummary(base());
    expect(text).not.toMatch(/falt av|kom sterkere/);
  });
});

describe("factsFingerprint", () => {
  it("is stable for the same match and different for another", () => {
    const a = buildMatchFacts({ players: ["A", "B"], winner: "A", turnLog: { A: [turn(3)], B: [turn(1)] }, finalProgress: finalProgress("A", "B"), target: 3 });
    const b = buildMatchFacts({ players: ["A", "B"], winner: "A", turnLog: { A: [turn(3)], B: [turn(2)] }, finalProgress: finalProgress("A", "B"), target: 3 });
    expect(factsFingerprint(a)).toBe(factsFingerprint(a));
    expect(factsFingerprint(a)).not.toBe(factsFingerprint(b));
  });
});

describe("validateFacts — the route is open to anyone", () => {
  const good = () =>
    buildMatchFacts({ players: ["A", "B"], winner: "A", turnLog: { A: [turn(3), turn(3)], B: [turn(1), turn(1)] }, finalProgress: finalProgress("A", "B"), target: 3 });

  it("accepts what buildMatchFacts produces, after a JSON round trip", () => {
    const parsed = validateFacts(JSON.parse(JSON.stringify(good())));
    expect(parsed).not.toBeNull();
    expect(parsed!.winner).toBe("A");
  });

  it("refuses anything that is not facts", () => {
    for (const bad of [null, undefined, 3, "x", [], {}, { winner: "A" }]) expect(validateFacts(bad)).toBeNull();
  });

  it("refuses a winner who is not a player, bad numbers, and unknown rows", () => {
    expect(validateFacts({ ...good(), winner: "Ghost" })).toBeNull();
    expect(validateFacts({ ...good(), target: 9 })).toBeNull();
    expect(validateFacts({ ...good(), rounds: -1 })).toBeNull();
    expect(validateFacts({ ...good(), rounds: Number.NaN })).toBeNull();
    const withBadRow = JSON.parse(JSON.stringify(good()));
    withBadRow.players[0].missesByStep = { "99": 3 };
    expect(validateFacts(withBadRow)).toBeNull();
    const withBadStuck = JSON.parse(JSON.stringify(good()));
    withBadStuck.players[1].stuckOn = "DROP TABLE";
    expect(validateFacts(withBadStuck)).toBeNull();
  });

  it("refuses names that are empty or long enough to carry a prompt, and oversized lists", () => {
    const long = JSON.parse(JSON.stringify(good()));
    long.players[0].name = "x".repeat(200);
    expect(validateFacts(long)).toBeNull();
    const empty = JSON.parse(JSON.stringify(good()));
    empty.players[0].name = "";
    expect(validateFacts(empty)).toBeNull();
    const huge = JSON.parse(JSON.stringify(good()));
    huge.players[0].crossesByRound = Array.from({ length: 5000 }, () => 1);
    expect(validateFacts(huge)).toBeNull();
    const many = JSON.parse(JSON.stringify(good()));
    many.players = Array.from({ length: 40 }, (_, i) => ({ ...many.players[0], name: `P${i}` }));
    expect(validateFacts(many)).toBeNull();
  });
});
