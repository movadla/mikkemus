import { describe, expect, it } from "vitest";
import { medForSkill, strengthMap } from "./knockoutSeeding";

const RULES = { target: 3, ringChoice: true };

describe("bot strength on the seeding scale", () => {
  it("runs a skill between two levels between their distances", () => {
    expect(medForSkill(1)).toBe(20);
    expect(medForSkill(5)).toBe(49);
    expect(medForSkill(3.5)).toBeCloseTo(34.5, 5);
    expect(medForSkill(0)).toBe(20);
    // Level 6, the weakest, is there for Ly Pilotturnering; the other cups never go past 5.
    expect(medForSkill(6)).toBe(55);
    expect(medForSkill(9)).toBe(55);
    expect(medForSkill(5.5)).toBeCloseTo(52, 5);
  });

  it("puts a sharp bot above a weak one, and a team at the average of its members", () => {
    const m = strengthMap(
      [],
      [
        { name: "Skarp", isBot: true, botLevel: "1" },
        { name: "Svak", isBot: true, botLevel: "5" },
        { name: "Lag", isBot: false, members: [{ name: "A", isBot: true, botLevel: "1" }, { name: "B", isBot: true, botLevel: "5" }] },
        { name: "Ukjent", isBot: false },
      ],
      RULES,
    );
    expect(m.get("Skarp")!).toBeGreaterThan(m.get("Svak")!);
    expect(m.get("Lag")!).toBeCloseTo((m.get("Skarp")! + m.get("Svak")!) / 2, 6);
    expect(m.get("Ukjent")).toBe(0.5);
  });
});
