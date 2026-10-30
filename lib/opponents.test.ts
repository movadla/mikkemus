import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EVERYONE, INTERNATIONALS, LEVEL_BOTS, LY_REGULARS, faceSrc, initialsOf, opponentOf, portraitSrc } from "./opponents";
import { medOfLevel, norwayRankOf, playerWorldRank, winChance, worldRankOf } from "./opponentStats";
import { statsFor } from "./careerGame";
import { createKnockout } from "./knockout";
import { playElsewhere } from "./botSim";
import { normalizeCareer } from "./careerStorage";
import { REVENGE_BONUS, TIERS, cupFor, fieldNames, finishEvent, newCareer, startEvent, type Career } from "./career";
import { matchParticipants, type Tournament } from "./tournament";

describe("the people", () => {
  it("are Ly's eighteen and the thirty-one international players, each with a picture that exists", () => {
    expect(LY_REGULARS).toHaveLength(18);
    expect(INTERNATIONALS).toHaveLength(31);
    for (const o of [...LY_REGULARS, ...INTERNATIONALS, ...LEVEL_BOTS]) expect(existsSync(join(process.cwd(), "public", faceSrc(o.face))), o.name).toBe(true);
  });

  it("have a face of their own: no two named people share one, but the level bots that are in the Ly group", () => {
    const named = EVERYONE.map((o) => o.face);
    expect(new Set(named).size).toBe(named.length);
    for (const b of LEVEL_BOTS.filter((x) => ["Dave", "Halfdan", "Guro"].includes(x.name))) expect(LY_REGULARS.some((r) => r.face === b.face && Math.abs(r.med - b.med) <= 1)).toBe(true);
  });

  it("put the international players above everyone at Ly, and the two best level bots above them", () => {
    const sharpestAtLy = Math.min(...LY_REGULARS.map((r) => r.med));
    for (const o of INTERNATIONALS) expect(o.med, o.name).toBeLessThan(sharpestAtLy);
    const sharpestAbroad = Math.min(...INTERNATIONALS.map((r) => r.med));
    for (const b of LEVEL_BOTS.slice(0, 2)) expect(b.med, b.name).toBeLessThan(sharpestAbroad);
  });

  it("are found by name, with the spaces left out, and a name that is not here gets a country from the name, its initials for a face, and a strength behind the known names", () => {
    expect(opponentOf("Chris Bell").face).toBe(opponentOf("ChrisBell").face);
    expect(opponentOf("Guro").nat).toBe("NOR");
    const made = opponentOf("Anders Dahl");
    expect(made.nat).toBe("SWE");
    expect(made.face).toBe(0);
    expect(made.med).toBeGreaterThanOrEqual(38);
    expect(made.med).toBeLessThanOrEqual(55);
    expect(initialsOf("Anders Dahl")).toBe("AD");
    expect(portraitSrc("Anders Dahl").startsWith("data:image/svg+xml")).toBe(true);
    expect(portraitSrc("Anders Dahl")).toContain("AD");
    expect(portraitSrc("Dave")).toBe(faceSrc(2));
  });

  it("fill the pub's field from Ly's group and the big events' from the international players", () => {
    const ly = fieldNames(TIERS.lu, "Lars", 1, 7);
    expect(ly).toHaveLength(7);
    for (const n of ly) expect(LY_REGULARS.map((r) => r.name)).toContain(n);
    const vm = fieldNames(TIERS.vm, "Lars", 1, 31);
    expect(new Set(vm).size).toBe(31);
    for (const n of vm) expect(INTERNATIONALS.map((r) => r.name)).toContain(n);
  });
});

describe("the numbers", () => {
  it("follow the skill: the sharper, the higher the average and the better the rank", () => {
    const mm = { game: "mm" as const, doubleOut: true };
    expect(statsFor(mm, 20)[0].value).toBeGreaterThan(statsFor(mm, 49)[0].value);
    expect(worldRankOf(20)).toBeLessThan(worldRankOf(49));
    expect(norwayRankOf(160)).toBe(20);
  });

  it("find the skill of a level, between the levels", () => {
    expect(medOfLevel(1)).toBe(20);
    expect(medOfLevel(4)).toBe(39);
    expect(medOfLevel(4.5)).toBeCloseTo(44, 5);
  });

  it("give the sharper player the better chance, and an equal one half", () => {
    expect(winChance(30, 30)).toBe(50);
    expect(winChance(30, 45)).toBeGreaterThan(70);
    expect(winChance(45, 30)).toBeLessThan(30);
  });

  it("move the player up the world list as the points come in", () => {
    expect(playerWorldRank(37, 100)).toBeLessThan(playerWorldRank(37, 0));
    expect(playerWorldRank(20, 10000)).toBe(1);
  });
});

describe("the record against an opponent", () => {
  const knockout = (results: [string, string][]): Tournament =>
    ({
      id: "t",
      mode: "individual",
      participants: [],
      groups: [],
      status: "done",
      matchSize: 2,
      createdAt: "x",
      matches: results.map(([a, w], i) => ({ id: `m${i}`, round: "bracket", bracketRoundSize: results.length - i, participantA: "Lars", participantB: a, winner: w, feedA: undefined })),
    }) as unknown as Tournament;

  const withEvent = (c: Career, t: Tournament): Career => ({ ...startEvent(c, "lu", 1), active: { ...startEvent(c, "lu", 1).active!, tournament: t } });

  it("is kept for each one met, and a win over one who has beaten the player twice pays extra", () => {
    let c: Career = { ...newCareer("Lars", "dyktig", "2026-10-28T10:00:00.000Z"), rivals: { Roger: { w: 0, l: 2, last: "2026-10-01T10:00:00.000Z", lastWon: false } } };
    c = finishEvent(withEvent(c, knockout([["Roger", "Lars"], ["Dave", "Dave"]])), "2026-10-28T11:00:00.000Z");
    expect(c.rivals?.Roger).toMatchObject({ w: 1, l: 2, lastWon: true });
    expect(c.rivals?.Dave).toMatchObject({ w: 0, l: 1, lastWon: false });
    expect(c.active?.result?.revenge).toEqual({ names: ["Roger"], bonus: REVENGE_BONUS });
    expect(c.active!.result!.prize).toBe((TIERS.lu.prizes.final ?? 0) + REVENGE_BONUS);
  });

  it("pays nothing extra for a win over one who has not had the better of the player", () => {
    const c = finishEvent(withEvent(newCareer("Lars", "dyktig", "2026-10-28T10:00:00.000Z"), knockout([["Roger", "Lars"]])), "2026-10-28T11:00:00.000Z");
    expect(c.active?.result?.revenge).toBeUndefined();
    expect(matchParticipants(c.active!.tournament!.matches[0])).toContain("Roger");
  });
});

describe("the figures follow the game", () => {
  const mm = { game: "mm" as const, doubleOut: true };
  it("are the hit rate and the darts to finish a game in Mikke Mus, the sharper the better", () => {
    expect(statsFor(mm, 20).map((s) => [s.key, s.value])).toEqual([["hit", 69], ["darts", 47]]);
    expect(statsFor(mm, 80).map((s) => [s.key, s.value])).toEqual([["hit", 15], ["darts", 226]]);
    expect(statsFor(mm, 20)[1].better).toBe("low");
  });

  it("are the average, the darts for a leg and the finishing on a double in 501 and 301", () => {
    expect(statsFor({ game: "501", doubleOut: true }, 20).map((s) => [s.key, s.value])).toEqual([["avg", 54], ["legs", 26], ["double", 18]]);
    expect(statsFor({ game: "301", doubleOut: true }, 30).find((s) => s.key === "legs")!.value).toBe(25);
  });

  it("leave the double out when it takes none, and a leg is shorter then", () => {
    const straight = statsFor({ game: "501", doubleOut: false }, 39);
    expect(straight.map((s) => s.key)).toEqual(["avg", "legs"]);
    expect(straight[1].value).toBeLessThan(statsFor({ game: "501", doubleOut: true }, 39)[1].value);
  });

  it("go between the levels", () => {
    const mid = statsFor(mm, 34.5)[1].value;
    expect(mid).toBeGreaterThan(68);
    expect(mid).toBeLessThan(85);
  });
});

describe("a cup played as 501", () => {
  const bots = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `B${i + 1}`, isBot: true as const, botLevel: String(1 + (i % 6)) as "1", skill: 1 + (i % 6) }));
  const cup = (countdown?: { start: 301 | 501; doubleOut: boolean }) => ({ kind: "lu" as const, name: "Test", trophy: "T", level: "4" as const, growth: true, seed: 7, career: true, ...(countdown ? { countdown } : {}) });

  it("is decided by legs between the bots, with the darts each used, all the way to a winner", () => {
    const t = createKnockout("individual", bots(8), "t", "2026-10-29", "standard", cup({ start: 501, doubleOut: true }));
    const done = playElsewhere(t).tournament;
    expect(done.status).toBe("done");
    expect(done.winner).toBeTruthy();
    const played = done.matches.filter((m) => m.winner && !m.isBye);
    expect(played).toHaveLength(7);
    for (const m of played) expect(Object.values(m.stats ?? {}).every((s) => s.darts >= 3)).toBe(true);
  });

  it("is told apart from Mikke Mus by the cup alone", () => {
    expect(cup().countdown).toBeUndefined();
    expect(cup({ start: 301, doubleOut: false }).countdown).toEqual({ start: 301, doubleOut: false });
  });

  it("is what a career plays when its game is 501: the cup carries it, and a career without a game plays Mikke Mus", () => {
    const base = newCareer("Lars", "dyktig", "2026-10-29T10:00:00.000Z");
    expect(cupFor(base, TIERS.lu, 1).countdown).toBeUndefined();
    expect(cupFor({ ...base, profile: { ...base.profile, game: "501", doubleOut: false } }, TIERS.lu, 1).countdown).toEqual({ start: 501, doubleOut: false });
    expect(cupFor({ ...base, profile: { ...base.profile, game: "301" } }, TIERS.lu, 1).countdown).toEqual({ start: 301, doubleOut: true });
    expect(normalizeCareer({ ...base, profile: { home: "garage", darts: "middels" } } as never).profile).toMatchObject({ game: "mm", doubleOut: true, darts: "steel" });
  });
});
