import { describe, expect, it } from "vitest";
import { HEAT_SEEDS, PILOT_SIZE, createPilot, currentStage, isReady, nextPilotMatch, pilotPlayers, pilotQueue, pilotSlotLabel, pilotStages, playPilotBots, readyMatches, recordPilotResult, routesOf, slotShort, undoPilotResult } from "./pilot";
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
  it("has nineteen matches: four heats, two of each lane, four lucky loser, four quarters, two semis and a final", () => {
    const t = make();
    expect(t.format).toBe("pilot");
    expect(t.matches).toHaveLength(19);
    expect(pilotStages(t).map((s) => [s.stage, s.matches.length])).toEqual([["heat", 4], ["winners", 2], ["losers", 2], ["lucky", 4], ["quarter", 4], ["semi", 2], ["final", 1]]);
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
    expect(pilotSlotLabel(t, byId(t, "q1"), 1)).toBe("1. i Lucky loser 3");
  });

  it("is for exactly sixteen", () => {
    expect(() => createPilot("individual", people().slice(0, 12), "t", "2026-10-30T10:00:00Z")).toThrow();
  });
});

describe("where the places go", () => {
  it("sends the first two of each heat to a winners lane and the last two to a losers lane, the two of a heat to different lanes", () => {
    let t = make();
    for (const h of ["h1", "h2", "h3", "h4"]) t = play(t, h);
    // Seeds in order within each heat: A: 1 8 9 16, B: 2 7 10 15, C: 3 6 11 14, D: 4 5 12 13.
    expect(pilotPlayers(byId(t, "w1"))).toEqual(["P1", "P3", "P5", "P7"]);
    expect(pilotPlayers(byId(t, "w2"))).toEqual(["P2", "P4", "P6", "P8"]);
    expect(pilotPlayers(byId(t, "l1"))).toEqual(["P9", "P11", "P13", "P15"]);
    expect(pilotPlayers(byId(t, "l2"))).toEqual(["P10", "P12", "P14", "P16"]);
    // Nobody shares a lane with someone from their own heat who finished next to them: A's first and second are in different lanes.
    expect(pilotPlayers(byId(t, "w1"))).toContain("P1");
    expect(pilotPlayers(byId(t, "w2"))).toContain("P8");
  });

  it("waits with a lane until all four heats are done", () => {
    let t = make();
    for (const h of ["h1", "h2", "h3"]) t = play(t, h);
    expect(isReady(byId(t, "w1"))).toBe(false);
    expect(isReady(byId(t, "w2"))).toBe(false);
    t = play(t, "h4");
    expect(isReady(byId(t, "w1"))).toBe(true);
    expect(isReady(byId(t, "w2"))).toBe(true);
  });

  it("sends the first two of a winners lane straight on and the last two to lucky loser, one against one with the first two of the losers lane of the same number", () => {
    let t = make();
    for (const id of EARLY) t = play(t, id);
    // w1: P1 P3 P5 P7 -> P1 P3 through. The third (P5) meets the second of l1 (P11), the fourth (P7) meets the first of l1 (P9): third
    // in the winners lane is easier to get than fourth.
    expect(pilotPlayers(byId(t, "k1"))).toEqual(["P5", "P11"]);
    expect(pilotPlayers(byId(t, "k2"))).toEqual(["P7", "P9"]);
    // And the same in the other lane: w2 gave P6 and P8 (third and fourth), l2 gave P10 (first) and P12 (second).
    expect(pilotPlayers(byId(t, "k3"))).toEqual(["P6", "P12"]);
    expect(pilotPlayers(byId(t, "k4"))).toEqual(["P8", "P10"]);
    // The last two of l1 (P13, P15) are out: they are in no later match.
    const later = t.matches.filter((m) => !EARLY.includes(m.id)).flatMap((m) => pilotPlayers(m));
    expect(later).not.toContain("P13");
    expect(later).not.toContain("P15");
  });

  it("puts someone straight through against someone from lucky loser, one against one, from the other lane", () => {
    let t = make();
    for (const id of [...EARLY, "k1", "k2", "k3", "k4"]) t = play(t, id);
    const q = (id: string) => pilotPlayers(byId(t, id));
    // w1 gave P1, P3 and w2 gave P2, P4. The winners of lucky loser were P5 (k1), P7 (k2), P6 (k3) and P8 (k4), the better seed each time.
    // Someone straight through meets a winner from the other lane: w1 against lucky loser 3 and 4, w2 against 1 and 2.
    expect(q("q1")).toEqual(["P1", "P6"]);
    expect(q("q2")).toEqual(["P3", "P8"]);
    expect(q("q3")).toEqual(["P2", "P5"]);
    expect(q("q4")).toEqual(["P4", "P7"]);
  });
});

describe("the rules from the quarter-finals", () => {
  it("are forced from the quarter-finals and not before", () => {
    const t = make();
    for (const id of [...EARLY, "k1", "k2", "k3", "k4"]) expect(byId(t, id).variant).toBeUndefined();
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
    for (const id of [...EARLY, "k1", "k2", "k3", "k4"]) t = play(t, id);
    for (const id of ["q1", "q2", "q3", "q4"]) expect(pilotPlayers(byId(t, id))).toHaveLength(2);
    expect(pilotQueue(t, nextPilotMatch(t)).map((m) => m.id)).toEqual(["q2", "q3", "q4"]);
  });

  it("can have a result that is not the strongest seed", () => {
    let t = make();
    t = play(t, "h1", ["P16", "P9", "P8", "P1"]);
    for (const h of ["h2", "h3", "h4"]) t = play(t, h);
    expect(pilotPlayers(byId(t, "w1"))).toEqual(["P3", "P5", "P7", "P16"]);
    expect(pilotPlayers(byId(t, "l1"))).toEqual(["P8", "P11", "P13", "P15"]);
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
  it("does not play a heat of bots while the heats of the house are still to be thrown", () => {
    const { tournament, decided } = playPilotBots(make(HEAT_A, true));
    expect(decided).toEqual([]);
    expect(byId(tournament, "h1").winner).toBeUndefined();
    expect(nextPilotMatch(tournament)?.id).toBe("h2");
  });

  it("decides the heat of bots once the house is through with its own, and shows the result", () => {
    let t = make(HEAT_A, true);
    for (const h of ["h2", "h3", "h4"]) {
      t = play(t, h);
      // Still one heat of the house to go until the last: nothing of the bots' is played.
      if (h !== "h4") expect(playPilotBots(t).decided).toEqual([]);
    }
    const { tournament, decided } = playPilotBots(t);
    expect(decided).toEqual(["h1"]);
    expect(byId(tournament, "h1").simulated).toBe(true);
    expect(byId(tournament, "h1").placements).toHaveLength(4);
  });

  it("does not play a lane that has someone of the house in it, and decides the heats of bots first", () => {
    // Heats A and D (seeds 1, 8, 9, 16 and 4, 5, 12, 13) are all bots. The lanes mix the heats, so every lane has someone from B or C.
    const botHeats = [...HEAT_A, 4, 5, 12, 13];
    let t = make(botHeats, true);
    expect(playPilotBots(t).decided).toEqual([]);
    t = play(t, "h2");
    expect(playPilotBots(t).decided).toEqual([]);
    t = play(t, "h3");
    const afterHeats = playPilotBots(t);
    t = afterHeats.tournament;
    // The house is through with its heats: the heats of bots are decided. The lanes are ready, and wait for the house.
    expect(afterHeats.decided).toEqual(["h1", "h4"]);
    expect(isReady(byId(t, "w1"))).toBe(true);
    expect(isReady(byId(t, "w2"))).toBe(true);
    expect(playPilotBots(t).decided).toEqual([]);
    expect(nextPilotMatch(t)?.id).toBe("w1");
    t = play(t, "w1");
    expect(playPilotBots(t).decided).toEqual([]);
    expect(byId(t, "l1").winner).toBeUndefined();
  });

  it("gives the same result every time for the same cup", () => {
    const run = () => {
      let t = make(HEAT_A, true);
      for (const h of ["h2", "h3", "h4"]) t = play(t, h);
      return playPilotBots(t).tournament;
    };
    expect(byId(run(), "h1").placements).toEqual(byId(run(), "h1").placements);
  });

  it("takes a result of the bots back together with the one thrown before it", () => {
    let t = make(HEAT_A, true);
    for (const h of ["h2", "h3", "h4"]) t = play(t, h);
    t = playPilotBots(t).tournament;
    expect(byId(t, "h1").winner).toBeTruthy();
    const back = undoPilotResult(t)!;
    // The last thrown (heat D) is reopened, and the heat of bots, decided after it, goes with it.
    expect(byId(back, "h4").winner).toBeUndefined();
    expect(byId(back, "h1").winner).toBeUndefined();
    expect(byId(back, "h3").winner).toBeTruthy();
  });
});

describe("merker for veien videre", () => {
  it("gir to veier for heat og baner, og ingen for de andre", () => {
    expect(routesOf("heat")!.map((r) => r.to)).toEqual(["Vinnerbane", "Taperbane"]);
    expect(routesOf("winners")!.map((r) => r.tone)).toEqual(["teal", "gold"]);
    expect(routesOf("losers")![1].to).toBe("Ute");
    expect(routesOf("semi")).toBeNull();
    expect(routesOf(undefined)).toBeNull();
  });
  it("kortet ned plassene til A1", () => {
    expect(slotShort("1. i Heat A")).toBe("A1");
    expect(slotShort("2. i Heat D")).toBe("D2");
    expect(slotShort("Lucky 1")).toBe("Lucky 1");
  });
});
