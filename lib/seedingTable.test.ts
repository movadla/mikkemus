import { describe, expect, it } from "vitest";
import { buildSeedTable, entrantInputs, formOf } from "./seedingTable";
import { emptyRecord } from "./playerRows";

const RULES = { target: 3, ringChoice: true };
const match = (i: number, won: boolean, hitPct: number, darts = 60, med: number | null = null) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, won, dartsUsed: darts, hitPct, med, mhd: med, mvd: med, ...(med !== null ? { throws: darts } : {}) });
const rec = (name: string, matchHistory: ReturnType<typeof match>[] = [], over: object = {}) => ({ ...emptyRecord(name), matchesPlayed: matchHistory.length, matchesWon: matchHistory.filter((m) => m.won).length, matchHistory, ...over });

describe("form over the last matches", () => {
  it("counts the last five, oldest first, and how the darts go against the usual", () => {
    const history = [match(0, false, 40), match(1, false, 40), match(2, true, 40), match(3, true, 60), match(4, true, 60), match(5, true, 60), match(6, false, 60)];
    const f = formOf(rec("Per", history), 5);
    expect(f.n).toBe(5);
    expect(f.results).toEqual([true, true, true, true, false]);
    expect([f.wins, f.losses]).toEqual([4, 1]);
    expect(f.hit5).toBeCloseTo(56, 6); // 40, 60, 60, 60, 60
    expect(f.hitAll).toBeCloseTo((40 * 3 + 60 * 4) / 7, 6);
    expect(f.dHit!).toBeGreaterThan(0);
    expect(f.label).toBe("På gang");
  });

  it("is a weak form after losses and a falling hit rate", () => {
    const f = formOf(rec("Per", [match(0, true, 60), match(1, true, 60), match(2, false, 40), match(3, false, 35), match(4, false, 30), match(5, false, 30), match(6, false, 30)]));
    expect(f.label).toBe("Svak");
  });

  it("says too few matches under three, and nothing for no matches", () => {
    expect(formOf(rec("Per", [match(0, true, 50), match(1, false, 50)])).label).toBe("For få kamper");
    expect(formOf(rec("Per")).n).toBe(0);
    expect(formOf(rec("Per")).hit5).toBeNull();
  });
});

describe("the seeding table", () => {
  const regulars = ["Vadla", "Monge", "Moen", "Lars", "Hans", "Vegard", "Sondre"].map((n) => rec(n));

  it("starts as the group said when there is nothing else to go on", () => {
    const t = buildSeedTable(regulars, RULES);
    const names = t.map((r) => r.name);
    expect(names[0]).toBe("Vadla");
    expect(names.slice(1, 4).sort()).toEqual(["Lars", "Moen", "Monge"]); // the three the group put level
    expect(names.slice(4)).toEqual(["Hans", "Vegard", "Sondre"]);
    expect(t.map((r) => r.strength)).toEqual([...t.map((r) => r.strength)].sort((a, b) => b - a));
    // The three who are level have the same strength.
    expect(t[1].strength).toBeCloseTo(t[3].strength, 9);
    expect(t[0].strength).toBeGreaterThan(t[1].strength);
    expect(t.find((r) => r.name === "Vadla")!.move).toBe(0);
    expect(t.find((r) => r.name === "Sondre")!.move).toBe(0);
  });

  it("moves with what they have thrown: a regular who keeps hitting well climbs, one who does not drops", () => {
    // Sondre is seeded last, but he has hit very well over many matches; Vadla, seeded first, has hit poorly.
    const hot = Array.from({ length: 8 }, (_, i) => match(i, true, 80, 100));
    const cold = Array.from({ length: 8 }, (_, i) => match(i, false, 20, 100));
    const table = buildSeedTable(regulars.map((r) => (r.name === "Sondre" ? rec("Sondre", hot) : r.name === "Vadla" ? rec("Vadla", cold) : r)), RULES);
    const by = Object.fromEntries(table.map((r) => [r.name, r]));
    expect(by.Sondre.rank).toBeLessThan(by.Vadla.rank);
    expect(by.Sondre.move!).toBeGreaterThan(0);
    expect(by.Vadla.move!).toBeLessThan(0);
  });

  it("ranks someone outside the seeding by their own darts, with no seed place", () => {
    const table = buildSeedTable([...regulars, rec("Ny", Array.from({ length: 6 }, (_, i) => match(i, true, 75, 100)))], RULES);
    const ny = table.find((r) => r.name === "Ny")!;
    expect(ny.seedRank).toBeNull();
    expect(ny.move).toBeNull();
    expect(ny.strength).toBeGreaterThan(table.find((r) => r.name === "Hans")!.strength);
  });

  it("leaves teams out", () => {
    const table = buildSeedTable([...regulars, rec("Vadla & Monge", [], { kind: "team", members: ["Vadla", "Monge"] })], RULES);
    expect(table.some((r) => r.name === "Vadla & Monge")).toBe(false);
  });
});

describe("sides for a tournament", () => {
  const people = [rec("Vadla"), rec("Monge"), rec("Ukjent")];
  const team = rec("Vadla & Ukjent", [], { kind: "team", members: ["Vadla", "Ukjent"] });
  const ghost = rec("Vadla & Gjest", [], { kind: "team", members: ["Vadla", "Gjest"] });

  it("is one person each for players", () => {
    const e = entrantInputs([...people, team], RULES, "player");
    expect(e.map((x) => x.name)).toEqual(["Vadla", "Monge", "Ukjent"]);
    expect(e[0].sigmas.length).toBe(1);
    expect(e[0].sigmas[0].length).toBe(7);
  });

  it("is the members, each with their own skill, for a team", () => {
    const [t] = entrantInputs([...people, team], RULES, "team");
    expect(t.members).toEqual(["Vadla", "Ukjent"]);
    expect(t.sigmas.length).toBe(2);
    // Vadla is seeded sharper than someone nobody knows anything about.
    expect(t.sigmas[0][3]).toBeLessThan(t.sigmas[1][3]);
  });

  it("treats a member with no record as an unknown player of the group", () => {
    const [t] = entrantInputs([...people, ghost], RULES, "team");
    expect(t.sigmas.length).toBe(2);
    expect(t.sigmas[1].length).toBe(7);
  });
});
