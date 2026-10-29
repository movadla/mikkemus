import { describe, expect, it } from "vitest";
import { awards, bracketRounds, createKnockout, firstRoundPairs, houseAlive, nextPlayable, openDraw, outIn, placeholderLabel, placeholderShort, recordKnockoutResult, roadOf, routeOf, seedByStrength, undoLastResult, undoableMatch } from "./knockout";
import { podium, recordMatchResult, type Participant, type Tournament } from "./tournament";

const people = (n: number, bots = 0): Participant[] => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, isBot: i >= n - bots }));
const make = (n: number, bots = 0): Tournament => createKnockout("individual", people(n, bots), "t", "2026-01-01");
const agg = (darts: number) => ({ hits: 0, misses: 0, darts, hitsByStep: {}, missesByStep: {} });

/** Plays the next match: the better seed wins, or the other one when it is an upset. */
function playNext(t: Tournament, upset = false): Tournament {
  const m = nextPlayable(t)!;
  const [a, b] = [m.participantA!, m.participantB!];
  const better = Number(a.slice(1)) < Number(b.slice(1)) ? a : b;
  const worse = better === a ? b : a;
  const winner = upset ? worse : better;
  const loser = upset ? better : worse;
  return recordMatchResult(t, m.id, [winner, loser], { [winner]: agg(33), [loser]: agg(45) });
}

function playAll(t: Tournament): Tournament {
  let cur = t;
  while (nextPlayable(cur)) cur = playNext(cur);
  return cur;
}

describe("the bracket is whole from the start", () => {
  it("has every round for 8, with 1 meeting 8 and the later places empty", () => {
    const t = make(8);
    expect(t.format).toBe("knockout");
    expect(t.matches.filter((m) => !m.isBronzeMatch).map((m) => m.bracketRoundSize)).toEqual([4, 4, 4, 4, 2, 2, 1]);
    expect(t.matches[0]).toMatchObject({ participantA: "P1", participantB: "P8" });
    expect(t.matches.find((m) => m.id === "bracket-2-0")).toMatchObject({ participantA: null, participantB: null, feedA: "bracket-4-0", feedB: "bracket-4-1" });
    expect(bracketRounds(t).map((r) => r.short)).toEqual(["Kvart", "Semi", "Finale"]);
  });

  it("gives the byes to the top seeds and moves them on at once", () => {
    const t = make(6);
    const first = t.matches.filter((m) => m.bracketRoundSize === 4);
    expect(first.filter((m) => m.isBye).map((m) => m.winner).sort()).toEqual(["P1", "P2"]);
    const semis = t.matches.filter((m) => m.bracketRoundSize === 2 && !m.isBronzeMatch);
    expect(semis.some((m) => m.participantA === "P1" || m.participantB === "P1")).toBe(true);
    expect(semis.some((m) => m.participantA === "P2" || m.participantB === "P2")).toBe(true);
  });

  it("works for two and for three", () => {
    const two = make(2);
    expect(two.matches).toHaveLength(1);
    expect(nextPlayable(two)).toMatchObject({ participantA: "P1", participantB: "P2" });
    const three = make(3);
    expect(three.matches.some((m) => m.isBronzeMatch)).toBe(false);
    expect(nextPlayable(three)).toMatchObject({ participantA: "P2", participantB: "P3" });
  });

  it("names an empty place after the match that fills it", () => {
    const t = make(8);
    const semi = t.matches.find((m) => m.id === "bracket-2-0")!;
    expect(placeholderLabel(t, semi, "A")).toBe("Vinner Kvartfinale 1");
    expect(placeholderLabel(t, semi, "B")).toBe("Vinner Kvartfinale 2");
    // There is no match for third place.
    expect(t.matches.some((m) => m.isBronzeMatch)).toBe(false);
  });
});

describe("a result moves everyone on", () => {
  it("fills the next place, and there is no match for the semi-final losers", () => {
    let t = make(4);
    t = playNext(t);
    t = playNext(t);
    const final = t.matches.find((m) => m.bracketRoundSize === 1 && !m.isBronzeMatch)!;
    expect(final).toMatchObject({ participantA: "P1", participantB: "P2" });
    expect(t.matches.some((m) => m.isBronzeMatch)).toBe(false);
    expect(t.status).toBe("playoff");
  });

  it("plays out an 8-cup in 7 matches, with no one in third place", () => {
    const t = playAll(make(8));
    expect(t.status).toBe("done");
    expect(t.winner).toBe("P1");
    expect(podium(t)).toEqual({ first: "P1", second: "P2", third: null });
    expect(t.matches.filter((m) => m.winner && !m.isBye)).toHaveLength(7);
  });

  it("finishes a cup of 5 through its byes", () => {
    const t = playAll(make(5));
    expect(t.status).toBe("done");
    expect(t.winner).toBe("P1");
  });

  it("goes to the one who beats the odds", () => {
    let t = make(4);
    t = playNext(t, true);
    t = playNext(t);
    t = playNext(t);
    expect(t.winner).toBe("P2");
  });
});

describe("Angre takes the last result back", () => {
  it("reopens the match and empties the places it filled", () => {
    const t = playNext(make(4));
    const undone = undoLastResult(t)!;
    expect(undone.matches.find((m) => m.id === "bracket-2-0")!.winner).toBeUndefined();
    expect(undone.matches.find((m) => m.id === "bracket-1-0")!.participantA).toBeNull();
    expect(nextPlayable(undone)).toMatchObject({ id: "bracket-2-0" });
  });

  it("takes back the whole cup when the final was the last result", () => {
    const undone = undoLastResult(playAll(make(4)))!;
    expect(undone.status).toBe("playoff");
    expect(undone.winner).toBeUndefined();
  });

  it("only takes back the latest, one step at a time", () => {
    let t = make(8);
    for (let i = 0; i < 5; i++) t = playNext(t);
    expect(undoableMatch(t)!.id).toBe("bracket-2-0");
    const once = undoLastResult(t)!;
    expect(undoableMatch(once)!.id).toBe("bracket-4-3");
    expect(undoLastResult(make(4))).toBeNull();
  });

  it("clears what the model decided from it", () => {
    // P1 is the house; P2, P3 and P4 are bots.
    let t = make(4, 3);
    t = recordKnockoutResult(t, "bracket-2-0", ["P4", "P1"], { P4: agg(40), P1: agg(50) });
    t = recordKnockoutResult(t, "bracket-2-1", ["P3", "P2"], { P3: agg(40), P2: agg(50) }, { simulated: true });
    // The one the model decided is not what Angre takes back.
    expect(undoableMatch(t)!.id).toBe("bracket-2-0");
    // Taking back the one before it takes the model's with it, since nothing played by hand follows from either.
    const back = undoLastResult(t)!;
    expect(back.matches.find((m) => m.id === "bracket-2-0")!.winner).toBeUndefined();
    expect(back.matches.find((m) => m.id === "bracket-2-1")!.winner).toBe("P3");
  });
});

describe("who is still in it", () => {
  it("tells where someone went out, and whether the house is alive", () => {
    let t = make(4, 3);
    expect(houseAlive(t)).toBe(true);
    t = playNext(t, true);
    expect(outIn(t, "P1")?.bracketRoundSize).toBe(2);
    expect(houseAlive(t)).toBe(false);
    expect(outIn(t, "P4")).toBeNull();
  });

  it("gives the road to the cup in order", () => {
    const t = playAll(make(8));
    const road = roadOf(t, "P1");
    expect(road.map((r) => r.label)).toEqual(["Kvartfinale", "Semifinale", "Finale"]);
    expect(road.every((r) => r.won)).toBe(true);
    expect(road.map((r) => r.opponent)).toEqual(["P8", "P4", "P2"]);
  });
});

describe("awards", () => {
  it("finds the fewest darts and the biggest upset", () => {
    let t = make(4);
    t = playNext(t, true);
    t = playNext(t);
    t = playNext(t);
    const a = awards(t);
    expect(a.find((x) => x.title === "Største skrell")).toMatchObject({ name: "P4" });
    expect(a.find((x) => x.title === "Færrest piler i en seier")?.detail).toBe("33 piler");
  });
});

describe("seeding and the draw", () => {
  it("seeds by strength and keeps the order on ties", () => {
    const e = [{ name: "A" }, { name: "B" }, { name: "C" }];
    const s = new Map([["A", 1], ["B", 3], ["C", 3]]);
    expect(seedByStrength(e, (n) => s.get(n)!).map((x) => x.name)).toEqual(["B", "C", "A"]);
  });

  it("draws the same order for the same seed, and every name once", () => {
    const names = ["A", "B", "C", "D", "E"];
    expect(openDraw(names, 7)).toEqual(openDraw(names, 7));
    expect([...openDraw(names, 7)].sort()).toEqual(names);
  });

  it("pairs the first round for the draw screen", () => {
    expect(firstRoundPairs(["A", "B", "C", "D", "E", "F"])).toEqual([
      { a: "A", b: null },
      { a: "D", b: "E" },
      { a: "B", b: null },
      { a: "C", b: "F" },
    ]);
  });
});

describe("the route of one entrant", () => {
  it("is their first match and the matches their wins would lead to, before anything is played", () => {
    const t = make(8);
    expect([...routeOf(t, "P1")].sort()).toEqual(["bracket-1-0", "bracket-2-0", "bracket-4-0"].sort());
  });

  it("ends where they lost, and goes on while they win", () => {
    let t = make(8);
    t = playNext(t); // P1 beats P8
    expect(routeOf(t, "P1").has("bracket-2-0")).toBe(true);
    const out = routeOf(t, "P8");
    expect([...out]).toEqual(["bracket-4-0"]);
  });
});

describe("placeholderShort", () => {
  it("kortner ned plassene i treet", () => {
    expect(placeholderShort("Vinner Semifinale 2")).toBe("Vinner S2");
    expect(placeholderShort("Taper Semifinale 1")).toBe("Taper S1");
    expect(placeholderShort("Vinner Kvartfinale 3")).toBe("Vinner K3");
    expect(placeholderShort("Vinner 8-delsfinale 3")).toBe("Vinner 8D 3");
    expect(placeholderShort("Frist plass")).toBe("Frist plass");
  });
});
