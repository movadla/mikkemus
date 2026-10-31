import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NightMatch } from "./nightScore";
import { isPlayed, moved, nextPlanned, setPlanSession, whoOf, type PlannedMatch } from "./nightPlan";

vi.mock("./supabaseClient", () => ({ supabase: null }));

const planned = (id: string): PlannedMatch => ({ id, game: "countdown", setup: {}, who: id, label: "" });
const played = (planId: string, over: Partial<NightMatch> = {}): NightMatch => ({ id: `m-${planId}`, evening: "e", at: "2026-10-31T19:00:00Z", game: "301", sides: [], placements: [], planned: planId, ...over });

describe("Kveldsplan", () => {
  it("neste er den første i planen som ikke er spilt, og en slettet kamp teller ikke som spilt", () => {
    const evening = { id: "e", startedAt: "x", plan: [planned("a"), planned("b"), planned("c")] };
    expect(nextPlanned(evening, [])?.id).toBe("a");
    expect(nextPlanned(evening, [played("a")])?.id).toBe("b");
    expect(nextPlanned(evening, [played("a"), played("b")])?.id).toBe("c");
    expect(nextPlanned(evening, [played("a", { deleted: true })])?.id).toBe("a");
    expect(nextPlanned(evening, [played("a"), played("b"), played("c")])).toBeNull();
    expect(isPlayed(planned("a"), [played("a")])).toBe(true);
    expect(nextPlanned({ id: "e", startedAt: "x" }, [])).toBeNull();
  });

  it("en kamp flyttes opp og ned, men ikke ut av listen", () => {
    expect(moved([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
    expect(moved([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moved([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moved([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });

  it("sier hvem som spiller, lag eller spillere", () => {
    expect(whoOf({ mode: "team", teams: [{ name: "A" }, { name: "B" }] })).toBe("A mot B");
    expect(whoOf({ mode: "individual", people: [{ name: "Lars" }, { name: "Vadla" }] })).toBe("Lars mot Vadla");
    expect(whoOf({ mode: "individual", people: [{ name: "Lars" }, { name: "Vadla" }, { name: "Hans" }] })).toBe("Lars, Vadla, Hans");
    expect(whoOf(undefined)).toBe("");
  });
});

describe("en kveld med plan teller bare planlagte kamper", () => {
  beforeEach(() => {
    vi.resetModules();
    setPlanSession(null);
  });
  const match = (id: string) => ({ id, game: "301" as const, sides: [{ name: "A", members: ["A"] }, { name: "B", members: ["B"] }], placements: ["A", "B"] });

  it("en kamp utenfor planen telles ikke, med mindre den legges inn for hånd", async () => {
    const s = await import("./nightScoreStorage");
    s.startNewEvening({ plan: true });
    s.recordNightMatch(match("x1"));
    s.recordNightMatch(match("x2"), { force: true });
    expect(s.nightSnapshot().matches.map((m) => m.id)).toEqual(["x2"]);
  });

  it("en kamp spilt fra planen får planens id, og en kamp teller bare én gang for den", async () => {
    const s = await import("./nightScoreStorage");
    s.startNewEvening({ plan: true });
    const evening = s.currentEvening(s.nightSnapshot())!;
    s.addPlanned(evening.id, planned("p1"));
    s.addPlanned(evening.id, planned("p2"));
    expect(s.currentEvening(s.nightSnapshot())!.plan?.map((p) => p.id)).toEqual(["p1", "p2"]);
    // The same copy of the plan module as the storage has (the modules were reset for this test).
    (await import("./nightPlan")).setPlanSession({ kind: "play", eveningId: evening.id, game: "countdown", plannedId: "p1" });
    s.recordNightMatch(match("m1"));
    s.recordNightMatch(match("m2"));
    expect(s.nightSnapshot().matches.map((m) => [m.id, m.planned])).toEqual([["m1", "p1"]]);
    // Taken out of the evening, it can be played again.
    s.updateNightMatch("m1", { deleted: true });
    s.recordNightMatch(match("m3"));
    expect(s.nightSnapshot().matches.filter((m) => !m.deleted).map((m) => m.id)).toEqual(["m3"]);
    s.movePlanned(evening.id, "p2", -1);
    expect(s.currentEvening(s.nightSnapshot())!.plan?.map((p) => p.id)).toEqual(["p2", "p1"]);
    s.changePlanned(evening.id, "p2", { label: "ny" });
    s.removePlanned(evening.id, "p1");
    expect(s.currentEvening(s.nightSnapshot())!.plan).toEqual([{ ...planned("p2"), label: "ny" }]);
  });

  it("en kveld uten plan teller alle kamper som før", async () => {
    const s = await import("./nightScoreStorage");
    s.startNewEvening();
    s.recordNightMatch(match("y1"));
    expect(s.nightSnapshot().matches.map((m) => m.id)).toEqual(["y1"]);
  });
});
