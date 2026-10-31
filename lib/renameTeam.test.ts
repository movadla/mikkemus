import { describe, expect, it, vi } from "vitest";
import { buildMatchLog } from "./matchLog";
import type { MatchHistoryEntry } from "./playerRows";

vi.mock("./supabaseClient", () => ({ supabase: null }));

const entry = (over: Partial<MatchHistoryEntry>): MatchHistoryEntry => ({ date: "2026-10-17T18:00:00.100Z", won: true, dartsUsed: 60, hitPct: 50, med: null, mhd: null, mvd: null, ...over });

describe("a team that gets another name", () => {
  it("keeps its matches as matches: the others' history says the new name, so no side is left without an owner", async () => {
    const s = await import("./storage");
    s.ensureTeam("Gammelt", ["A", "B"]);
    s.ensureTeam("Bravo", ["C", "D"]);
    s.recordMatchHistory("Gammelt", entry({ matchId: "m1", vs: ["Bravo"], won: true }));
    s.recordMatchHistory("Bravo", entry({ matchId: "m1", vs: ["Gammelt"], won: false, date: "2026-10-17T18:00:00.300Z" }));
    expect(s.renameTeam("Gammelt", "Nytt")).toEqual({ ok: true, name: "Nytt" });
    const log = buildMatchLog(["Nytt", "Bravo"].map((n) => s.getPlayerRecord(n)!));
    expect(log).toHaveLength(1);
    expect(log[0].sides.map((x) => x.name).sort()).toEqual(["Bravo", "Nytt"]);
    expect(log[0].partial).toBe(false);
    expect(log[0].winner).toBe("Nytt");
  });
});
