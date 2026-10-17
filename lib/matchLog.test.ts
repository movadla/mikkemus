import { describe, expect, it } from "vitest";
import { buildMatchLog } from "./matchLog";
import { emptyRecord, type MatchHistoryEntry } from "./playerRows";

const entry = (date: string, won: boolean, over: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry => ({ date, won, dartsUsed: 60, hitPct: 50, med: null, mhd: null, mvd: null, ...over });
const rec = (name: string, h: MatchHistoryEntry[], over: object = {}) => ({ ...emptyRecord(name), matchesPlayed: h.length, matchHistory: h, ...over });

describe("the log of matches", () => {
  it("puts the sides of one match together by the match id, newest first", () => {
    const a = rec("Per", [entry("2026-10-17T18:00:00.100Z", true, { matchId: "m1", vs: ["Ola"], left: 0 }), entry("2026-10-17T19:00:00.100Z", false, { matchId: "m2", vs: ["Ola"], left: 8 })]);
    const b = rec("Ola", [entry("2026-10-17T18:00:00.300Z", false, { matchId: "m1", vs: ["Per"], left: 7 }), entry("2026-10-17T19:00:00.400Z", true, { matchId: "m2", vs: ["Per"], left: 0 })]);
    const log = buildMatchLog([a, b]);
    expect(log.map((m) => m.id)).toEqual(["m2", "m1"]);
    expect(log[1].sides.map((s) => s.name).sort()).toEqual(["Ola", "Per"]);
    expect(log[1].winner).toBe("Per");
    expect(log[1].margin).toBe(7); // the loser lacked seven crosses
    expect(log[0].winner).toBe("Ola");
    expect(log[0].partial).toBe(false);
  });

  it("puts the older matches together by the moment they were written", () => {
    const a = rec("Per", [entry("2026-10-10T18:00:00.100Z", true), entry("2026-10-10T19:30:00.100Z", false)]);
    const b = rec("Ola", [entry("2026-10-10T18:00:00.250Z", false), entry("2026-10-10T19:30:00.300Z", true)]);
    const log = buildMatchLog([a, b]);
    expect(log.length).toBe(2);
    expect(log[0].sides.map((s) => s.name).sort()).toEqual(["Ola", "Per"]);
    expect(log[0].winner).toBe("Ola");
    expect(log[1].winner).toBe("Per");
    expect(log[0].margin).toBeNull(); // nobody kept it
  });

  it("does not run two matches of the same two together", () => {
    // Per and Ola play again at once: the same side turns up twice in the window.
    const a = rec("Per", [entry("2026-10-10T18:00:00.100Z", true), entry("2026-10-10T18:00:05.100Z", true)]);
    const b = rec("Ola", [entry("2026-10-10T18:00:00.250Z", false), entry("2026-10-10T18:00:05.250Z", false)]);
    expect(buildMatchLog([a, b]).length).toBe(2);
  });

  it("lists a side with no record of its own, and gives the win to it when the others lost", () => {
    const a = rec("Per", [entry("2026-10-17T18:00:00.100Z", false, { matchId: "m1", vs: ["Bot 2"] })]);
    const log = buildMatchLog([a]);
    expect(log[0].sides.map((s) => [s.name, s.kind])).toEqual([["Per", "player"], ["Bot 2", "other"]]);
    expect(log[0].winner).toBe("Bot 2");
    expect(log[0].partial).toBe(true);
    const won = buildMatchLog([rec("Per", [entry("2026-10-17T18:00:00.100Z", true, { matchId: "m1", vs: ["Bot 2"] })])]);
    expect(won[0].winner).toBe("Per");
  });

  it("knows a team from a player", () => {
    const team = rec("Per & Ola", [entry("2026-10-17T18:00:00.100Z", true, { matchId: "m1", vs: ["Eva"] })], { kind: "team", members: ["Per", "Ola"] });
    const log = buildMatchLog([team]);
    expect(log[0].sides[0]).toMatchObject({ name: "Per & Ola", kind: "team", members: ["Per", "Ola"] });
  });

  it("is empty with no matches", () => {
    expect(buildMatchLog([rec("Per", [])])).toEqual([]);
  });
});
