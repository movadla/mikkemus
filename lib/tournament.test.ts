import { describe, expect, it } from "vitest";
import { buildPlayoffBracket, createTournament, type Participant, type TournamentMatch } from "./tournament";

function participant(name: string): Participant {
  return { name, isBot: false };
}

describe("createTournament pod sizing", () => {
  it("splits a group of 5 into pods of 3 and 2 when matchSize is 3", () => {
    const group = ["A", "B", "C", "D", "E"];
    const t = createTournament("individual", group.map(participant), [group], "t1", "2026-01-01", 3);
    const podSizes = t.matches.map((m) => m.participants!.length).sort();
    expect(podSizes).toEqual([2, 3]);
  });

  it("keeps a group of 4 as a single pod when matchSize is 3", () => {
    const group = ["A", "B", "C", "D"];
    const t = createTournament("individual", group.map(participant), [group], "t1", "2026-01-01", 3);
    expect(t.matches).toHaveLength(1);
    expect(t.matches[0].participants).toHaveLength(4);
  });

  it("still produces normal 1-vs-1 round robin pairs when matchSize is 2", () => {
    const group = ["A", "B", "C"];
    const t = createTournament("individual", group.map(participant), [group], "t1", "2026-01-01", 2);
    expect(t.matches).toHaveLength(3);
    t.matches.forEach((m) => {
      expect(m.participants).toBeUndefined();
      expect(m.participantA).toBeTruthy();
      expect(m.participantB).toBeTruthy();
    });
  });
});

describe("buildPlayoffBracket byes", () => {
  it("marks a bye match with isBye and a winner, unlike a still-undecided real pairing", () => {
    const groups = [
      ["A1", "A2"],
      ["B1", "B2"],
      ["C1", "C2"],
    ];
    // One decided match per group gives computeStandings a winner+loser to rank, so both
    // members of every group are eligible to "advance" (advancePerGroup = min(2, groupSize) = 2).
    const matchesSoFar: TournamentMatch[] = groups.map((g, gi) => ({
      id: `group-${gi}-0`,
      round: "group",
      groupIndex: gi,
      participantA: g[0],
      participantB: g[1],
      winner: g[0],
      placements: [g[0], g[1]],
    }));

    const bracket = buildPlayoffBracket(groups, matchesSoFar);
    const byeMatches = bracket.filter((m) => m.isBye);
    const realMatches = bracket.filter((m) => !m.isBye);

    expect(byeMatches.length).toBeGreaterThan(0);
    byeMatches.forEach((m) => expect(m.winner).toBeTruthy());
    expect(realMatches.some((m) => !m.winner)).toBe(true);
  });
});
