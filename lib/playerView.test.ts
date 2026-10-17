import { describe, expect, it } from "vitest";
import { emptyRecord, emptyStepStats, type MatchHistoryEntry, type MemberStat } from "./playerRows";
import { bySource, singleView, teamView } from "./playerView";

const match = (i: number, won: boolean, hitPct: number, med: number | null = null, darts = 60): MatchHistoryEntry => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, won, dartsUsed: darts, hitPct, med, mhd: med, mvd: med, ...(med !== null ? { throws: darts } : {}) });
const rec = (name: string, h: MatchHistoryEntry[], over: object = {}) => ({ ...emptyRecord(name), matchesPlayed: h.length, matchesWon: h.filter((m) => m.won).length, matchHistory: h, ...over });
const member = (over: Partial<MemberStat> = {}): MemberStat => ({ matches: 2, turns: 20, darts: 60, hits: 30, misses: 30, steps: emptyStepStats(), bestRun: 6, throws: 0, sumR: 0, ...over });

describe("by hand, by Scolia, or both", () => {
  // Two matches by hand (no distances), two with Scolia.
  const history = [match(0, true, 40), match(1, false, 50), match(2, true, 60, 25), match(3, true, 70, 21)];

  it("splits the matches by whether the darts were measured", () => {
    expect(bySource(history, "manual").length).toBe(2);
    expect(bySource(history, "scolia").length).toBe(2);
    expect(bySource(history, "both").length).toBe(4);
  });

  it("gives each source its own counts, hit rate and distance", () => {
    const p = rec("Per", history);
    const manual = singleView(p, "manual");
    const scolia = singleView(p, "scolia");
    const both = singleView(p, "both");
    expect([manual.matches, manual.wins]).toEqual([2, 1]);
    expect(manual.hitPct).toBeCloseTo(45, 6);
    expect(manual.med).toBeNull(); // nothing is measured by hand
    expect([scolia.matches, scolia.wins]).toEqual([2, 2]);
    expect(scolia.hitPct).toBeCloseTo(65, 6);
    expect(scolia.med).toBeCloseTo(23, 6);
    expect([both.matches, both.wins]).toEqual([4, 3]);
    expect(both.hitPct).toBeCloseTo(55, 6);
  });

  it("shows what is only kept as totals for «Begge» only", () => {
    const steps = emptyStepStats();
    steps["20"] = { hits: 6, misses: 4 };
    const p = rec("Per", history, { steps, bestRun: 9 });
    expect(singleView(p, "both").bestRun).toBe(9);
    expect(singleView(p, "both").rows!.find((r) => r.step === "20")!.pct).toBe(60);
    expect(singleView(p, "scolia").bestRun).toBeNull();
    expect(singleView(p, "scolia").rows).toBeNull();
  });

  it("says how many older matches cannot be sorted, when a source is chosen", () => {
    const p = rec("Per", history, { matchesPlayed: 7 });
    expect(singleView(p, "scolia").unsorted).toBe(3);
    expect(singleView(p, "both").unsorted).toBe(0);
    expect(singleView(p, "both").matches).toBe(7);
  });

  it("keeps the last five results, oldest first", () => {
    const long = Array.from({ length: 7 }, (_, i) => match(i, i % 2 === 0, 50));
    expect(singleView(rec("Per", long), "both").results).toEqual([true, false, true, false, true]);
  });

  it("copes with a player with no matches", () => {
    const v = singleView(rec("Ny", []), "both");
    expect(v.matches).toBe(0);
    expect(v.winPct).toBeNull();
    expect(v.hitPct).toBeNull();
    expect(v.results).toEqual([]);
  });
});

describe("a person in a team", () => {
  const per = rec("Per", []);
  const ola = rec("Ola", []);
  const team = rec("Per & Ola", [match(0, true, 50, null), match(1, false, 40, 30)], { kind: "team", members: ["Per", "Ola"], memberStats: { Per: member({ hits: 36, misses: 24, throws: 20, sumR: 20 * 27, bestRun: 7 }), Ola: member() } });
  const other = rec("Per & Eva", [match(0, true, 45)], { kind: "team", members: ["Per", "Eva"] });
  const all = [per, ola, team, other];

  it("finds the teams the person is in, with the partners", () => {
    const v = teamView(per, all, "both");
    expect(v.teams.map((t) => t.name)).toEqual(["Per & Ola", "Per & Eva"]);
    expect(v.teams[0].partners).toEqual(["Ola"]);
    expect(v.matches).toBe(3);
    expect(v.wins).toBe(2);
    expect(teamView(rec("Ukjent", []), all, "both").teams).toEqual([]);
  });

  it("gives the person's own darts in team matches, and the distance Scolia measured", () => {
    const v = teamView(per, all, "both");
    expect(v.ownHitPct).toBeCloseTo(60, 6);
    expect(v.ownDarts).toBe(60);
    expect(v.med).toBeCloseTo(27, 6);
    expect(v.bestRun).toBe(7);
    expect(teamView(ola, all, "both").ownHitPct).toBeCloseTo(50, 6);
  });

  it("splits the team's matches by source, but not the person's own totals", () => {
    const manual = teamView(per, all, "manual");
    expect(manual.matches).toBe(2); // Per & Ola by hand, Per & Eva by hand
    expect(manual.med).toBeNull();
    expect(manual.ownHitPct).toBeNull();
    const scolia = teamView(per, all, "scolia");
    expect(scolia.matches).toBe(1);
    expect(scolia.teams.find((t) => t.name === "Per & Ola")!.matches).toBe(1);
    expect(scolia.med).toBeCloseTo(27, 6);
  });
});
