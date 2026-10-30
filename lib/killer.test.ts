import { describe, expect, it } from "vitest";
import { BULL, MISS } from "./lava";
import { HITS_TO_KILLER, newGame, playDart, stateOf, sunkSections, undoDart, type KillerGame } from "./killer";

const throwAll = (g: KillerGame, ...sections: number[]) => sections.reduce(playDart, g);
const D = (n: number) => 100 + n;
const T = (n: number) => 200 + n;
/** Three players with the numbers 20 (A), 19 (B) and 18 (C), and A up in the second part. */
const started = (lives = 3) => throwAll(newGame(lives, ["A", "B", "C"]), 20, 19, 18);

describe("killer: getting a number", () => {
  it("gives each player the number their dart landed on, in turn", () => {
    const s = stateOf(started());
    expect(s.numbers).toEqual({ A: 20, B: 19, C: 18 });
    expect(s.phase).toBe("play");
    expect(s.up).toBe("A");
  });
  it("throws again when the dart finds no number, or a number that is taken", () => {
    let g = throwAll(newGame(3, ["A", "B"]), MISS, BULL);
    expect(stateOf(g).up).toBe("A");
    g = throwAll(g, 7, 7);
    const s = stateOf(g);
    expect(s.numbers).toEqual({ A: 7, B: null });
    expect(s.up).toBe("B");
    expect(s.log.map((d) => d.effect)).toEqual(["again", "again", "claim", "taken"]);
  });
  it("counts a double and a treble as the number it is on", () => {
    expect(stateOf(throwAll(newGame(3, ["A", "B"]), T(20), D(20))).numbers).toEqual({ A: 20, B: null });
  });
});

describe("killer: becoming a killer", () => {
  it("takes three hits on the own number, a double counting two and a treble three", () => {
    let s = stateOf(throwAll(started(), 20));
    expect(s.hits.A).toBe(1);
    expect(s.killer.A).toBe(false);
    s = stateOf(throwAll(started(), D(20), 20));
    expect(s.killer.A).toBe(true);
    s = stateOf(throwAll(started(), T(20)));
    expect(s.killer.A).toBe(true);
    expect(s.log.at(-1)!.effect).toBe("killer");
    expect(HITS_TO_KILLER).toBe(3);
  });
  it("does not let anyone who is not a killer take a life", () => {
    const s = stateOf(throwAll(started(), 19));
    expect(s.lives.B).toBe(3);
    expect(s.log.at(-1)!.effect).toBe("nothing");
  });
});

describe("killer: taking lives", () => {
  it("takes one life for a single, two for a double and three for a treble, once the dart is thrown by a killer", () => {
    let s = stateOf(throwAll(started(), T(20), 19, D(19)));
    // A is a killer after the treble, hits B's 19 (single) and then B's double. Wait: that is the same round: darts 2 and 3.
    expect(s.lives.B).toBe(0);
    expect(s.log.at(-1)!.effect).toBe("kill");
    expect(s.kills.A).toBe(1);
    s = stateOf(throwAll(started(), T(20), 19, MISS));
    expect(s.lives.B).toBe(2);
    expect(s.log[s.log.length - 2].victim).toBe("B");
    expect(s.log[s.log.length - 2].livesLost).toBe(1);
  });
  it("takes a life from a killer who hits their own number", () => {
    const s = stateOf(throwAll(started(), T(20), 20));
    expect(s.lives.A).toBe(2);
    expect(s.log.at(-1)!.effect).toBe("self");
  });
  it("puts a player out with no lives, and the killer goes on with the round", () => {
    const s = stateOf(throwAll(started(1), T(20), 19));
    expect(s.lives.B).toBe(0);
    // A is still up with the third dart of the round: the one who is out is not the one throwing.
    expect(s.up).toBe("A");
    expect(s.thrown).toBe(2);
  });
  it("ends the round of a player who hits their own number on the last life", () => {
    const s = stateOf(throwAll(started(1), T(20), 20));
    expect(s.lives.A).toBe(0);
    expect(s.log.at(-1)!.effect).toBe("selfout");
    expect(s.up).toBe("B");
  });
  it("is won by the last one with a life, and takes no more darts", () => {
    const g = throwAll(started(1), T(20), 19, 18);
    const s = stateOf(g);
    expect(s.winner).toBe("A");
    expect(s.kills.A).toBe(2);
    expect(playDart(g, 5)).toBe(g);
  });
  it("lets a dart on the number of one who is out do nothing", () => {
    const s = stateOf(throwAll(started(1), T(20), 19, 19));
    expect(s.log.at(-1)!.effect).toBe("nothing");
  });
});

describe("killer: the round, undo, teams and the board", () => {
  it("is three darts a round, and the next player who is alive throws", () => {
    const s = stateOf(throwAll(started(), MISS, MISS, MISS));
    expect(s.up).toBe("B");
    expect(s.rounds.A).toBe(1);
  });
  it("takes the last dart back, also across a round and out of a win", () => {
    let g = throwAll(started(1), T(20), 19, 18);
    g = undoDart(g);
    expect(stateOf(g).winner).toBeNull();
    g = undoDart(throwAll(started(), MISS, MISS, MISS));
    expect(stateOf(g).up).toBe("A");
    expect(stateOf(g).thrown).toBe(2);
    expect(undoDart(newGame(3, ["A", "B"])).darts).toEqual([]);
  });
  it("lets the members of a team throw a round each, in turn", () => {
    const g = newGame(3, ["T1", "T2"], { T1: [{ name: "Lars", isBot: false }, { name: "Per", isBot: false }], T2: [{ name: "Ola", isBot: false }, { name: "Kari", isBot: false }] });
    let s = stateOf(throwAll(g, 20, 19));
    expect(s.phase).toBe("play");
    expect(s.member?.name).toBe("Lars");
    s = stateOf(throwAll(g, 20, 19, MISS, MISS, MISS, MISS, MISS, MISS));
    expect(s.up).toBe("T1");
    expect(s.member?.name).toBe("Per");
  });
  it("sinks the numbers that are taken in the first part, and every number without a living owner in the second", () => {
    let g = throwAll(newGame(3, ["A", "B"]), 20);
    let sunk = sunkSections(stateOf(g), g);
    expect(sunk.has(20) && sunk.has(120) && sunk.has(220)).toBe(true);
    expect(sunk.has(19)).toBe(false);
    g = throwAll(g, 19);
    sunk = sunkSections(stateOf(g), g);
    expect(sunk.has(19)).toBe(false);
    expect(sunk.has(5)).toBe(true);
    expect(sunk.has(BULL)).toBe(true);
  });
});

describe("killer: winning the status back", () => {
  it("makes a killer who is hit and lives on a player who is not a killer any more", () => {
    // A is a killer. B needs three hits on 19 first, and then takes a life from A by hitting 20.
    let g = throwAll(started(), T(20), MISS, MISS, T(19), 20, MISS);
    let s = stateOf(g);
    expect(s.killer.B).toBe(true);
    expect(s.lives.A).toBe(2);
    expect(s.killer.A).toBe(false);
    expect(s.regain.A).toBe(true);
    g = throwAll(g, MISS);
    s = stateOf(g);
    expect(s.killer.A).toBe(false);
  });
  it("gives the lives back with hits on the own number, and the status when they are full again", () => {
    // A is hit twice (a double: two lives) by B the killer, and then wins them back with a treble.
    const g = throwAll(started(), T(20), MISS, MISS, T(19), D(20), MISS);
    let s = stateOf(g);
    expect(s.lives.A).toBe(1);
    expect(s.killer.A).toBe(false);
    // C throws, then A: a single gives one life back, and a double the last.
    const back = throwAll(g, MISS, MISS, MISS, 20);
    s = stateOf(back);
    expect(s.lives.A).toBe(2);
    expect(s.log.at(-1)!.effect).toBe("heal");
    expect(s.killer.A).toBe(false);
    const full = throwAll(back, 20);
    s = stateOf(full);
    expect(s.lives.A).toBe(3);
    expect(s.killer.A).toBe(true);
    expect(s.log.at(-1)!.effect).toBe("killer");
  });
  it("does not make a player who never was a killer one by healing", () => {
    // C is hit by A (a killer) with a single, then hits their own 18: the life is back, and no status.
    let g = throwAll(started(), T(20), 18, MISS);
    g = throwAll(g, MISS, MISS, MISS, 18);
    const s = stateOf(g);
    expect(s.lives.C).toBe(3);
    expect(s.killer.C).toBe(false);
    expect(s.hits.C).toBe(0);
  });
});
