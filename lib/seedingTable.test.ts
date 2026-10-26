import { describe, expect, it } from "vitest";
import { buildSeedTable, entrantInputs, formOf } from "./seedingTable";
import { emptyRecord } from "./playerRows";

const RULES = { target: 3, ringChoice: true };
const match = (i: number, won: boolean, hitPct: number, darts = 60, med: number | null = null) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, won, dartsUsed: darts, hitPct, med, mhd: med, mvd: med, ...(med !== null ? { throws: darts } : {}) });
const rec = (name: string, matchHistory: ReturnType<typeof match>[] = [], over: object = {}) => ({ ...emptyRecord(name), matchesPlayed: matchHistory.length, matchesWon: matchHistory.filter((m) => m.won).length, matchHistory, ...over });

describe("form over the last matches", () => {
  it("counts the last five, oldest first, and how the darts go against the usual", () => {
    const history = [match(0, false, 40), match(1, false, 40), match(2, true, 40), match(3, true, 60), match(4, true, 60), match(5, true, 60), match(6, false, 60)];
    const f = formOf(rec("Per", history), 4);
    expect(f.n).toBe(4);
    expect(f.results).toEqual([true, true, true, false]);
    expect([f.wins, f.losses]).toEqual([3, 1]);
    expect(f.hit5).toBeCloseTo(60, 6); // the last four: 60, 60, 60, 60
    expect(f.hitAll).toBeCloseTo(40, 6); // the three before them
    expect(f.dHit!).toBeCloseTo(20, 6);
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

  it("starts level when there is nothing to go on, whatever the group has said", () => {
    const t = buildSeedTable(regulars, RULES);
    expect(new Set(t.map((r) => r.strength.toFixed(9))).size).toBe(1);
    expect(t[0].strength).toBeCloseTo(0.5, 6);
    // The group's seeding is still shown next to the place.
    expect(t.find((r) => r.name === "Vadla")!.seedRank).toBe(1);
    expect(t.find((r) => r.name === "Sondre")!.seedRank).toBe(7);
  });

  it("moves with what they have thrown: a regular who keeps hitting well climbs, one who does not drops", () => {
    // Sondre is seeded last, but he has hit very well over many matches; Vadla, seeded first, has hit poorly.
    const hot = Array.from({ length: 12 }, (_, i) => match(i, true, 80, 100));
    const cold = Array.from({ length: 12 }, (_, i) => match(i, false, 20, 100));
    const table = buildSeedTable(regulars.map((r) => (r.name === "Sondre" ? rec("Sondre", hot) : r.name === "Vadla" ? rec("Vadla", cold) : r)), RULES);
    const by = Object.fromEntries(table.map((r) => [r.name, r]));
    expect(by.Sondre.rank).toBeLessThan(by.Vadla.rank);
    expect(by.Sondre.move!).toBeGreaterThan(0);
    expect(by.Vadla.move!).toBeLessThan(0);
  });

  it("does not let one very good round put someone on top: few matches pull towards a typical player", () => {
    const steady = Array.from({ length: 12 }, (_, i) => match(i, i % 3 !== 0, 55, 100));
    const oneBig = [match(0, true, 95, 100)];
    const table = buildSeedTable(regulars.map((r) => (r.name === "Hans" ? rec("Hans", steady) : r.name === "Moen" ? rec("Moen", oneBig) : r)), RULES);
    const by = Object.fromEntries(table.map((r) => [r.name, r]));
    expect(by.Hans.rank).toBeLessThan(by.Moen.rank);
    expect(by.Moen.strength).toBeLessThan(0.6);
  });

  it("counts team matches among the matches behind a strength", () => {
    const history = Array.from({ length: 5 }, (_, i) => match(i, true, 85, 100));
    const alone = buildSeedTable(regulars.map((r) => (r.name === "Moen" ? rec("Moen", history) : r)), RULES).find((r) => r.name === "Moen")!;
    const team = rec("Moen & Lars", Array.from({ length: 5 }, (_, i) => match(i, true, 85, 100)), { kind: "team", members: ["Moen", "Lars"] });
    const withTeam = buildSeedTable([...regulars.map((r) => (r.name === "Moen" ? rec("Moen", history) : r)), team], RULES).find((r) => r.name === "Moen")!;
    expect(withTeam.strength).toBeGreaterThan(alone.strength);
  });

  it("ranks someone outside the seeding by their own darts, with no seed place", () => {
    const table = buildSeedTable([...regulars, rec("Ny", Array.from({ length: 6 }, (_, i) => match(i, true, 75, 100)))], RULES);
    const ny = table.find((r) => r.name === "Ny")!;
    expect(ny.seedRank).toBeNull();
    expect(ny.move).toBeNull();
    expect(ny.strength).toBeGreaterThan(table.find((r) => r.name === "Hans")!.strength);
  });

  it("puts those without matches last until they have played", () => {
    const played = [match(0, false, 30, 100), match(1, false, 30, 100)];
    // Sondre has played two lost matches, the others none: they still stand above no one who has played.
    const table = buildSeedTable(regulars.map((r) => (r.name === "Sondre" ? rec("Sondre", played) : r)), RULES);
    const names = table.map((r) => r.name);
    expect(names[0]).toBe("Sondre");
    expect(table.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
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
    // With nothing on record, a regular is as good as someone nobody knows anything about.
    expect(t.sigmas[0][3]).toBeCloseTo(t.sigmas[1][3], 9);
  });

  it("treats a member with no record as an unknown player of the group", () => {
    const [t] = entrantInputs([...people, ghost], RULES, "team");
    expect(t.sigmas.length).toBe(2);
    expect(t.sigmas[1].length).toBe(7);
  });
});
