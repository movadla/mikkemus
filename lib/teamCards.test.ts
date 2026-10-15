import { describe, expect, it } from "vitest";
import { applyTeamCard, mergeTeamCards, type TeamCard } from "./teamCards";

const person = (name: string) => ({ name, isBot: false });

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

describe("applyTeamCard", () => {
  const card: TeamCard = { name: "Rakettene", members: ["Per", "Ola"], lastUsed: 1 };
  const empty = () => [{ name: "Lag 1", members: [] as string[] }, { name: "Lag 2", members: [] as string[] }];

  it("adds the people who are not in the pool and fills the first empty team", () => {
    const { people, teams } = applyTeamCard(card, [], empty(), person);
    expect(people.map((p) => p.name)).toEqual(["Per", "Ola"]);
    expect(teams[0]).toEqual({ name: "Rakettene", members: ["Per", "Ola"], custom: true });
    expect(teams[1].members).toEqual([]);
  });

  it("does not add anybody twice, and uses the spelling already in the pool", () => {
    const { people, teams } = applyTeamCard(card, [person("PER")], empty(), person);
    expect(people.map((p) => p.name)).toEqual(["PER", "Ola"]);
    expect(teams[0].members).toEqual(["PER", "Ola"]);
  });

  it("takes the card's people off any team they were already on, so nobody is in two", () => {
    const teams = [{ name: "Lag 1", members: ["Per", "Kari"] }, { name: "Lag 2", members: [] as string[] }];
    const out = applyTeamCard(card, [person("Per"), person("Kari")], teams, person);
    expect(out.teams[0].members).toEqual(["Kari"]);
    expect(out.teams[1].members).toEqual(["Per", "Ola"]);
  });

  it("opens a new team when every slot is taken", () => {
    const teams = [{ name: "A", members: ["X"] }, { name: "B", members: ["Y"] }];
    const out = applyTeamCard(card, [person("X"), person("Y")], teams, person);
    expect(out.teams).toHaveLength(3);
    expect(out.teams[2].members).toEqual(["Per", "Ola"]);
  });

  it("does not change what it was given", () => {
    const teams = empty();
    const people = [person("Per")];
    applyTeamCard(card, people, teams, person);
    expect(teams[0].members).toEqual([]);
    expect(people).toHaveLength(1);
  });
});
