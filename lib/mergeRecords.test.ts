import { describe, expect, it } from "vitest";
import { mergeRecords } from "./mergeRecords";
import { emptyRecord, recordToRow, rowToRecord, type PlayerRecord } from "./playerRows";
import { defaultKits } from "./teamKit";

function rec(name: string, over: Partial<PlayerRecord>): PlayerRecord {
  return { ...emptyRecord(name), ...over };
}

describe("mergeRecords", () => {
  it("sums every running total and takes the given name, kind and members", () => {
    const a = rec("E L", { matchesPlayed: 1, matchesWon: 0, overall: { hits: 28, misses: 56 }, steps: { ...emptyRecord("x").steps, "20": { hits: 10, misses: 20 } }, tripleHits: { "20": 2 } });
    const b = rec("H V", { matchesPlayed: 1, matchesWon: 1, dartsInWins: 85, bestDartsToFinish: 85, overall: { hits: 30, misses: 55 }, steps: { ...emptyRecord("x").steps, "20": { hits: 5, misses: 1 } }, tripleHits: { "20": 1, "19": 3 } });
    const m = mergeRecords([a, b], { name: "Vadla & Hans", kind: "team", members: ["Vadla", "Hans"] });
    expect(m).toMatchObject({ name: "Vadla & Hans", kind: "team", members: ["Vadla", "Hans"], matchesPlayed: 2, matchesWon: 1, dartsInWins: 85, bestDartsToFinish: 85 });
    expect(m.overall).toEqual({ hits: 58, misses: 111 });
    expect(m.steps["20"]).toEqual({ hits: 15, misses: 21 });
    expect(m.tripleHits).toEqual({ "20": 3, "19": 3 });
  });

  it("keeps the lower best finish, and the first photo and sound it finds", () => {
    const a = rec("A", { bestDartsToFinish: 90, photo: undefined, sound: "s1" });
    const b = rec("B", { bestDartsToFinish: 70, photo: "p2", sound: "s2" });
    const m = mergeRecords([a, b], { name: "AB", kind: "team", members: ["A", "B"] });
    expect(m.bestDartsToFinish).toBe(70);
    expect(m.photo).toBe("p2");
    expect(m.sound).toBe("s1");
    expect(mergeRecords([rec("A", {}), rec("B", { bestDartsToFinish: 5 })], { name: "x", kind: "player" }).bestDartsToFinish).toBe(5);
  });

  it("puts the two histories in date order", () => {
    const e = (date: string, won: boolean) => ({ date, won, dartsUsed: 30, hitPct: 50, med: null, mhd: null, mvd: null });
    const a = rec("A", { matchHistory: [e("2026-09-01", true), e("2026-10-01", false)] });
    const b = rec("B", { matchHistory: [e("2026-09-15", true)] });
    const m = mergeRecords([a, b], { name: "x", kind: "player" });
    expect(m.matchHistory.map((h) => h.date)).toEqual(["2026-09-01", "2026-09-15", "2026-10-01"]);
  });

  it("a single record just gets renamed and re-kinded; no records is an error", () => {
    const m = mergeRecords([rec("E L", { matchesPlayed: 1 })], { name: "Erik & Lars", kind: "team", members: ["Erik", "Lars"] });
    expect(m).toMatchObject({ name: "Erik & Lars", kind: "team", members: ["Erik", "Lars"], matchesPlayed: 1 });
    expect(() => mergeRecords([], { name: "x", kind: "player" })).toThrow();
  });

  it("does not change the records it was given", () => {
    const a = rec("A", { matchesPlayed: 1, tripleHits: { "20": 1 } });
    mergeRecords([a, rec("B", { matchesPlayed: 2, tripleHits: { "20": 1 } })], { name: "x", kind: "player" });
    expect(a.matchesPlayed).toBe(1);
    expect(a.tripleHits).toEqual({ "20": 1 });
  });
});

describe("row mapping and teams", () => {
  it("a row without the new columns is a player, and a player row never writes them", () => {
    const row = recordToRow("per", emptyRecord("Per"));
    expect("kind" in row).toBe(false);
    expect("members" in row).toBe(false);
    expect(rowToRecord(row).kind).toBe("player");
    expect(rowToRecord({ ...row, kind: null, members: null }).kind).toBe("player");
  });

  it("a team round-trips with its members", () => {
    const team = emptyRecord("Vadla & Hans", "team", ["Vadla", "Hans"]);
    const row = recordToRow("vadla & hans", team);
    expect(row.kind).toBe("team");
    expect(row.members).toEqual(["Vadla", "Hans"]);
    expect(rowToRecord(row)).toMatchObject({ kind: "team", members: ["Vadla", "Hans"], name: "Vadla & Hans" });
  });

  it("a team's shirts round-trip, and a team without any has none until it plays", () => {
    const kits = defaultKits(["Vadla", "Hans"]);
    const team = { ...emptyRecord("Vadla & Hans", "team", ["Vadla", "Hans"]), kits };
    const row = recordToRow("vadla & hans", team);
    expect(row.kits).toEqual(kits);
    expect(rowToRecord(row).kits).toEqual(kits);
    expect(rowToRecord({ ...row, kits: null }).kits).toBeUndefined();
    expect("kits" in recordToRow("per", emptyRecord("Per"))).toBe(false);
  });

  it("tolerates a row whose steps are missing a section", () => {
    const row = recordToRow("x", emptyRecord("x"));
    const partial = { ...row, steps: { "20": { hits: 1, misses: 2 } } as never };
    const r = rowToRecord(partial);
    expect(r.steps["20"]).toEqual({ hits: 1, misses: 2 });
    expect(r.steps.BULL).toEqual({ hits: 0, misses: 0 });
  });
});

describe("best run", () => {
  it("round-trips, is left out of the row until there is one, and merges as the longest", () => {
    const rec = { ...emptyRecord("Per"), bestRun: 9 };
    expect(recordToRow("per", rec).best_run).toBe(9);
    expect(rowToRecord(recordToRow("per", rec)).bestRun).toBe(9);
    expect("best_run" in recordToRow("ola", emptyRecord("Ola"))).toBe(false);
    expect(mergeRecords([rec, { ...emptyRecord("B"), bestRun: 12 }], { name: "x", kind: "player" }).bestRun).toBe(12);
    expect(mergeRecords([emptyRecord("A")], { name: "x", kind: "player" }).bestRun).toBeUndefined();
  });
});

describe("team names", () => {
  it("cleanTeamName trims and keeps a name that is not the players' names", async () => {
    const { cleanTeamName, defaultTeamName } = await import("./teamNames");
    expect(cleanTeamName("  De   Røde  ")).toBe("De Røde");
    expect(defaultTeamName(["Vadla", "Hans"])).toBe("Vadla & Hans");
    expect(cleanTeamName("De Røde")).not.toBe(defaultTeamName(["Vadla", "Hans"]));
  });
});
