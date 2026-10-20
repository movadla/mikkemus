import { describe, expect, it } from "vitest";
import { mergeTeamCards, withTeamRecords, type TeamCard } from "./teamCards";

describe("withTeamRecords", () => {
  it("adds the teams with a record after the cards this device has used", () => {
    const cards: TeamCard[] = [{ name: "Rakettene", members: ["Per", "Ola"], lastUsed: 5 }];
    const all = withTeamRecords(cards, [{ name: "Vadla & Hans", members: ["Vadla", "Hans"] }, { name: "Erik & Lars", members: ["Erik", "Lars"] }]);
    expect(all.map((c) => c.name)).toEqual(["Rakettene", "Erik & Lars", "Vadla & Hans"]);
    expect(all[2]).toEqual({ name: "Vadla & Hans", members: ["Vadla", "Hans"], lastUsed: 0 });
  });

  it("the record's name wins over the card's for the same people, and the card keeps its place", () => {
    const cards: TeamCard[] = [{ name: "Rakettene", members: ["Per", "Ola"], lastUsed: 5 }];
    const all = withTeamRecords(cards, [{ name: "Per & Ola", members: ["ola", "per"] }]);
    expect(all).toEqual([{ name: "Per & Ola", members: ["Per", "Ola"], lastUsed: 5 }]);
  });

  it("a record with no members is not a card", () => {
    expect(withTeamRecords([], [{ name: "Alene" }, { name: "Tom", members: [] }])).toEqual([]);
  });
});

describe("mergeTeamCards", () => {
  it("adds a team as a card and keeps the most recent first", () => {
    const cards = mergeTeamCards([], [{ name: "Rakettene", members: ["Per", "Ola"], custom: true }], 100);
    expect(cards).toEqual([{ name: "Rakettene", members: ["Per", "Ola"], lastUsed: 100 }]);
    const more = mergeTeamCards(cards, [{ name: "Kari & Nils", members: ["Kari", "Nils"] }], 200);
    expect(more.map((c) => c.name)).toEqual(["Kari & Nils", "Rakettene"]);
  });

  it("a team that changes its name replaces its old card instead of leaving a second one", () => {
    const first = mergeTeamCards([], [{ name: "Rakettene", members: ["Per", "Ola"] }], 1);
    const renamed = mergeTeamCards(first, [{ name: "De Gule", members: ["ola", "PER"] }], 2);
    expect(renamed).toHaveLength(1);
    expect(renamed[0].name).toBe("De Gule");
  });

  it("skips a team with nobody in it or no name, and caps the list", () => {
    expect(mergeTeamCards([], [{ name: "Tom", members: [] }, { name: "   ", members: ["A"] }], 1)).toEqual([]);
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `Lag${i}`, members: [`P${i}`] }));
    expect(mergeTeamCards([], many, 1).length).toBeLessThanOrEqual(40);
  });
});

describe("teams with bots", () => {
  it("keeps which members are bots, and at what level", () => {
    const cards = mergeTeamCards([], [{ name: "Gutta og Dave", members: ["Per", "Dave 🥉"], custom: true, bots: { "Dave 🥉": "3" } }], 1);
    expect(cards[0].bots).toEqual({ "Dave 🥉": "3" });
  });
  it("a record with the same people does not lose the bots of the card", () => {
    const cards: TeamCard[] = [{ name: "Gutta og Dave", members: ["Per", "Dave 🥉"], lastUsed: 5, bots: { "Dave 🥉": "3" } }];
    expect(withTeamRecords(cards, [{ name: "Gutta og Dave", members: ["Per", "Dave 🥉"] }])[0].bots).toEqual({ "Dave 🥉": "3" });
  });
});
