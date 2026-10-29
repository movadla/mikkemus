import { describe, expect, it } from "vitest";
import { newCareer, type Career } from "./career";
import { DRILLS, LEVEL_MAX, applyDrill, drillLevel, goalLine, goalOf, levelCap, passed, type DrillId } from "./drills";

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
