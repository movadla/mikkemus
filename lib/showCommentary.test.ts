import { describe, expect, it } from "vitest";
import { commentate, crowdOf, subjectOf } from "./showCommentary";
import { emitShow, onShow, type ShowEvent } from "./showBus";

const ctx = { me: "Mikke", opponent: "Gjert" };

describe("commentate", () => {
  it("gives Kåre the first line and Tove the second", () => {
    const l = commentate({ kind: "180", player: "Mikke" }, ctx, () => 0);
    expect(l[0].who).toBe("Kåre");
    expect(l[1].who).toBe("Tove");
    expect(l[0].text).toContain("Mikke");
  });
  it("is deterministic for a given random", () => {
    const e: ShowEvent = { kind: "bust", player: "Gjert" };
    expect(commentate(e, ctx, () => 0.7)).toEqual(commentate(e, ctx, () => 0.7));
  });
  it("picks different variants", () => {
    const e: ShowEvent = { kind: "bust", player: "Mikke" };
    expect(commentate(e, ctx, () => 0)[0].text).not.toBe(commentate(e, ctx, () => 0.99)[0].text);
  });
  it("counts 180s only from what it was told", () => {
    const l = commentate({ kind: "180", player: "Mikke" }, { ...ctx, count180: { Mikke: 2 } }, () => 0.99);
    expect(l[1].text).toContain("2");
  });
  it("never returns more than two lines or an empty text, for every kind", () => {
    const events: ShowEvent[] = [
      { kind: "180", player: "A" }, { kind: "ton", player: "A", points: 140 }, { kind: "bust", player: "A" },
      { kind: "checkout", player: "A", points: 80 }, { kind: "leg", winner: "A" }, { kind: "match", winner: "A" },
      { kind: "triple", player: "A", number: 17 }, { kind: "bull", player: "A" }, { kind: "closed", player: "A", number: 20 }, { kind: "comeback", player: "A" },
    ];
    for (const e of events) for (const r of [0, 0.5, 0.99]) {
      const l = commentate(e, { me: "A" }, () => r);
      expect(l.length).toBeGreaterThan(0);
      expect(l.length).toBeLessThanOrEqual(2);
      l.forEach((x) => expect(x.text.length).toBeGreaterThan(0));
    }
  });
  it("remarks on a win over the rival", () => {
    const l = commentate({ kind: "match", winner: "Mikke", loser: "Gjert" }, { ...ctx, rival: "Gjert" }, () => 0);
    expect(l[1].text).toContain("Gjert");
  });
});

describe("crowdOf and subjectOf", () => {
  it("cheers for big things and groans for a bust", () => {
    expect(crowdOf({ kind: "180", player: "A" })).toBe("cheer");
    expect(crowdOf({ kind: "bust", player: "A" })).toBe("uff");
    expect(crowdOf({ kind: "bull", player: "A" })).toBeNull();
  });
  it("finds the subject", () => {
    expect(subjectOf({ kind: "match", winner: "W", loser: "L" })).toBe("W");
  });
});

describe("showBus", () => {
  it("delivers to listeners, stops after unsubscribe, survives a broken one", () => {
    const got: string[] = [];
    const off1 = onShow(() => { throw new Error("x"); });
    const off2 = onShow((e) => got.push(e.kind));
    emitShow({ kind: "bull", player: "A" });
    off1();
    off2();
    emitShow({ kind: "bull", player: "A" });
    expect(got).toEqual(["bull"]);
  });
});
