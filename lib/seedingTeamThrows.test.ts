import { describe, expect, it } from "vitest";
import { evidenceFor } from "./odds/match";
import type { RuleSet } from "./odds/model";
import { buildSeedTable } from "./seedingTable";
import { emptyRecord, emptyStepStats, type MemberStat, type PlayerRecord } from "./playerRows";

const rules: RuleSet = { target: 3, ringChoice: true };
const member = (over: Partial<MemberStat>): MemberStat => ({ matches: 4, turns: 40, darts: 120, hits: 60, misses: 60, steps: emptyStepStats(), bestRun: 6, throws: 0, sumR: 0, ...over });
const team = (name: string, members: string[], memberStats: Record<string, MemberStat>): PlayerRecord => ({ ...emptyRecord(name), kind: "team", members, memberStats, matchesPlayed: 4 });

describe("seedingen teller kast i lag", () => {
  it("en som bare har spilt på lag har likevel tall å gå på, fra kastene sine i lagkampene", () => {
    const records = [emptyRecord("Erlend"), emptyRecord("Vadla"), team("Vadla/Erlend", ["Vadla", "Erlend"], { Erlend: member({}) })];
    expect(evidenceFor("Erlend", records, rules)).not.toBeNull();
    // Vadla threw nothing of his own in the team, so there is nothing to go on.
    expect(evidenceFor("Vadla", records, rules)).toBeNull();
  });

  it("de som treffer oftere i lag kommer høyere i tabellen enn de som treffer sjeldnere", () => {
    const records = [
      emptyRecord("Bra"),
      emptyRecord("Svak"),
      team("Bra/Svak", ["Bra", "Svak"], { Bra: member({ hits: 100, misses: 20 }), Svak: member({ hits: 20, misses: 100 }) }),
    ];
    const table = buildSeedTable(records, rules);
    const strength = (n: string) => table.find((r) => r.name === n)!.strength;
    expect(strength("Bra")).toBeGreaterThan(strength("Svak"));
  });

  it("målte kast i lagkamper teller med avstanden til den som kastet", () => {
    const t = { ...team("A/B", ["A", "B"], {}), matchHistory: [{ date: "2026-10-30", won: true, dartsUsed: 60, hitPct: 50, med: 30, mhd: 30, mvd: 30, byMember: { A: { throws: 30, sumR: 600, sumR2: 14000 }, B: { throws: 30, sumR: 1500, sumR2: 80000 } } }] };
    const records = [emptyRecord("A"), emptyRecord("B"), t as PlayerRecord];
    const a = evidenceFor("A", records, rules)!;
    const b = evidenceFor("B", records, rules)!;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
});
