import { describe, expect, it } from "vitest";
import { buyStage, newCareer, type Career } from "./career";
import { RANKS, WORLD_CHAMPION, goalsOf, nextRank, rankLevel, rankOf, rankProgress, roomBadge } from "./careerGoals";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = (): Career => newCareer("Lars", "dyktig", AT);

describe("ranks", () => {
  it("starts as a pub player and goes up with the points", () => {
    expect(rankOf(fresh())).toBe("Pubspiller");
    expect(rankOf({ ...fresh(), points: 10 })).toBe("Regionspiller");
    expect(rankOf({ ...fresh(), points: 39 })).toBe("Regionspiller");
    expect(rankOf({ ...fresh(), points: 40 })).toBe("Landslagsspiller");
    expect(rankOf({ ...fresh(), points: 400 })).toBe("Verdensspiller");
  });

  it("makes a world title a rank of its own, with nothing above", () => {
    const c = { ...fresh(), points: 10, worldTitles: 1 };
    expect(rankOf(c)).toBe(WORLD_CHAMPION);
    expect(nextRank(c)).toBeNull();
  });

  it("names the title after this one", () => {
    expect(nextRank(fresh())?.name).toBe("Regionspiller");
    expect(nextRank({ ...fresh(), points: 10 })?.name).toBe("Landslagsspiller");
    expect(RANKS.map((r) => r.min)).toEqual([...RANKS.map((r) => r.min)].sort((a, b) => a - b));
  });
});

describe("goals", () => {
  it("shows the next tournament, the next rank and the next thing for the room", () => {
    const goals = goalsOf(fresh());
    expect(goals.map((g) => g.id)).toEqual(["tournament", "rank", "room"]);
  });

  it("tells a player short of money how far there is to the regional championship", () => {
    const g = goalsOf({ ...fresh(), money: 100 }).find((x) => x.id === "tournament")!;
    expect(g.title).toBe("Regionmesterskapet");
    expect(g.progress).toBeCloseTo(0.5, 5);
    expect(g.line).toMatch(/^Du mangler \$100/);
  });

  it("moves on to a step that needs a qualification once the money is there", () => {
    const g = goalsOf({ ...fresh(), money: 5000 }).find((x) => x.id === "tournament")!;
    expect(g.title).toBe("Norgesmesterskapet");
    expect(g.progress).toBeNull();
    expect(g.line).toBe("Kom blant de fire beste i Regionmesterskapet");
  });

  it("measures the rank in points between the title the player has and the next", () => {
    const g = goalsOf({ ...fresh(), points: 25 }).find((x) => x.id === "rank")!;
    expect(g.title).toBe("Landslagsspiller");
    expect(g.progress).toBeCloseTo(0.5, 5);
  });

  it("points at the next step of the room, and says when it can be bought", () => {
    const g = goalsOf({ ...fresh(), money: 300 }).find((x) => x.id === "room")!;
    expect(g.title).toBe("Rydd");
    expect(g.line).toMatch(/^Du mangler \$200$/);
    expect(g.progress).toBeCloseTo(0.6, 5);
    const rich = goalsOf({ ...fresh(), money: 1000 }).find((x) => x.id === "room")!;
    expect(rich.line).toBe("Du har råd til den nå");
    expect(buyStage({ ...fresh(), money: 1000 }).room).toBe(1);
  });

  it("drops what is done: no rank goal for a world champion", () => {
    expect(goalsOf({ ...fresh(), worldTitles: 1 }).some((g) => g.id === "rank")).toBe(false);
  });
});

describe("the level and the dot", () => {
  it("counts the rank as a number, from 1, and one above for a world champion", () => {
    expect(rankLevel(fresh())).toBe(1);
    expect(rankLevel({ ...fresh(), points: 10 })).toBe(2);
    expect(rankLevel({ ...fresh(), points: 350 })).toBe(5);
    expect(rankLevel({ ...fresh(), worldTitles: 1 })).toBe(6);
  });

  it("measures the way to the next level, and stops at the top", () => {
    expect(rankProgress({ ...fresh(), points: 25 })).toMatchObject({ next: 3, need: 40, points: 25 });
    expect(rankProgress({ ...fresh(), points: 25 })!.progress).toBeCloseTo(0.5, 5);
    expect(rankProgress({ ...fresh(), worldTitles: 1 })).toBeNull();
  });

  it("flags the room only when there is something the player can afford", () => {
    expect(roomBadge({ ...fresh(), money: 400 })).toBe(false);
    expect(roomBadge({ ...fresh(), money: 500 })).toBe(true);
    expect(roomBadge({ ...fresh(), money: 1000000, room: 9 })).toBe(false);
  });
});
