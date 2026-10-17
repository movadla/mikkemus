import { describe, expect, it } from "vitest";
import { knownSkill } from "./odds/skill";
import { entrantFromSigmas, randomSource, simulateTournament, threeMatchSchedule } from "./tournamentOdds";

const RULES = { target: 3, ringChoice: true };
const MED = Math.sqrt(2 / Math.PI);
// A person known to throw at this mean distance: the same spread in every scenario.
const person = (name: string, med: number) => entrantFromSigmas(name, [knownSkill(med * MED).map((n) => n.sigma)], RULES);
// A person who might be anything from sharp to poor.
const unsure = (name: string, lo: number, hi: number) => entrantFromSigmas(name, [Array.from({ length: 7 }, (_, i) => (lo + ((hi - lo) * i) / 6) * MED)], RULES);

describe("who plays whom", () => {
  const degrees = (edges: [number, number][], n: number) => {
    const d = new Array<number>(n).fill(0);
    edges.forEach(([a, b]) => {
      d[a]++;
      d[b]++;
    });
    return d;
  };
  const rng = randomSource(11);

  it("gives everyone exactly three matches with an even number of sides", () => {
    for (const n of [4, 6, 8, 10, 12]) {
      const edges = threeMatchSchedule(n, rng);
      expect(degrees(edges, n), `n=${n}`).toEqual(new Array(n).fill(3));
      expect(edges.length).toBe((3 * n) / 2);
      expect(edges.every(([a, b]) => a !== b)).toBe(true);
      // Nobody meets the same side twice.
      const seen = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
      expect(seen.size).toBe(edges.length);
    }
  });

  it("with an odd number, one side plays two and the rest three", () => {
    for (const n of [5, 7, 9]) {
      const d = degrees(threeMatchSchedule(n, rng), n);
      expect(d.filter((x) => x === 2).length, `n=${n}`).toBe(1);
      expect(d.filter((x) => x === 3).length).toBe(n - 1);
    }
  });

  it("is the same four-way round robin when there are four", () => {
    expect(threeMatchSchedule(4, rng).length).toBe(6);
  });
});

describe("tournament odds", () => {
  const field = [person("Sterk", 22), person("Jevn1", 32), person("Jevn2", 32), person("Svak", 48)];

  it("adds up to one, and the stronger side is the favourite", () => {
    const r = simulateTournament(field, { sims: 6000, rng: randomSource(3) });
    expect(r.reduce((s, x) => s + x.win, 0)).toBeCloseTo(1, 9);
    expect(r[0].name).toBe("Sterk");
    expect(r[r.length - 1].name).toBe("Svak");
    expect(r[0].odds).toBeLessThan(r[r.length - 1].odds);
    expect(r[0].meanWins).toBeGreaterThan(r[r.length - 1].meanWins);
  });

  it("gives equal sides about equal odds, with every play counted as three matches", () => {
    const even = [person("A", 30), person("B", 30), person("C", 30), person("D", 30), person("E", 30), person("F", 30)];
    const r = simulateTournament(even, { sims: 12000, rng: randomSource(5) });
    for (const x of r) {
      expect(x.win).toBeGreaterThan(1 / 6 - 0.03);
      expect(x.win).toBeLessThan(1 / 6 + 0.03);
      expect(x.matches).toBe(3);
      expect(x.meanWins).toBeCloseTo(1.5, 1);
    }
  });

  it("is the same every time for the same field and the same seed", () => {
    const a = simulateTournament(field, { sims: 2000, rng: randomSource(9) });
    const b = simulateTournament(field, { sims: 2000, rng: randomSource(9) });
    expect(a).toEqual(b);
  });

  it("gives an unsure player more of a chance than a known one at the same average", () => {
    const sure = [person("Sikker", 36), person("S1", 24), person("S2", 24), person("S3", 24)];
    const unknown = [unsure("Usikker", 22, 52), person("S1", 24), person("S2", 24), person("S3", 24)];
    const a = simulateTournament(sure, { sims: 12000, rng: randomSource(2) }).find((x) => x.name === "Sikker")!.win;
    const b = simulateTournament(unknown, { sims: 12000, rng: randomSource(2) }).find((x) => x.name === "Usikker")!.win;
    expect(b).toBeGreaterThan(a);
  });

  it("needs four sides", () => {
    expect(simulateTournament(field.slice(0, 3))).toEqual([]);
  });

  it("works for teams: two throwers a turn each", () => {
    const team = (name: string, a: number, b: number) => entrantFromSigmas(name, [knownSkill(a * MED).map((n) => n.sigma), knownSkill(b * MED).map((n) => n.sigma)], RULES);
    const r = simulateTournament([team("Gode", 22, 24), team("Blandet", 22, 50), team("Svake", 48, 50), team("Middels", 32, 34)], { sims: 6000, rng: randomSource(4) });
    expect(r[0].name).toBe("Gode");
    expect(r[r.length - 1].name).toBe("Svake");
  });
});
