import { describe, expect, it } from "vitest";
import { newCareer, type Career } from "./career";
import { CLIMB_MAX, CLIMB_REWARD, DAILY_REWARD, DRILLS, LEVEL_MAX, applyClimb, applyDrill, climbLevel, climbOpen, climbTarget, dailyDrill, dailyOf, drillLevel, goalLine, goalOf, isDrillOpen, levelCap, passed, type DrillId } from "./drills";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = (): Career => newCareer("Lars", "dyktig", AT);

describe("the goal of a drill", () => {
  it("gets harder with every level, in every drill", () => {
    const score = (id: DrillId, level: number) => {
      const g = goalOf(id, level);
      return g.kind === "score" ? g.average : g.need * 100 - g.attempts;
    };
    for (const d of DRILLS) {
      let last = -Infinity;
      for (let level = 1; level <= LEVEL_MAX; level++) {
        const now = score(d.id, level);
        expect(now).toBeGreaterThanOrEqual(last);
        last = now;
      }
      expect(score(d.id, LEVEL_MAX)).toBeGreaterThan(score(d.id, 1));
    }
  });

  it("is said in one line", () => {
    expect(goalLine("t20", 1)).toBe("Snitt 20 per runde");
    expect(goalLine("tre20", 1)).toBe("3 20 på 3 piler · 10 forsøk");
    expect(goalLine("tre20", 100)).toBe("3 20 på 3 piler · 1 forsøk");
    expect(goalLine("bull9", 1)).toBe("1 bull på 9 piler · 3 forsøk");
  });
});

describe("passing a drill", () => {
  it("is the average for a score drill, and a hit count in one of the attempts for a hits drill", () => {
    expect(passed({ id: "t20", level: 1, scores: Array(15).fill(21) })).toBe(true);
    expect(passed({ id: "t20", level: 1, scores: Array(15).fill(19) })).toBe(false);
    expect(passed({ id: "t20", level: 1, scores: Array(10).fill(99) })).toBe(false);
    expect(passed({ id: "tre20", level: 1, scores: [0, 1, 3] })).toBe(true);
    expect(passed({ id: "tre20", level: 1, scores: [0, 2, 2] })).toBe(false);
    // Only the attempts the level gives count.
    expect(passed({ id: "tre20", level: 100, scores: [2, 3] })).toBe(false);
  });
});

describe("a drill that is thrown", () => {
  it("takes the drill a level up when it is passed, and counts the try when it is not", () => {
    const up = applyDrill(fresh(), { id: "bull9", level: 1, scores: [1] }, AT);
    expect(up.drills?.bull9).toEqual({ level: 2, passes: 1, tries: 1 });
    const same = applyDrill(up, { id: "bull9", level: 2, scores: [0, 0, 0] }, AT);
    expect(same.drills?.bull9).toEqual({ level: 2, passes: 1, tries: 2 });
  });

  it("stops at what the room allows: ten levels for each step of it", () => {
    expect(levelCap(0)).toBe(10);
    expect(levelCap(4)).toBe(50);
    expect(levelCap(9)).toBe(100);
    const c = { ...fresh(), room: 0, drills: { tre20: { level: 10, passes: 9, tries: 9 } } };
    expect(drillLevel(c, "tre20")).toBe(10);
    const after = applyDrill(c, { id: "tre20", level: 10, scores: Array(10).fill(3) }, AT);
    expect(after.drills?.tre20.level).toBe(10);
    expect(after.drills?.tre20.passes).toBe(10);
    const roomed = applyDrill({ ...c, room: 1 }, { id: "tre20", level: 10, scores: Array(10).fill(3) }, AT);
    expect(roomed.drills?.tre20.level).toBe(11);
  });

  it("moves the level of the career only in the treble 20", () => {
    const sharp = applyDrill(fresh(), { id: "t20", level: 1, scores: Array(15).fill(60) }, AT);
    expect(sharp.skillMed).toBeLessThan(fresh().skillMed);
    expect(sharp.training).toHaveLength(1);
    const bulls = applyDrill(fresh(), { id: "bull9", level: 1, scores: [3] }, AT);
    expect(bulls.skillMed).toBe(fresh().skillMed);
    expect(bulls.training).toHaveLength(0);
  });
});

describe("the drills the room opens", () => {
  it("opens the treble 20 from the start and the others as the room is built", () => {
    expect(isDrillOpen({ ...fresh(), room: 0 }, "t20")).toBe(true);
    expect(isDrillOpen({ ...fresh(), room: 0 }, "tre20")).toBe(false);
    expect(isDrillOpen({ ...fresh(), room: 1 }, "tre20")).toBe(true);
    expect(isDrillOpen({ ...fresh(), room: 2 }, "bull9")).toBe(false);
    expect(isDrillOpen({ ...fresh(), room: 3 }, "bull9")).toBe(true);
  });
});

describe("the drill of the day", () => {
  const c = (): Career => ({ ...fresh(), room: 3 });
  const pass = (career: Career, day: string) => {
    const id = dailyDrill(career, day);
    const g = goalOf(id, drillLevel(career, id));
    const scores = g.kind === "score" ? Array(g.rounds).fill(g.average + 1) : Array(g.attempts).fill(g.need);
    return applyDrill(career, { id, level: drillLevel(career, id), scores }, `${day}T12:00:00.000Z`);
  };

  it("is one of the open drills, and the same all day", () => {
    const id = dailyDrill(c(), "2026-10-29");
    expect(DRILLS.filter((d) => isDrillOpen(c(), d.id)).map((d) => d.id)).toContain(id);
    expect(dailyDrill(c(), "2026-10-29")).toBe(id);
    expect(dailyDrill({ ...fresh(), room: 0 }, "2026-10-29")).toBe("t20");
  });

  it("pays once when it is passed, and starts a streak", () => {
    const first = pass(c(), "2026-10-29");
    expect(first.money).toBe(c().money + DAILY_REWARD);
    expect(dailyOf(first, "2026-10-29")).toMatchObject({ done: true, streak: 1 });
    // Passed again the same day: nothing more.
    const again = pass(first, "2026-10-29");
    expect(again.money).toBe(first.money);
  });

  it("keeps the streak over consecutive days, and loses it when a day is missed", () => {
    let k = pass(c(), "2026-10-29");
    k = pass(k, "2026-10-30");
    expect(dailyOf(k, "2026-10-30").streak).toBe(2);
    expect(dailyOf(k, "2026-10-31")).toMatchObject({ done: false, streak: 2 });
    expect(dailyOf(k, "2026-11-02").streak).toBe(0);
    const later = pass(k, "2026-11-02");
    expect(dailyOf(later, "2026-11-02").streak).toBe(1);
  });

  it("does not pay for another drill than the one of the day", () => {
    const k = c();
    const other = DRILLS.find((d) => d.id !== dailyDrill(k, "2026-10-29"))!;
    const g = goalOf(other.id, 1);
    const scores = g.kind === "score" ? Array(g.rounds).fill(g.average + 1) : Array(g.attempts).fill(g.need);
    const after = applyDrill(k, { id: other.id, level: 1, scores }, "2026-10-29T12:00:00.000Z");
    expect(after.money).toBe(k.money);
  });
});

describe("the ladder of training", () => {
  it("asks for more with every level: 40 at the first, the most there is (180) at the hundredth", () => {
    expect(climbTarget(1)).toBe(40);
    expect(climbTarget(100)).toBe(180);
    let last = 0;
    for (let l = 1; l <= CLIMB_MAX; l++) {
      expect(climbTarget(l)).toBeGreaterThanOrEqual(last);
      last = climbTarget(l);
    }
  });

  it("moves a level up and pays once when three darts make enough, and not when they do not", () => {
    const c = { ...fresh(), room: 3 };
    expect(climbLevel(c)).toBe(1);
    const miss = applyClimb(c, 39);
    expect(miss).toBe(c);
    const pass = applyClimb(c, 40);
    expect(climbLevel(pass)).toBe(2);
    expect(pass.money).toBe(c.money + CLIMB_REWARD);
    // More than enough counts the same.
    expect(climbLevel(applyClimb(c, 180))).toBe(2);
  });

  it("stops at what the room lets the player climb: ten levels for each step of it", () => {
    const top = { ...fresh(), room: 1, climb: { level: 20 } };
    expect(climbOpen(top)).toBe(true);
    const passed20 = applyClimb(top, 180);
    expect(climbLevel(passed20)).toBe(21);
    expect(climbOpen(passed20)).toBe(false);
    // Nothing is paid for a level the room does not allow yet, and a better room opens it.
    expect(applyClimb(passed20, 180)).toBe(passed20);
    expect(climbOpen({ ...passed20, room: 2 })).toBe(true);
  });

  it("ends at a hundred", () => {
    const end = { ...fresh(), room: 9, climb: { level: 100 } };
    const done = applyClimb(end, 180);
    expect(climbLevel(done)).toBe(101);
    expect(climbOpen(done)).toBe(false);
  });
});
