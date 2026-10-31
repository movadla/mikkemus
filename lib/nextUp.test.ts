import { describe, expect, it } from "vitest";
import * as countdown from "./countdown";
import * as halvit from "./halvit";
import * as highstriker from "./highstriker";
import * as killer from "./killer";
import * as lava from "./lava";
import { nextName } from "./teamGame";

const m = (name: string) => ({ name, isBot: false });
const rosters = { T1: [m("a"), m("b")], T2: [m("c"), m("d")] };

describe("neste kaster er den på det andre laget sin tur", () => {
  it("301/501: neste lag, og når turen kommer rundt, det medlemmet som står for tur", () => {
    let g = countdown.newGame(301, false, ["T1", "T2"], undefined, rosters);
    expect(countdown.memberUp(g)?.name).toBe("a");
    expect(countdown.nextUp(g)).toEqual({ side: "T2", member: m("c") });
    g = countdown.playRound(g, 60);
    expect(countdown.nextUp(g)).toEqual({ side: "T1", member: m("b") });
    g = countdown.playRound(g, 60);
    expect(countdown.nextUp(g)).toEqual({ side: "T2", member: m("d") });
  });

  it("en enkeltspiller etter et lag, og et lag etter en enkeltspiller", () => {
    const g = countdown.newGame(301, false, ["T1", "Solo"], undefined, { T1: rosters.T1 });
    expect(nextName(countdown.nextUp(g))).toBe("Solo");
    const h = countdown.playRound(g, 60);
    expect(nextName(countdown.nextUp(h))).toBe("b (T1)");
  });

  it("Highstriker hopper over de som er ute", () => {
    const g = highstriker.newGame(1, ["T1", "Solo", "T2"], rosters);
    expect(highstriker.nextUp(g)).toEqual({ side: "Solo", member: null });
  });

  it("Lava: etter tre piler er det andre laget, og neste av det laget er den som står for tur", () => {
    let g = lava.newGame(3, ["T1", "T2"], "numbers", rosters);
    expect(lava.stateOf(g).next).toEqual({ side: "T2", member: m("c") });
    for (const s of [1, 2, 3]) g = lava.playDart(g, s);
    const s = lava.stateOf(g);
    expect(s.up).toBe("T2");
    expect(s.member?.name).toBe("c");
    expect(s.next).toEqual({ side: "T1", member: m("b") });
  });

  it("Killer: første lag har neste lag først", () => {
    const g = killer.newGame(3, ["T1", "T2"], rosters);
    expect(killer.stateOf(g).next).toEqual({ side: "T2", member: m("c") });
  });

  it("Halv It: neste i runden, og i neste runde det medlemmet som står for tur", () => {
    let g = halvit.newGame(["T1", "T2"], rosters);
    expect(halvit.stateOf(g).next).toEqual({ side: "T2", member: m("c") });
    g = halvit.playEntry(g, { points: 20, bom: false });
    expect(halvit.stateOf(g).up).toBe("T2");
    expect(halvit.stateOf(g).next).toEqual({ side: "T1", member: m("b") });
  });
});
