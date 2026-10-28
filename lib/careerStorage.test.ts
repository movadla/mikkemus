import { describe, expect, it } from "vitest";
import { newCareer } from "./career";
import { mergeCareers } from "./careerStorage";

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
