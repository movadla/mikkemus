import { describe, expect, it } from "vitest";
import { TEAM_NAME_MAX, cleanTeamName, defaultTeamName, pairKey, resolveTeams, resolvedTeamName, teamNameProblems } from "./teamNames";

const none = () => null;

describe("team names", () => {
  it("cleans whitespace and length", () => {
    expect(cleanTeamName("  Rakettene   fra  Oslo ")).toBe("Rakettene fra Oslo");
    expect(cleanTeamName("   ")).toBe("");
    expect(cleanTeamName("x".repeat(60))).toHaveLength(TEAM_NAME_MAX);
    expect(cleanTeamName("ab" + " ".repeat(40) + "cd")).toBe("ab cd");
  });

  it("names a team after its members until told otherwise", () => {
    expect(defaultTeamName([])).toBe("");
    expect(defaultTeamName(["Kari"])).toBe("Kari");
    expect(defaultTeamName(["Per", "Ola"])).toBe("Per & Ola");
    expect(defaultTeamName(["Per", "Ola", "Kari"])).toBe("Per, Ola & Kari");
    expect(defaultTeamName([" Per ", "", "Ola"])).toBe("Per & Ola");
  });

  it("knows a pair whatever the order or case", () => {
    expect(pairKey(["Per", "Ola"])).toBe(pairKey(["ola", "PER"]));
    expect(pairKey(["Per"])).not.toBe(pairKey(["Per", "Ola"]));
    expect(pairKey([])).toBe("");
  });

  it("a typed name wins; otherwise the remembered one; otherwise the members; otherwise the placeholder", () => {
    expect(resolvedTeamName({ name: " Rakettene ", members: ["Per", "Ola"], custom: true }, none)).toBe("Rakettene");
    expect(resolvedTeamName({ name: "Lag 1", members: ["Per", "Ola"] }, () => "De Gule")).toBe("De Gule");
    expect(resolvedTeamName({ name: "Lag 1", members: ["Per", "Ola"] }, none)).toBe("Per & Ola");
    expect(resolvedTeamName({ name: "Lag 1", members: [] }, none)).toBe("Lag 1");
  });

  it("a non-custom team follows its members when the line-up changes", () => {
    const before = resolveTeams([{ name: "Lag 1", members: ["Per", "Ola"] }], none)[0];
    expect(before.name).toBe("Per & Ola");
    const after = resolveTeams([{ name: "Lag 1", members: ["Per"] }], none)[0];
    expect(after.name).toBe("Per");
  });

  it("flags an empty name and a duplicate, and nothing else", () => {
    const fine = teamNameProblems(
      [
        { name: "A", members: ["Per"], custom: true },
        { name: "B", members: ["Ola"], custom: true },
      ],
      none,
    );
    expect(fine).toEqual([null, null]);

    const duplicate = teamNameProblems(
      [
        { name: "Rakettene", members: ["Per"], custom: true },
        { name: "rakettene ", members: ["Ola"], custom: true },
        { name: "Andre", members: ["Kari"], custom: true },
      ],
      none,
    );
    expect(duplicate).toEqual(["Et annet lag heter det samme", "Et annet lag heter det samme", null]);

    const empty = teamNameProblems([{ name: "   ", members: ["Per"], custom: true }], none);
    expect(empty).toEqual(["Laget trenger et navn"]);
  });

  it("two default-named teams never collide, because their members are different people", () => {
    expect(
      teamNameProblems(
        [
          { name: "Lag 1", members: ["Per", "Ola"] },
          { name: "Lag 2", members: ["Kari", "Nils"] },
        ],
        none,
      ),
    ).toEqual([null, null]);
  });

  it("two empty teams collide on their placeholders until someone is put in them", () => {
    expect(
      teamNameProblems(
        [
          { name: "Lag 1", members: [] },
          { name: "Lag 1", members: [] },
        ],
        none,
      ),
    ).toEqual(["Et annet lag heter det samme", "Et annet lag heter det samme"]);
  });
});
