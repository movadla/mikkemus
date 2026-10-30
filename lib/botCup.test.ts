import { describe, expect, it } from "vitest";
import { botSetupForMatch, buildCupParticipants, levelForMatch, makeCup, pickNames, pickPilotBots, stageOffset, botSkill, CUP_TYPES, PILOT_BOTS, PILOT_BOTS_ALWAYS } from "./botCup";
import { medForSkill } from "./knockoutSeeding";
import type { Participant } from "./tournament";

const me = (name: string): Participant => ({ name, isBot: false });
const cup = makeCup("vm", "4", true, 12345);

const group = { id: "group-0-1", round: "group" as const };

describe("the bots of a cup", () => {
  it("fills the field up to the size with named bots, none sharing a name with each other or with the house", () => {
    const own = [me("Vadla"), me("Hans")];
    const all = buildCupParticipants("individual", own, 8, cup);
    expect(all).toHaveLength(8);
    expect(all.slice(0, 2)).toEqual(own);
    const names = all.map((p) => p.name.toLowerCase());
    expect(new Set(names).size).toBe(8);
    all.slice(2).forEach((b) => {
      expect(b.isBot).toBe(true);
      expect(Number(b.botLevel)).toBeGreaterThanOrEqual(1);
      expect(Number(b.botLevel)).toBeLessThanOrEqual(5);
      expect(b.skill).toBeDefined();
    });
  });

  it("gives team cups bot teams of two named bots", () => {
    const own: Participant[] = [{ name: "Team Gjert", isBot: false, members: [{ name: "Vadla", isBot: false }, { name: "Hans", isBot: false }] }];
    const all = buildCupParticipants("team", own, 4, cup);
    expect(all).toHaveLength(4);
    const bots = all.slice(1);
    bots.forEach((t) => {
      expect(t.isBot).toBe(false);
      expect(t.members).toHaveLength(2);
      t.members!.forEach((m) => expect(m.isBot && m.skill !== undefined).toBe(true));
    });
    const everyName = all.flatMap((t) => [t.name, ...t.members!.map((m) => m.name)]).map((n) => n.toLowerCase());
    expect(new Set(everyName).size).toBe(everyName.length);
  });

  it("is the same cup every time it is made from the same seed, and another cup from another", () => {
    const a = buildCupParticipants("individual", [me("Vadla")], 8, cup).map((p) => p.name);
    const b = buildCupParticipants("individual", [me("Vadla")], 8, cup).map((p) => p.name);
    const c = buildCupParticipants("individual", [me("Vadla")], 8, { ...cup, seed: 999 }).map((p) => p.name);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("skips a name the house already has, and numbers on when the pool is spent", () => {
    expect(pickNames(["A", "B"], 1, ["a"], "s")).toEqual(["B"]);
    const names = pickNames(["A", "B"], 5, [], "s");
    expect(new Set(names).size).toBe(5);
  });

  it("has a name and a trophy for every kind of cup", () => {
    CUP_TYPES.forEach((t) => {
      expect(t.name).not.toBe("");
      expect(t.trophy).not.toBe("");
    });
  });
});

describe("how the bots throw", () => {
  const final = { id: "final", round: "bracket" as const, bracketRoundSize: 1 };

  it("spreads the skills round the chosen level, within the levels there are", () => {
    const skills = Array.from({ length: 40 }, (_, i) => botSkill(cup, `Bot ${i}`));
    expect(Math.min(...skills)).toBeGreaterThanOrEqual(3.1);
    expect(Math.max(...skills)).toBeLessThanOrEqual(4.9);
    expect(Math.max(...skills) - Math.min(...skills)).toBeGreaterThan(0.8);
  });

  it("starts weaker and ends stronger when growth is on, and is level throughout when it is off", () => {
    expect(stageOffset(group)).toBeGreaterThan(stageOffset({ round: "bracket", bracketRoundSize: 4 }));
    expect(stageOffset({ round: "bracket", bracketRoundSize: 4 })).toBeGreaterThan(stageOffset(final));
    const mean = (m: typeof group | typeof final, c = cup) => Array.from({ length: 200 }, (_, i) => Number(levelForMatch(c, 4, { ...m, id: `${m.id}-${i}` }, "Bot"))).reduce((a, b) => a + b, 0) / 200;
    expect(mean(group)).toBeGreaterThan(mean(final) + 0.5); // a higher level number is a weaker bot
    const flat = { ...cup, growth: false };
    expect(Math.abs(mean(group, flat) - mean(final, flat))).toBeLessThan(0.3);
  });

  it("varies from match to match, but gives the same level for the same match every time", () => {
    const levels = Array.from({ length: 30 }, (_, i) => levelForMatch(cup, 4, { id: `m${i}`, round: "bracket", bracketRoundSize: 4 }, "Bot"));
    expect(new Set(levels).size).toBeGreaterThan(1);
    expect(levelForMatch(cup, 4, { id: "m1", round: "group" }, "Bot")).toBe(levelForMatch(cup, 4, { id: "m1", round: "group" }, "Bot"));
  });

  it("gives an ordinary tournament the levels its bots were given, and a cup the levels of the match", () => {
    const plain = { participants: [me("Vadla"), { name: "Dave 🥉", isBot: true, botLevel: "3" as const }] };
    expect(botSetupForMatch(plain, group).botLevels).toEqual({ "Dave 🥉": "3" });
    const all = buildCupParticipants("individual", [me("Vadla")], 4, cup);
    const t = { participants: all, cup };
    const setup = botSetupForMatch(t, group);
    expect(Object.keys(setup.botLevels)).toEqual(all.slice(1).map((p) => p.name));
    expect(botSetupForMatch(t, group)).toEqual(setup);
  });

  it("works out each member of a bot team on their own", () => {
    const own: Participant[] = [{ name: "Oss", isBot: false, members: [{ name: "Vadla", isBot: false }, { name: "Hans", isBot: false }] }];
    const t = { participants: buildCupParticipants("team", own, 2, cup), cup };
    const rosters = botSetupForMatch(t, group).teamRosters;
    const bot = t.participants[1];
    expect(rosters[bot.name].every((m) => m.isBot && !!m.botLevel)).toBe(true);
    expect(rosters.Oss.every((m) => !m.isBot)).toBe(true);
  });
});

describe("the bots of Ly Pilotturnering", () => {
  const open = makeCup("open", "4", false, 777);

  it("has eighteen named bots, from the best to the weakest, and each is weaker than the one before", () => {
    expect(PILOT_BOTS.map((b) => b.name)).toEqual(["Chris Bell", "Dave", "Kjetil", "Christer", "Dan", "Nikolai", "Anders", "Olav Johan", "Kalle", "Svein", "Bent", "Håkon", "Thomas", "Rudolf", "Joachim", "Linus", "Bernhard", "Guro"]);
    for (let i = 1; i < PILOT_BOTS.length; i++) expect(PILOT_BOTS[i].skill).toBeGreaterThan(PILOT_BOTS[i - 1].skill);
  });

  it("puts a player who measures 37.4 mm between the fourth and the fifth", () => {
    const med = (name: string) => medForSkill(PILOT_BOTS.find((b) => b.name === name)!.skill);
    expect(med("Christer")).toBeLessThan(37.4);
    expect(med("Dan")).toBeGreaterThan(37.4);
    // And the best is clearly sharper than such a player, the weakest clearly weaker.
    expect(med("Chris Bell")).toBeLessThan(30);
    expect(med("Guro")).toBeGreaterThan(50);
  });

  it("fills a field of sixteen with the bots, the house first, and always has the five that are always there", () => {
    const own = ["Vadla", "Hans", "Lars"].map(me);
    const all = buildCupParticipants("individual", own, 16, open);
    expect(all).toHaveLength(16);
    expect(all.slice(0, 3)).toEqual(own);
    const bots = all.slice(3).map((p) => p.name);
    expect(bots).toHaveLength(13);
    for (const n of PILOT_BOTS_ALWAYS) expect(bots).toContain(n);
    // Strongest first, as they are listed.
    expect(bots).toEqual(PILOT_BOTS.map((b) => b.name).filter((n) => bots.includes(n)));
    all.slice(3).forEach((b) => expect(b.skill).toBe(PILOT_BOTS.find((x) => x.name === b.name)!.skill));
  });

  it("draws the rest from the seed: the same every time, and another field from another seed", () => {
    const names = (seed: number) => pickPilotBots(8, [], seed).map((b) => b.name);
    expect(names(1)).toEqual(names(1));
    const fields = new Set(Array.from({ length: 12 }, (_, i) => names(i + 1).join("|")));
    expect(fields.size).toBeGreaterThan(3);
    for (let s = 1; s <= 12; s++) for (const n of PILOT_BOTS_ALWAYS) expect(names(s)).toContain(n);
  });

  it("has room for only some of the always-bots when few are asked for, the best first", () => {
    expect(pickPilotBots(3, [], 5).map((b) => b.name)).toEqual(["Chris Bell", "Dave", "Kjetil"]);
    expect(pickPilotBots(5, [], 5).map((b) => b.name)).toEqual(["Chris Bell", "Dave", "Kjetil", "Thomas", "Guro"]);
    expect(pickPilotBots(0, [], 5)).toEqual([]);
  });

  it("leaves out a name the house has, and still fills the field", () => {
    const bots = pickPilotBots(15, ["dan", "Dave"], 3).map((b) => b.name);
    expect(bots).not.toContain("Dan");
    expect(bots).not.toContain("Dave");
    expect(bots).toHaveLength(15);
  });

  it("lets a bot reach level 6 here and never in the other cups", () => {
    const m = { id: "h1", round: "bracket" as const, bracketRoundSize: undefined };
    const levels = new Set<string>();
    for (let i = 0; i < 400; i++) levels.add(levelForMatch({ ...open, seed: i }, 5.7, { ...m, id: `x${i}` }, "Guro"));
    expect(levels.has("6")).toBe(true);
    const other = new Set<string>();
    for (let i = 0; i < 400; i++) other.add(levelForMatch({ ...cup, seed: i }, 5, { ...m, id: `x${i}` }, "Guro"));
    expect(other.has("6")).toBe(false);
  });
});

describe("the teams of bots", () => {
  const cup = makeCup("vm", "4", true, 7);
  const own: Participant[] = [{ name: "Vadla og Hans", isBot: false, members: [{ name: "Vadla", isBot: false }, { name: "Hans", isBot: false }] }];

  it("are made of players the house has, and called after them", () => {
    const known = ["Vadla", "Hans", "Moen", "Lars", "Monge", "Vegard", "John", "Duncan"];
    const all = buildCupParticipants("team", own, 4, cup, known);
    const bots = all.slice(1);
    expect(bots).toHaveLength(3);
    const used = bots.flatMap((b) => b.members!.map((m) => m.name));
    // Six names are needed and the house has six that are free: all of them are from the house, none is one of the player's own.
    for (const n of used) expect(known).toContain(n);
    expect(used).not.toContain("Vadla");
    expect(used).not.toContain("Hans");
    expect(new Set(used).size).toBe(6);
    for (const b of bots) expect(b.name).toBe(b.members!.map((m) => m.name.split(" ")[0]).join(" og "));
  });

  it("run out of the house's players and go on with real names, each once", () => {
    const all = buildCupParticipants("team", own, 8, cup, ["Moen", "Lars"]);
    const used = all.slice(1).flatMap((b) => b.members!.map((m) => m.name));
    expect(used).toHaveLength(14);
    expect(new Set(used).size).toBe(14);
    expect(used).toContain("Moen");
    expect(used).toContain("Lars");
  });
});
