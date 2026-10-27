import { describe, expect, it } from "vitest";
import { aimForLabel, botCountdownRound, botHighstrikerRound, botLavaDart, chooseCountdownAim, chooseLavaAim, dartOfSector, lowAim, throwAt, type Thrower } from "./botDarts";
import { sectorAt } from "./dartboard";
import { BULL, MISS, SECTIONS } from "./lava";

/** A bot that never misses its aim: the dart lands where it was aimed. */
const perfect: Thrower = (aim) => dartOfSector(sectorAt(aim));
/** A bot that always lands the same dart. */
const always = (sector: string): Thrower => () => dartOfSector(sector);

describe("dartOfSector", () => {
  it("reads what a dart is worth", () => {
    expect(dartOfSector("T20")).toMatchObject({ value: 60, double: false, section: 20, label: "T20" });
    expect(dartOfSector("D16")).toMatchObject({ value: 32, double: true, section: 16 });
    expect(dartOfSector("S5")).toMatchObject({ value: 5, label: "5" });
    expect(dartOfSector("Bull")).toMatchObject({ value: 50, double: true, section: BULL });
    expect(dartOfSector("25")).toMatchObject({ value: 25, double: false, section: BULL });
    expect(dartOfSector("None")).toMatchObject({ value: 0, section: MISS, label: "BOM" });
  });
});

describe("aimForLabel", () => {
  it("aims where the line says", () => {
    for (const label of ["T20", "D16", "20", "5", "25", "Bull", "T19", "D1"]) {
      const sector = sectorAt(aimForLabel(label));
      expect(dartOfSector(sector).label).toBe(label === "Bull" ? "BULL" : label);
    }
  });
});

describe("chooseCountdownAim", () => {
  it("goes for the treble 20 far from out", () => {
    expect(chooseCountdownAim(501, true, 3)).toBe("T20");
    expect(chooseCountdownAim(301, false, 3)).toBe("T20");
  });
  it("goes for the way out when there is one in the darts left", () => {
    expect(chooseCountdownAim(40, true, 3)).toBe("D20");
    expect(chooseCountdownAim(170, true, 3)).toBe("T20");
    expect(chooseCountdownAim(50, true, 1)).toBe("Bull");
  });
  it("leaves a finishable number when the way out is longer than the darts left", () => {
    for (const left of [81, 77, 59, 45, 23, 7, 3]) {
      const label = chooseCountdownAim(left, true, 1);
      const value = dartOfSector(label === "25" ? "25" : /^T/.test(label) ? label : `S${label}`).value;
      expect(left - value).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("botCountdownRound", () => {
  it("makes 180 from far out when it never misses", () => {
    const r = botCountdownRound(501, true, "1", perfect);
    expect(r).toMatchObject({ scored: 180, darts: 3, bust: false, finished: false });
    expect(r.labels).toEqual(["T20", "T20", "T20"]);
  });
  it("finishes, and says how many darts it took", () => {
    expect(botCountdownRound(40, true, "1", perfect)).toMatchObject({ scored: 40, darts: 1, finished: true });
    const two = botCountdownRound(81, true, "1", perfect);
    expect(two).toMatchObject({ scored: 81, finished: true });
    expect(two.darts).toBeLessThanOrEqual(3);
  });
  it("goes over the line: the round counts for nothing", () => {
    const r = botCountdownRound(50, true, "1", always("T20"));
    expect(r.bust).toBe(true);
    expect(r.scored).toBeGreaterThan(50);
    expect(r.darts).toBe(3);
  });
  it("does not finish on a single when the finish has to be a double", () => {
    // 20 left with a double out: the single 20 takes it to nothing but does not finish.
    const r = botCountdownRound(20, true, "1", always("S20"));
    expect(r.bust).toBe(true);
    expect(r.finished).toBe(false);
    // Without a double out the same dart finishes.
    expect(botCountdownRound(20, false, "1", always("S20"))).toMatchObject({ finished: true, scored: 20, darts: 1 });
  });
  it("never leaves a legal round that goes below the line in the real throws", () => {
    for (let i = 0; i < 300; i++) {
      const left = 2 + Math.floor(Math.random() * 170);
      const r = botCountdownRound(left, true, "3");
      expect(r.darts).toBeGreaterThanOrEqual(1);
      expect(r.darts).toBeLessThanOrEqual(3);
      if (!r.bust) expect(left - r.scored).toBeGreaterThanOrEqual(0);
      if (r.finished) expect(r.scored).toBe(left);
    }
  });
});

describe("botHighstrikerRound", () => {
  it("throws for the treble 20 when there is nothing to beat", () => {
    expect(botHighstrikerRound(null, "1", perfect)).toEqual({ scored: 180, labels: ["T20", "T20", "T20"] });
  });
  it("beats the round, and then throws for as little as it can", () => {
    const r = botHighstrikerRound(100, "1", perfect);
    expect(r.scored).toBeGreaterThanOrEqual(100);
    expect(r.labels.slice(0, 2)).toEqual(["T20", "T20"]);
    expect(r.scored).toBeLessThan(180);
  });
  it("makes up a small gap with a single 20", () => {
    const r = botHighstrikerRound(15, "1", perfect);
    expect(r.labels[0]).toBe("20");
  });
  it("aims low at a number whose neighbours are low too", () => {
    const aim = lowAim("3");
    expect(dartOfSector(sectorAt(aim)).value).toBeLessThanOrEqual(5);
  });
});

describe("Lava", () => {
  it("aims where a dart can land only on what is safe", () => {
    // Only 17, 3 and 19 are not burning: they sit together on the board.
    const safe = new Set([17, 3, 19]);
    const burned = new Set(SECTIONS.filter((s) => !safe.has(s)));
    for (const level of ["1", "3", "5"] as const) {
      const aim = chooseLavaAim(burned, level);
      expect(safe.has(dartOfSector(sectorAt(aim)).section)).toBe(true);
    }
  });
  it("throws a dart that is a section or a miss", () => {
    const burned = new Set([20, 1, 18]);
    for (let i = 0; i < 100; i++) {
      const d = botLavaDart(burned, "4");
      expect(d.section === MISS || d.section === BULL || (d.section >= 1 && d.section <= 20)).toBe(true);
    }
  });
  it("a bot that never misses never lands in lava while a safe section is left", () => {
    const burned = new Set([20, 1, 18, 4, 13, 6, 10, 15]);
    const d = botLavaDart(burned, "1", perfect);
    expect(burned.has(d.section)).toBe(false);
  });
});

describe("throwAt", () => {
  it("lands near the aim: a precise bot hits the treble 20 most of the time", () => {
    let hits = 0;
    for (let i = 0; i < 400; i++) if (throwAt(aimForLabel("T20"), "1").label === "T20") hits++;
    expect(hits).toBeGreaterThan(40);
  });
});
