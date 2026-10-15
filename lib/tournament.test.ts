import { describe, expect, it } from "vitest";
import { buildPlayoffBracket, createTournament, podium, standingsWithMovement, type Participant, type Tournament, type TournamentMatch } from "./tournament";

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

describe("standingsWithMovement — what one match did to the table", () => {
  const names = ["A", "B", "C"];
  const played = (id: string, a: string, b: string, winner: string): TournamentMatch => ({
    id,
    round: "group",
    groupIndex: 0,
    participantA: a,
    participantB: b,
    winner,
    placements: [winner, winner === a ? b : a],
  });
  const open = (id: string, a: string, b: string): TournamentMatch => ({ id, round: "group", groupIndex: 0, participantA: a, participantB: b });

  it("says nothing moved when the very first match of a group has just been played", () => {
    const matches = [played("m1", "A", "B", "A"), open("m2", "A", "C"), open("m3", "B", "C")];
    const rows = standingsWithMovement(names, matches, "m1");
    // Nobody had played before, so the order before was only the order of the names.
    rows.forEach((r) => expect(r.placesGained).toBeNull());
    expect(rows.find((r) => r.name === "A")).toMatchObject({ pointsGained: 2, inMatch: true });
    expect(rows.find((r) => r.name === "B")).toMatchObject({ pointsGained: 0, inMatch: true });
    expect(rows.find((r) => r.name === "C")).toMatchObject({ pointsGained: 0, inMatch: false });
  });

  it("reports places gained and lost, and points, once there is a real order to move from", () => {
    // Before m2: A beat B, so A 2p, B 0p, C 0p. In m2 C beats A: C 2p, A 2p, B 0p.
    const matches = [played("m1", "A", "B", "A"), played("m2", "A", "C", "C"), open("m3", "B", "C")];
    const rows = standingsWithMovement(names, matches, "m2");
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName.C.pointsGained).toBe(2);
    expect(byName.A.pointsGained).toBe(0);
    expect(byName.B.pointsGained).toBe(0);
    expect(byName.C.placesGained).not.toBeNull();
    // Everyone who did not play moves only because others did; the numbers must add up to zero.
    const total = rows.reduce((sum, r) => sum + (r.placesGained ?? 0), 0);
    expect(total).toBe(0);
  });

  it("returns the plain table, unmarked, when there is no match to compare against", () => {
    const matches = [played("m1", "A", "B", "A")];
    for (const id of [null, "nonexistent"]) {
      const rows = standingsWithMovement(names, matches, id);
      rows.forEach((r) => expect(r).toMatchObject({ placesGained: null, pointsGained: 0, inMatch: false }));
    }
    const undecided = standingsWithMovement(names, [open("m1", "A", "B")], "m1");
    undecided.forEach((r) => expect(r.placesGained).toBeNull());
  });
});

describe("podium", () => {
  const done = (over: Partial<Tournament>): Tournament => ({
    id: "t",
    mode: "individual",
    participants: [],
    groups: [["A", "B", "C"]],
    matches: [],
    status: "done",
    winner: "A",
    createdAt: "2026-01-01",
    matchSize: 2,
    ...over,
  });
  const result = (id: string, a: string, b: string, winner: string): TournamentMatch => ({
    id,
    round: "group",
    groupIndex: 0,
    participantA: a,
    participantB: b,
    winner,
    placements: [winner, winner === a ? b : a],
  });

  it("is null until the tournament is done", () => {
    expect(podium(done({ status: "group" }))).toBeNull();
    expect(podium(done({ winner: undefined }))).toBeNull();
  });

  it("takes the top three of the table when there is a single group", () => {
    const t = done({ matches: [result("1", "A", "B", "A"), result("2", "A", "C", "A"), result("3", "B", "C", "B")] });
    expect(podium(t)).toEqual({ first: "A", second: "B", third: "C" });
  });

  it("gives a place only to those who played, and leaves the rest empty", () => {
    const t = done({ groups: [["A", "B"]], matches: [result("1", "A", "B", "A")] });
    expect(podium(t)).toEqual({ first: "A", second: "B", third: null });
  });

  it("uses the final and the bronze match when there is a playoff", () => {
    const bracket = (id: string, size: number, a: string, b: string, winner: string, bronze = false): TournamentMatch => ({
      id,
      round: "bracket",
      bracketRoundSize: size,
      isBronzeMatch: bronze,
      participantA: a,
      participantB: b,
      winner,
    });
    const t = done({
      groups: [["A", "B"], ["C", "D"]],
      matches: [bracket("sf1", 2, "A", "D", "A"), bracket("sf2", 2, "C", "B", "B"), bracket("f", 1, "A", "B", "B"), bracket("br", 2, "D", "C", "C", true)],
      winner: "B",
    });
    expect(podium(t)).toEqual({ first: "B", second: "A", third: "C" });
  });

  it("has no third place in a bracket without a bronze match", () => {
    const final: TournamentMatch = { id: "f", round: "bracket", bracketRoundSize: 1, isBronzeMatch: false, participantA: "A", participantB: "B", winner: "A" };
    expect(podium(done({ groups: [["A"], ["B"]], matches: [final], winner: "A" }))).toEqual({ first: "A", second: "B", third: null });
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
