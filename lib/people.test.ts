import { describe, expect, it } from "vitest";
import { makeTeam, nextBotName, savedPeople, sharesMember, splitPeople, type Person } from "./people";

const p = (name: string, over: Partial<Person> = {}): Person => ({ name, isBot: false, ...over });

describe("splitPeople", () => {
  it("hands the game names, bot levels and guest flags", () => {
    const out = splitPeople([p("Per"), p("Littler 🥇", { isBot: true, botLevel: "1" }), p("Ola", { isGuest: true })]);
    expect(out.players).toEqual(["Per", "Littler 🥇", "Ola"]);
    expect(out.botLevels).toEqual({ "Littler 🥇": "1" });
    expect(out.guestPlayers).toEqual({ Ola: true });
  });

  it("savedPeople is the ones with a record", () => {
    expect(savedPeople([p("Per"), p("Bot", { isBot: true }), p("Ola", { isGuest: true })])).toEqual(["Per"]);
  });
});

describe("nextBotName", () => {
  it("numbers a second bot of the same level, whatever the case of the names", () => {
    expect(nextBotName("1", [])).toBe("Littler");
    expect(nextBotName("1", ["littler"])).toBe("Littler (2)");
    expect(nextBotName("1", ["Littler", "Littler (2)"])).toBe("Littler (3)");
  });
});

describe("teams", () => {
  it("a team is named after its members unless given a name", () => {
    expect(makeTeam([p("Per"), p("Ola")])).toEqual({ name: "Per & Ola", members: [p("Per"), p("Ola")] });
    expect(makeTeam([p("Per"), p("Ola")], "  Rakettene ")).toMatchObject({ name: "Rakettene", custom: true });
    expect(makeTeam([p("Per"), p("Ola")], "   ").custom).toBeUndefined();
  });

  it("sharesMember ignores case", () => {
    expect(sharesMember(["Per", "Ola"], ["ola", "Kari"])).toBe(true);
    expect(sharesMember(["Per"], ["Kari"])).toBe(false);
  });
});
