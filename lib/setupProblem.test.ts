import { describe, expect, it } from "vitest";
import type { PickedTeam } from "./people";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "./setupProblem";

const team = (name: string, members: string[], over: Partial<PickedTeam> = {}): PickedTeam => ({
  name,
  members: members.map((m) => ({ name: m, isBot: false })),
  custom: true,
  ...over,
});

describe("teamSetupProblem — one reason at a time, in the order a person would fix them", () => {
  it("is null when everything is in place", () => {
    expect(teamSetupProblem([team("A", ["Per", "Ola"]), team("B", ["Kari", "Nils"])], true)).toBeNull();
  });

  it("asks for teams until there are enough", () => {
    expect(teamSetupProblem([], true)).toBe("Velg 2 lag");
    expect(teamSetupProblem([team("A", ["Per", "Ola"])], true)).toBe("Velg 1 lag til");
    expect(teamSetupProblem([team("A", ["Per", "Ola"])], true, 3)).toBe("Velg 2 lag til");
  });

  it("bots first, when the game has no bots", () => {
    const bot = team("A", ["Per"], { members: [{ name: "Littler 🥇", isBot: true, botLevel: "1" }, { name: "Per", isBot: false }] });
    expect(teamSetupProblem([bot], false)).toBe("Fjern botene, eller velg 1–3 kryss");
    expect(teamSetupProblem([bot], true)).toBe("Velg 1 lag til");
  });

  it("reports a duplicate name last", () => {
    expect(teamSetupProblem([team("X", ["Per"]), team("x", ["Ola"])], true)).toBe("Et annet lag heter det samme");
  });
});

describe("individualSetupProblem", () => {
  it("needs at least one player, and three for a tournament", () => {
    expect(individualSetupProblem([], false)).toBe("Velg spillere");
    expect(individualSetupProblem(["Per"], false)).toBeNull();
    expect(individualSetupProblem(["Per"], false, 3)).toBe("Velg 2 til");
    expect(individualSetupProblem(["Per", "Ola", "Kari"], false, 3)).toBeNull();
    expect(individualSetupProblem(["Per"], true)).toBe("Fjern botene, eller velg 1–3 kryss");
  });
});

describe("setupSummary", () => {
  it("joins what is there with a middle dot and skips what is not", () => {
    expect(setupSummary(["3 spillere", null, "3 kryss", undefined])).toBe("3 spillere · 3 kryss");
    expect(setupSummary([])).toBe("");
  });
});
