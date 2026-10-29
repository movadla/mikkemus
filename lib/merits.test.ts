import { describe, expect, it } from "vitest";
import { newCareer, type Career } from "./career";
import { lifeOf } from "./careerLife";
import { challengeRival, chooseRival, worldRankNow } from "./careerWorld";
import type { Life } from "./careerLife";
import { bestResults, meritsOf } from "./merits";
import { rivalOf } from "./careerLife";

const withLife = (c: Career, patch: Partial<Life>): Career => ({ ...c, life: { ...lifeOf(c), ...patch } });
const AT = "2026-10-28T20:00:00.000Z";
const fresh = (): Career => newCareer("Lars", "dyktig", AT);
const done = (c: Career) => meritsOf(c).filter((m) => m.done).map((m) => m.id);

describe("merits", () => {
  it("are none for a new career, and come with what the career holds", () => {
    expect(done(fresh())).toEqual([]);
    const c = { ...fresh(), played: 6, titles: 1, points: 12, trophies: [{ tier: "lu" as const, at: AT, prize: 100 }], room: 9, climb: { level: 11 } };
    expect(done(c)).toEqual(expect.arrayContaining(["first", "five", "win", "cup-lu", "rank-1", "room", "climb10"]));
    expect(done(c)).not.toContain("climb50");
  });

  it("count a win over the rival and a season as number one", () => {
    const c = fresh();
    const rival = rivalOf(c).name;
    const beaten = { ...c, rivals: { [rival]: { w: 1, l: 0, last: AT, lastWon: true } } };
    expect(done(beaten)).toContain("rival");
    const year = withLife(c, { seasons: [{ season: 1, rank: 1, points: 40, prize: 300, winner: "Lars" }] });
    expect(done(year)).toContain("year");
  });
});

describe("the best results", () => {
  it("keep the best place in each cup, not the last, and count titles when there are several", () => {
    const c = fresh();
    expect(bestResults(c)).toEqual([]);
    const semi = { ...c, best: { nm: "semi" as const }, history: [{ at: AT, event: "Norgesmesterskapet", place: "r16" as const, prize: 0, cost: 0, points: 0 }] };
    expect(bestResults(semi)).toEqual([expect.objectContaining({ id: "nm", best: "Semifinale" })]);
    const twice = { ...c, trophies: [{ tier: "lu" as const, at: AT, prize: 100 }, { tier: "lu" as const, at: AT, prize: 100 }] };
    expect(bestResults(twice)[0]).toMatchObject({ id: "lu", best: "Vinner ×2", titles: 2 });
  });
});

describe("the rival", () => {
  it("can be chosen among the regulars of Ly, never the player, and stays the one chosen", () => {
    const c = fresh();
    const picked = chooseRival(c, "Dave");
    expect(rivalOf(picked).name).toBe("Dave");
    expect(chooseRival(c, "Lars")).toBe(c);
    expect(chooseRival(c, "Littler")).toBe(c);
    expect(lifeOf(picked).rivalPick).toBe("Dave");
  });

  it("can be challenged to a duel in 501, for more than an ordinary duel, with half of it at risk; not while something is going", () => {
    const c = chooseRival(fresh(), "Dave");
    const d = challengeRival(c, 5);
    expect(d.challenge).toMatchObject({ game: "501", opponent: { name: "Dave" }, won: null });
    expect(d.challenge!.risk).toBe(Math.max(50, Math.round(d.challenge!.stake / 2 / 50) * 50));
    expect(challengeRival(d, 6)).toBe(d);
  });
});

describe("the world list", () => {
  it("moves a player up for every ranking point they have won, in this season and the ones that are over", () => {
    const c = fresh();
    const life = lifeOf(c);
    const base = worldRankNow(life, "Dave", 30);
    const some = worldRankNow({ ...life, world: { ...life.world, pts: { Dave: 30 } } }, "Dave", 30);
    const more = worldRankNow({ ...life, world: { ...life.world, pts: { Dave: 30 }, cum: { Dave: 60 } } }, "Dave", 30);
    expect(some).toBeLessThan(base);
    expect(more).toBeLessThan(some);
    expect(worldRankNow({ ...life, world: { ...life.world, cum: { Dave: 100000 } } }, "Dave", 30)).toBe(1);
  });
});
