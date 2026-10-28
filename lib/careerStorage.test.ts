import { describe, expect, it } from "vitest";
import { newCareer } from "./career";
import { mergeCareers, normalizeCareer } from "./careerStorage";

const mk = (name: string, savedAt: string, money = 100) => ({ ...newCareer(name, "dyktig", "2026-10-01T10:00:00.000Z"), savedAt, money });

describe("merging careers", () => {
  it("keeps the newest copy of each career and puts the newest first", () => {
    const local = [mk("Lars", "2026-10-02T10:00:00.000Z", 500), mk("Mia", "2026-10-01T10:00:00.000Z")];
    const remote = [mk("Lars", "2026-10-01T10:00:00.000Z", 100), mk("Vadla", "2026-10-03T10:00:00.000Z")];
    const merged = mergeCareers(local, remote);
    expect(merged.map((c) => c.id)).toEqual(["vadla", "lars", "mia"]);
    expect(merged.find((c) => c.id === "lars")!.money).toBe(500);
  });

  it("takes the one from the database when it is newer", () => {
    const merged = mergeCareers([mk("Lars", "2026-10-01T10:00:00.000Z", 100)], [mk("Lars", "2026-10-05T10:00:00.000Z", 900)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].money).toBe(900);
  });

  it("is just the local ones when the database has nothing", () => {
    const local = [mk("Lars", "2026-10-01T10:00:00.000Z")];
    expect(mergeCareers(local, [])).toEqual(local);
    expect(mergeCareers([], [])).toEqual([]);
  });
});


describe("a career from before the room had steps", () => {
  it("is brought across: two of the old steps are one of the new", () => {
    const old = { ...mk("Lars", "2026-10-01T10:00:00.000Z"), arena: { wall: 1, floor: 0, board: 1, light: 1, decor: 1, crowd: 0 } } as unknown as Record<string, unknown>;
    delete old.room;
    expect(normalizeCareer(old as never).room).toBe(2);
  });

  it("keeps the step a career already has", () => {
    expect(normalizeCareer({ ...mk("Lars", "2026-10-01T10:00:00.000Z"), room: 5 }).room).toBe(5);
  });

  it("starts a career with nothing from before at the first step, and never past the last", () => {
    expect(normalizeCareer(mk("Lars", "2026-10-01T10:00:00.000Z")).room).toBe(0);
    const huge = { ...mk("Lars", "2026-10-01T10:00:00.000Z"), arena: { a: 18, b: 18 } } as unknown as Record<string, unknown>;
    delete huge.room;
    expect(normalizeCareer(huge as never).room).toBe(9);
  });
});

describe("a career from the time the pub was called Lü", () => {
  it("reads the old name as the new: in the history, and in a cup that is going", () => {
    const old = { ...mk("Lars", "2026-10-01T10:00:00.000Z"), history: [{ at: "2026-10-01T10:00:00.000Z", event: "Lü-cupen", place: "winner", prize: 500, cost: 0, points: 10 }] } as unknown as Record<string, unknown>;
    delete old.trophies;
    const c = normalizeCareer(old as never);
    expect(c.history[0].event).toBe("Ly-cupen");
    expect(c.trophies).toEqual([{ tier: "lu", at: "2026-10-01T10:00:00.000Z", prize: 500 }]);
  });
});
