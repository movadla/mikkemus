import { describe, expect, it } from "vitest";
import { bestWinDarts, groupBestWin } from "./bestWin";
import { emptyRecord, type MatchHistoryEntry } from "./playerRows";

const m = (won: boolean, dartsUsed: number): MatchHistoryEntry => ({ date: "2026-10-01", won, dartsUsed, hitPct: 50, med: null, mhd: null, mvd: null });

describe("bestWinDarts", () => {
  it("ignores a «win» on fewer darts than a board can take, and reads the record off the possible ones", () => {
    const rec = { ...emptyRecord("Vadla"), bestDartsToFinish: 3, matchHistory: [m(true, 3), m(true, 41), m(false, 30), m(true, 48)] };
    expect(bestWinDarts(rec)).toBe(41);
  });
  it("trusts the stored figure when it is possible, even without the match on record", () => {
    expect(bestWinDarts({ ...emptyRecord("Per"), bestDartsToFinish: 40, matchHistory: [m(true, 48)] })).toBe(40);
  });
  it("is null with nothing possible to go on", () => {
    expect(bestWinDarts({ ...emptyRecord("Per"), bestDartsToFinish: 3, matchHistory: [m(false, 50)] })).toBeNull();
    expect(bestWinDarts(emptyRecord("Per"))).toBeNull();
  });
});

describe("groupBestWin", () => {
  const per = { ...emptyRecord("Per"), matchHistory: [m(true, 48)] };
  const ola = { ...emptyRecord("Ola"), bestDartsToFinish: 41, matchHistory: [m(true, 41)] };
  const team = { ...emptyRecord("Per & Ola"), kind: "team" as const, members: ["Per", "Ola"], matchHistory: [m(true, 60)] };
  it("picks the fewest among the players for a match played alone, and among the teams for a team match", () => {
    expect(groupBestWin([per, ola, team], "player")).toEqual({ darts: 41, who: "Ola" });
    expect(groupBestWin([per, ola, team], "team")).toEqual({ darts: 60, who: "Per & Ola" });
  });
  it("is null when nobody of the kind has won", () => {
    expect(groupBestWin([per], "team")).toBeNull();
  });
});
