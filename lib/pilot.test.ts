import { describe, expect, it } from "vitest";
import { HEAT_SEEDS, PILOT_SIZE, createPilot, currentStage, isReady, nextPilotMatch, pilotPlayers, pilotQueue, pilotSlotLabel, pilotStages, playPilotBots, readyMatches, recordPilotResult, undoPilotResult } from "./pilot";
import type { Participant, Tournament } from "./tournament";

/** Sixteen entrants, P1 the strongest; the seeds in `botSeeds` are bots. */
const people = (botSeeds: number[] = []): Participant[] => Array.from({ length: PILOT_SIZE }, (_, i) => ({ name: `P${i + 1}`, isBot: botSeeds.includes(i + 1), ...(botSeeds.includes(i + 1) ? { skill: 4, botLevel: "4" as const } : {}) }));
const make = (botSeeds: number[] = [], cup = false): Tournament =>
  createPilot("individual", people(botSeeds), "t", "2026-10-30T10:00:00Z", undefined, cup ? { kind: "open", name: "Ly Pilotturnering", trophy: "Ly-pokalen", level: "4", growth: false, seed: 5 } : undefined);
// Heat A is seeds 1, 8, 9 and 16: all bots there makes it a heat nobody of the house plays.
const HEAT_A = [1, 8, 9, 16];
const seedOf = (n: string) => Number(n.slice(1));
const byId = (t: Tournament, id: string) => t.matches.find((m) => m.id === id)!;

/** Plays a match: the best seed first (or the order given). */
function play(t: Tournament, id: string, order?: string[]): Tournament {
  const m = byId(t, id);
  const placements = order ?? [...pilotPlayers(m)].sort((a, b) => seedOf(a) - seedOf(b));
  return recordPilotResult(t, id, placements, {});
}

function playAll(t: Tournament): Tournament {
  let cur = t;
  for (let guard = 0; guard < 40; guard++) {
    const m = nextPilotMatch(cur);
    if (!m) break;
    cur = play(cur, m.id);
  }
  return cur;
}

const EARLY = ["h1", "h2", "h3", "h4", "w1", "w2", "l1", "l2"];

describe("the pilot tournament is whole from the start", () => {
  it("has seventeen matches: four heats, two of each lane, two lucky loser, four quarters, two semis and a final", () => {
    const t = make();
    expect(t.format).toBe("pilot");
    expect(t.matches).toHaveLength(17);
    expect(pilotStages(t).map((s) => [s.stage, s.matches.length])).toEqual([["heat", 4], ["winners", 2], ["losers", 2], ["lucky", 2], ["quarter", 4], ["semi", 2], ["final", 1]]);
  });

  it("seeds the heats in a snake", () => {
    const t = make();
    expect(HEAT_SEEDS.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(pilotPlayers(byId(t, "h1"))).toEqual(["P1", "P8", "P9", "P16"]);
    expect(pilotPlayers(byId(t, "h2"))).toEqual(["P2", "P7", "P10", "P15"]);
    expect(pilotPlayers(byId(t, "h4"))).toEqual(["P4", "P5", "P12", "P13"]);
  });

  it("only has the heats to play at first, strongest heat first", () => {
    const t = make();
    expect(readyMatches(t).map((m) => m.id)).toEqual(["h1", "h2", "h3", "h4"]);
    expect(nextPilotMatch(t)?.id).toBe("h1");
    expect(currentStage(t)).toBe("heat");
    expect(isReady(byId(t, "w1"))).toBe(false);
  });

  it("says what fills an empty place", () => {
    const t = make();
    expect(pilotSlotLabel(t, byId(t, "w1"), 0)).toBe("1. i Heat A");
    expect(pilotSlotLabel(t, byId(t, "q1"), 1)).toBe("2. i Lucky loser 2");
  });

  it("is for exactly sixteen", () => {
    expect(() => createPilot("individual", people().slice(0, 12), "t", "2026-10-30T10:00:00Z")).toThrow();
  });
});

describe("where the places go", () => {
  it("sends the first two of each heat to a winners lane and the last two to a losers lane, mixing A with D and B with C", () => {
    let t = make();
    for (const h of ["h1", "h2", "h3", "h4"]) t = play(t, h);
    // Seeds in order within each heat: A: 1 8 9 16, B: 2 7 10 15, C: 3 6 11 14, D: 4 5 12 13.
    expect(pilotPlayers(byId(t, "w1"))).toEqual(["P1", "P4", "P5", "P8"]);
    expect(pilotPlayers(byId(t, "w2"))).toEqual(["P2", "P3", "P6", "P7"]);
    expect(pilotPlayers(byId(t, "l1"))).toEqual(["P9", "P12", "P13", "P16"]);
    expect(pilotPlayers(byId(t, "l2"))).toEqual(["P10", "P11", "P14", "P15"]);
  });

  it("waits with a lane until both heats that feed it are done", () => {
    let t = make();
    t = play(t, "h1");
    expect(isReady(byId(t, "w1"))).toBe(false);
    t = play(t, "h4");
    expect(isReady(byId(t, "w1"))).toBe(true);
    expect(isReady(byId(t, "w2"))).toBe(false);
  });

  it("sends the first two of a winners lane straight on and the last two to lucky loser, against the first two of the losers lane of the same number", () => {
    let t = make();
    for (const id of EARLY) t = play(t, id);
    // w1: P1 P4 P5 P8 -> P1 P4 through, P5 P8 to lucky loser 1 with the first two of l1 (P9 P12).
    expect(pilotPlayers(byId(t, "k1"))).toEqual(["P5", "P8", "P9", "P12"]);
    expect(pilotPlayers(byId(t, "k2"))).toEqual(["P6", "P7", "P10", "P11"]);
    // The last two of l1 (P13, P16) are out: they are in no later match.
    const later = t.matches.filter((m) => !EARLY.includes(m.id)).flatMap((m) => pilotPlayers(m));
    expect(later).not.toContain("P13");
    expect(later).not.toContain("P16");
  });

  it("puts someone straight through against someone from lucky loser, one against one, from the other lane", () => {
    let t = make();
    for (const id of [...EARLY, "k1", "k2"]) t = play(t, id);
    const q = (id: string) => pilotPlayers(byId(t, id));
    // w1 gave P1, P4 and w2 gave P2, P3; lucky loser 1 gave P5, P8 and lucky loser 2 gave P6, P7.
    expect(q("q1")).toEqual(["P1", "P7"]);
    expect(q("q2")).toEqual(["P4", "P6"]);
    expect(q("q3")).toEqual(["P2", "P8"]);
    expect(q("q4")).toEqual(["P3", "P5"]);
  });
});

describe("the rules from the quarter-finals", () => {
  it("are forced from the quarter-finals and not before", () => {
    const t = make();
    for (const id of [...EARLY, "k1", "k2"]) expect(byId(t, id).variant).toBeUndefined();
    for (const id of ["q1", "q2", "q3", "q4", "s1", "s2", "f"]) expect(byId(t, id).variant).toBe("standard+forced");
  });
});

describe("playing it through", () => {
  it("ends with the final, and the winner is the champion", () => {
    const t = playAll(make());
    expect(t.status).toBe("done");
    expect(t.winner).toBe("P1");
    expect(t.matches.every((m) => !!m.winner)).toBe(true);
    expect(t.completedAt).toBeTruthy();
  });

  it("has one against one from the quarter-finals", () => {
    let t = make();
    for (const id of [...EARLY, "k1", "k2"]) t = play(t, id);
    for (const id of ["q1", "q2", "q3", "q4"]) expect(pilotPlayers(byId(t, id))).toHaveLength(2);
    expect(pilotQueue(t, nextPilotMatch(t)).map((m) => m.id)).toEqual(["q2", "q3", "q4"]);
  });

  it("can have a result that is not the strongest seed", () => {
    let t = make();
    t = play(t, "h1", ["P16", "P9", "P8", "P1"]);
    t = play(t, "h4");
    expect(pilotPlayers(byId(t, "w1"))).toEqual(["P4", "P5", "P9", "P16"]);
    expect(pilotPlayers(byId(t, "l1"))).toEqual(["P1", "P8", "P12", "P13"]);
  });
});

describe("taking a result back", () => {
  it("reopens the match and empties the places it had filled", () => {
    let t = make();
    for (const h of ["h1", "h2", "h3", "h4"]) t = play(t, h);
    t = play(t, "w1");
    expect(byId(t, "w1").winner).toBeTruthy();
    const back = undoPilotResult(t)!;
    expect(byId(back, "w1").winner).toBeUndefined();
    expect(isReady(byId(back, "w1"))).toBe(true);
    const backAgain = undoPilotResult(back)!;
    expect(byId(backAgain, "h4").winner).toBeUndefined();
    // With a heat open again, the lanes it fed are empty.
    expect(isReady(byId(backAgain, "w1"))).toBe(false);
    expect(pilotPlayers(byId(backAgain, "l1"))).toEqual([]);
  });

  it("takes the whole tournament back from done", () => {
    const back = undoPilotResult(playAll(make()))!;
    expect(back.status).toBe("playoff");
    expect(back.winner).toBeUndefined();
    expect(byId(back, "f").winner).toBeUndefined();
    expect(isReady(byId(back, "f"))).toBe(true);
  });

  it("has nothing to take back at the start", () => {
    expect(undoPilotResult(make())).toBeNull();
  });
});

describe("a cup with bots", () => {
  it("decides a heat of only bots, and leaves the rest", () => {
    const { tournament, decided } = playPilotBots(make(HEAT_A, true));
    expect(decided).toEqual(["h1"]);
    expect(byId(tournament, "h1").simulated).toBe(true);
    expect(byId(tournament, "h1").placements).toHaveLength(4);
    expect(nextPilotMatch(tournament)?.id).toBe("h2");
  });

  it("gives the same result every time for the same cup", () => {
    const a = playPilotBots(make(HEAT_A, true)).tournament;
    const b = playPilotBots(make(HEAT_A, true)).tournament;
    expect(a.matches.map((m) => m.placements)).toEqual(b.matches.map((m) => m.placements));
  });

  it("takes a simulated result back together with the one thrown before it", () => {
    let { tournament: t } = playPilotBots(make(HEAT_A, true));
    t = play(t, "h2");
    t = play(t, "h3");
    const back = undoPilotResult(t)!;
    expect(byId(back, "h3").winner).toBeUndefined();
    expect(byId(back, "h2").winner).toBeTruthy();
    expect(byId(back, "h1").winner).toBeTruthy();
    // Taking back the one before it takes the bots' heat along: it was decided after it.
    const again = undoPilotResult(playPilotBots(make(HEAT_A, true)).tournament);
    expect(again).toBeNull();
  });
});
