import type { TurnAggregate } from "./game";
import type { BotLevel, TeamMember } from "./botLevels";
import type { GameVariant } from "./rules";
import type { CupConfig } from "./botCup";
// A circular import, on purpose: knockout.ts builds on this file's types and seeding, and recordMatchResult hands a knockout over to it.
// Both are only used when called, never while the modules load.
import { recordKnockoutResult } from "./knockout";
import { recordPilotResult } from "./pilot";

export type TournamentMode = "individual" | "team";

/** A tournament entrant — a real player/bot name in "individual" mode, or a team name whose
 *  `members` share one board and take turns physically throwing (see MikkeMusApp's game engine,
 *  which only ever sees the team's name as a single "player", but knows each member's identity
 *  and bot status for the internal turn rotation). Identified by `name` throughout — same
 *  convention the rest of this app already uses (see MikkeMusApp's `players: string[]`). */
export type Participant = {
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  /** A bot in a cup (lib/botCup.ts): its skill on the level scale, which the level of each match is worked out from. */
  skill?: number;
  /** Only set for a team participant — members can freely mix humans and bots. */
  members?: TeamMember[];
};

/** The special format of Ly Pilotturnering (lib/pilot.ts): which stage a match belongs to and where its players come from. */
export type PilotInfo = {
  stage: "heat" | "winners" | "losers" | "lucky" | "quarter" | "semi" | "final";
  label: string;
  /** Who fills the match: the finishing place (0 is first) in an earlier match. A heat has none, its players are drawn from the seeding. */
  slots?: { from: string; place: number }[];
};

export type TournamentMatch = {
  id: string;
  round: "group" | "bracket";
  groupIndex?: number;
  /** Number of matches originally in this bracket round (1=final, 2=semifinal/bronze,
   *  4=quarterfinal, larger=`${size}-delsfinale`) — see bracketRoundLabel. Unset for group matches. */
  bracketRoundSize?: number;
  isBronzeMatch?: boolean;
  /** Null participant = an unfilled bye slot, auto-resolved by resolveByes. */
  participantA: string | null;
  participantB: string | null;
  /** Set ONLY for a group-stage "pod" match with more than 2 people (see Tournament.matchSize) —
   *  participantA/B are unused then. Bracket matches never have this; the playoff is always
   *  1-vs-1, so makeBracketMatch/resolveByes/buildPlayoffBracket/advanceBracket are untouched by
   *  the multi-way case. */
  participants?: string[];
  /** Full finishing order (winner first) once the match is decided — set whenever the match is,
   *  regardless of participant count, so standings can treat 2-way and multi-way matches the same
   *  way. For a normal 2-player match this is just [winner, loser]. */
  placements?: string[];
  winner?: string;
  stats?: Record<string, TurnAggregate>;
  /** Set only by resolveByes — the "winner" here never actually played, so the UI must show this
   *  distinctly from a real result (see previewPlayoffBracket's own "(walkover videre)" wording). */
  isBye?: boolean;
  /** Knockout (lib/knockout.ts): the matches whose result fills each side of this one. A side with no feed is a seeded entrant. */
  feedA?: string;
  feedB?: string;
  /** What fills a side from its feed: the winner (the usual) or the loser (the bronze match). */
  feedKind?: "winner" | "loser";
  /** When the result was recorded — the latest of them is the one «Angre» takes back. */
  decidedAt?: string;
  /** 1 for the first result recorded, 2 for the next… — the order, which a clock reading cannot give for two results in the same moment. */
  decidedOrder?: number;
  /** Decided by the model and not thrown: a match between two bots in a cup (lib/botSim.ts). */
  simulated?: boolean;
  /** Set on every match of Ly Pilotturnering. */
  pilot?: PilotInfo;
  /** The game this match is played as, when it is not the tournament's own (forced rings from the quarter-finals of the pilot). */
  variant?: GameVariant;
};

export type Tournament = {
  id: string;
  mode: TournamentMode;
  participants: Participant[];
  /** Participant names per group. */
  groups: string[][];
  matches: TournamentMatch[];
  status: "group" | "playoff" | "done";
  winner?: string;
  createdAt: string;
  completedAt?: string;
  /** How many play together in one group-stage match — 2 (normal) or more, splitting each group
   *  into fixed pods of that size (see createTournament). The playoff is always 1-vs-1 regardless.
   *  Only ever >2 for "individual" mode. */
  matchSize: number;
  /** Which game every match in the tournament is played as — see lib/rules.ts. Absent on
   *  tournaments from before variants existed: standard. */
  variant?: GameVariant;
  /** Set when this is a cup against bots (lib/botCup.ts): its name, trophy and how the bots throw. */
  cup?: CupConfig;
  /** A name the players gave it ("Fredagsdart"); shown over the bracket and in the trophy cabinet. */
  name?: string;
  /** "knockout": a straight knockout, the whole bracket there from the start (lib/knockout.ts). Absent on the older tournaments with groups. */
  format?: "knockout" | "pilot";
  /** The seeding, strongest first — the order the bracket was drawn from. Knockout only. */
  seeds?: string[];
};

/** Every real name in a match, whether it's a normal/bracket match (participantA/B) or a
 *  group-stage pod with more than 2 people (participants) — the one place standings/UI code needs
 *  to read "who's in this match" without caring which shape it is. */
export function matchParticipants(m: TournamentMatch): string[] {
  if (m.participants) return m.participants;
  return [m.participantA, m.participantB].filter((p): p is string => !!p);
}

/** At or under this many, everyone plays in one group, so there is nothing for a group screen to
 *  decide and a tournament can be made without one. */
export const MAX_WITHOUT_GROUP_SCREEN = 4;

/** Distributes participants round-robin across `numGroups`, as evenly as possible. */
export function distributeEvenly(names: string[], numGroups: number): string[][] {
  const groups: string[][] = Array.from({ length: Math.max(1, numGroups) }, () => []);
  names.forEach((name, i) => groups[i % groups.length].push(name));
  return groups;
}

/** The initial grouping proposal shown on the adjustment screen — a starting point only, not
 *  persisted until the user confirms it (see TournamentGroupSetupScreen). Clamps so every group
 *  has at least 2 participants (a group of 1 can't play anyone). */
export function suggestGroups(names: string[], targetSize = 4): string[][] {
  const n = names.length;
  const maxGroups = Math.max(1, Math.floor(n / 2));
  const numGroups = Math.min(maxGroups, Math.max(1, Math.round(n / targetSize)));
  return distributeEvenly(names, numGroups);
}

/** Every unordered pair within a group — who plays whom, in no particular order (there's only
 *  one physical board, so match sequencing is left to the players, not scheduled here). */
export function roundRobinPairs(groupNames: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < groupNames.length; i++) {
    for (let j = i + 1; j < groupNames.length; j++) {
      pairs.push([groupNames[i], groupNames[j]]);
    }
  }
  return pairs;
}

export type StandingRow = {
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Average darts used across this participant's wins — lower is better. Null with no wins yet. */
  avgDartsPerWin: number | null;
};

function matchDarts(stats: Record<string, TurnAggregate> | undefined, name: string): number | null {
  const s = stats?.[name];
  return s ? s.hits + s.misses : null;
}

/** The finishing order for an already-decided match — `placements` when set (always is, once a
 *  match is recorded — see recordMatchResult), otherwise just [winner, everyone else] for old/
 *  simple 2-way matches that predate this field. */
function finishOrder(m: TournamentMatch): string[] {
  if (m.placements) return m.placements;
  if (!m.winner) return [];
  return [m.winner, ...matchParticipants(m).filter((p) => p !== m.winner)];
}

/** Points for finishing at `rank` (0-indexed) out of `total` — 1st always 2, last always 0,
 *  anyone in between (only possible with 3+ participants) gets 1. Matches the plain win=2/loss=0
 *  rule exactly when total is 2. */
function pointsForRank(rank: number, total: number): number {
  if (rank === 0) return 2;
  if (rank === total - 1) return 0;
  return 1;
}

function headToHead(a: string, b: string, matches: TournamentMatch[]): number {
  const m = matches.find((mm) => mm.winner && matchParticipants(mm).includes(a) && matchParticipants(mm).includes(b));
  if (!m) return 0;
  const order = finishOrder(m);
  const rankA = order.indexOf(a);
  const rankB = order.indexOf(b);
  if (rankA === -1 || rankB === -1 || rankA === rankB) return 0;
  return rankA < rankB ? -1 : 1;
}

/** Standings for one set of participants (a group, or the pool feeding a bracket seed) — ranked
 *  points per finishing position (1st=2, last=0, anyone between=1 — see pointsForRank), then
 *  fewest average darts per 1st-place finish, then head-to-head as tiebreaks. */
export function computeStandings(names: string[], matches: TournamentMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  names.forEach((name) => rows.set(name, { name, played: 0, wins: 0, losses: 0, points: 0, avgDartsPerWin: null }));
  const dartsSum = new Map<string, number>();
  const winCount = new Map<string, number>();

  for (const m of matches) {
    if (!m.winner) continue;
    const order = finishOrder(m);
    if (order.length < 2) continue;
    order.forEach((name, rank) => {
      const row = rows.get(name);
      if (!row) return;
      row.played += 1;
      row.points += pointsForRank(rank, order.length);
      if (rank === 0) {
        row.wins += 1;
        const darts = matchDarts(m.stats, name);
        if (darts !== null) {
          dartsSum.set(name, (dartsSum.get(name) ?? 0) + darts);
          winCount.set(name, (winCount.get(name) ?? 0) + 1);
        }
      } else {
        row.losses += 1;
      }
    });
  }

  rows.forEach((row) => {
    const sum = dartsSum.get(row.name);
    const wins = winCount.get(row.name);
    row.avgDartsPerWin = sum != null && wins ? sum / wins : null;
  });

  return Array.from(rows.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aAvg = a.avgDartsPerWin ?? Infinity;
    const bAvg = b.avgDartsPerWin ?? Infinity;
    if (aAvg !== bAvg) return aAvg - bAvg;
    return headToHead(a.name, b.name, matches);
  });
}

export type Podium = { first: string; second: string | null; third: string | null };

/**
 * First, second and third place of a finished tournament. With a playoff it is the final's winner
 * and loser and the bronze match's winner; with a single group it is the top of the table. Null
 * until the tournament is done. A place nobody earned — no bronze match in a two-player bracket,
 * a group where only two have played — is null rather than guessed.
 */
export function podium(t: Tournament): Podium | null {
  if (t.status !== "done" || !t.winner) return null;
  const bracket = t.matches.filter((m) => m.round === "bracket");
  if (bracket.length > 0) {
    const final = bracket.find((m) => m.bracketRoundSize === 1 && !m.isBronzeMatch);
    if (!final?.winner) return null;
    const runnerUp = final.participantA === final.winner ? final.participantB : final.participantA;
    const bronze = bracket.find((m) => m.isBronzeMatch);
    return { first: final.winner, second: runnerUp, third: bronze?.winner ?? null };
  }
  const standings = computeStandings(t.groups[0] ?? [], t.matches).filter((r) => r.played > 0);
  return {
    first: t.winner,
    second: standings.find((r) => r.name !== t.winner)?.name ?? null,
    third: standings.filter((r) => r.name !== t.winner)[1]?.name ?? null,
  };
}

export type MovementRow = StandingRow & {
  /** Places moved since before the match: positive is up the table. Null when the table before
   *  it had no real order to move from — see standingsWithMovement. */
  placesGained: number | null;
  /** Points this match gave them (0 for someone who was not in it). */
  pointsGained: number;
  /** In the match that was just played. */
  inMatch: boolean;
};

/**
 * The table as it stands, with what one match — the one just played — did to it.
 *
 * "Before" is the same table with that match's result taken out. A place is only called moved
 * when somebody had already played before it: with a table where nobody had, the order is just
 * how the names happened to be listed, and an arrow beside it would be inventing a story.
 */
export function standingsWithMovement(names: string[], matches: TournamentMatch[], justPlayedId: string | null): MovementRow[] {
  const after = computeStandings(names, matches);
  const justPlayed = justPlayedId ? matches.find((m) => m.id === justPlayedId) : undefined;
  if (!justPlayed || !justPlayed.winner) {
    return after.map((row) => ({ ...row, placesGained: null, pointsGained: 0, inMatch: false }));
  }
  const withoutIt = matches.map((m) => (m.id === justPlayedId ? { ...m, winner: undefined, placements: undefined, stats: undefined } : m));
  const before = computeStandings(names, withoutIt);
  const anyoneHadPlayed = before.some((r) => r.played > 0);
  const inMatch = new Set(matchParticipants(justPlayed));
  return after.map((row, rank) => {
    const was = before.findIndex((r) => r.name === row.name);
    const prior = before[was];
    return {
      ...row,
      placesGained: anyoneHadPlayed && was !== -1 ? was - rank : null,
      pointsGained: prior ? row.points - prior.points : 0,
      inMatch: inMatch.has(row.name),
    };
  });
}

/** Human-facing round name from its original match count — generalizes past quarterfinal
 *  (e.g. 8 → "8-delsfinale") so larger tournaments never hit an unlabeled round. */
export function bracketRoundLabel(size: number, isBronze?: boolean): string {
  if (isBronze) return "Bronsefinale";
  if (size === 1) return "Finale";
  if (size === 2) return "Semifinale";
  if (size === 4) return "Kvartfinale";
  // Eight matches are the eighth-finals (8-delsfinale), sixteen the sixteenth-finals.
  return `${size}-delsfinale`;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

/** Standard recursive tournament-bracket seeding order (1v8/4v5/2v7/3v6 for size 8, etc.) — seed
 *  `order[i]` (1-indexed) belongs at bracket slot `i`. */
export function bracketSeedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next: number[] = [];
    seeds.forEach((s) => next.push(s, n + 1 - s));
    seeds = next;
  }
  return seeds;
}

/** Fills in the winner for any match with exactly one real participant (a bye) — the present
 *  side advances without a real game. */
function resolveByes(matches: TournamentMatch[]): TournamentMatch[] {
  return matches.map((m) => {
    if (m.participantA && !m.participantB) return { ...m, winner: m.participantA, isBye: true };
    if (!m.participantA && m.participantB) return { ...m, winner: m.participantB, isBye: true };
    return m;
  });
}

function makeBracketMatch(a: string | null, b: string | null, size: number, index: number, isBronze = false): TournamentMatch {
  return {
    id: `bracket-${size}-${index}${isBronze ? "-bronze" : ""}`,
    round: "bracket",
    bracketRoundSize: size,
    isBronzeMatch: isBronze,
    participantA: a,
    participantB: b,
  };
}

/**
 * Builds the first playoff round from group standings — top 2 per group (or top 1 if a group has
 * only 2 members), seeded into a single-elimination bracket sized to the next power of 2, cross-
 * group (group winners kept apart, same as standard tournament seeding). Returns an empty array
 * when there's only one group — that group's table decides the tournament directly.
 */
export function buildPlayoffBracket(groups: string[][], matchesSoFar: TournamentMatch[]): TournamentMatch[] {
  if (groups.length < 2) return [];

  const perGroupStandings = groups.map((g) => computeStandings(g, matchesSoFar));
  const minGroupSize = Math.min(...groups.map((g) => g.length));
  const advancePerGroup = Math.min(2, minGroupSize);

  const advancers: string[] = [];
  for (let rank = 0; rank < advancePerGroup; rank++) {
    perGroupStandings.forEach((standing) => {
      if (standing[rank]) advancers.push(standing[rank].name);
    });
  }

  const size = nextPowerOfTwo(advancers.length);
  const order = bracketSeedOrder(size);
  const slots: (string | null)[] = order.map((seed) => advancers[seed - 1] ?? null);

  const roundMatches: TournamentMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    roundMatches.push(makeBracketMatch(slots[i], slots[i + 1] ?? null, slots.length / 2, i / 2));
  }
  return resolveByes(roundMatches);
}

export type BracketPreviewMatch = { labelA: string; labelB: string | null };
export type BracketPreview = {
  advancePerGroup: number;
  bracketSize: number;
  byes: number;
  /** The first round's own matchups, seeded the same way buildPlayoffBracket eventually will. */
  matches: BracketPreviewMatch[];
  /** Round labels AFTER the first round, in order (e.g. ["Semifinale", "Finale"]) — later rounds'
   *  actual matchups can't be previewed since they depend on who wins the first round. */
  laterRoundLabels: string[];
  hasBronzeMatch: boolean;
};

/**
 * Same seeding `buildPlayoffBracket` will eventually use, but with placeholder labels ("Vinner
 * gruppe 1", "Nr. 2 gruppe 2") instead of real names — lets the overview screen show how the
 * playoff will be shaped before the group stage (and therefore the real advancers) is decided.
 * Returns null when there's only one group (no playoff at all — the table decides directly).
 */
export function previewPlayoffBracket(groups: string[][]): BracketPreview | null {
  if (groups.length < 2) return null;

  const minGroupSize = Math.min(...groups.map((g) => g.length));
  const advancePerGroup = Math.min(2, minGroupSize);

  const placeholders: string[] = [];
  for (let rank = 0; rank < advancePerGroup; rank++) {
    groups.forEach((_, gi) => {
      placeholders.push(rank === 0 ? `Vinner gruppe ${gi + 1}` : `Nr. ${rank + 1} gruppe ${gi + 1}`);
    });
  }

  const size = nextPowerOfTwo(placeholders.length);
  const order = bracketSeedOrder(size);
  const slots: (string | null)[] = order.map((seed) => placeholders[seed - 1] ?? null);

  const matches: BracketPreviewMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    matches.push({ labelA: slots[i] ?? "Bye", labelB: slots[i + 1] });
  }

  const laterRoundLabels: string[] = [];
  for (let s = size / 4; s >= 1; s /= 2) {
    laterRoundLabels.push(bracketRoundLabel(s));
  }

  return {
    advancePerGroup,
    bracketSize: size,
    byes: size - placeholders.length,
    matches,
    laterRoundLabels,
    hasBronzeMatch: size >= 4,
  };
}

/** Advances the bracket once a round is fully resolved — pairs up winners into the next round,
 *  spins off the bronze match from the semifinal's losers, and marks the tournament done once the
 *  final has a winner. Safe to call speculatively (no-ops if nothing is ready to advance yet). */
function advanceBracket(t: Tournament): Tournament {
  const bracket = t.matches.filter((m) => m.round === "bracket");
  const roundSizes = Array.from(new Set(bracket.map((m) => m.bracketRoundSize!))).sort((a, b) => b - a);

  for (const size of roundSizes) {
    const roundMatches = bracket.filter((m) => m.bracketRoundSize === size && !m.isBronzeMatch);
    if (roundMatches.some((m) => !m.winner)) return t; // this round isn't finished yet

    const nextSize = size / 2;
    if (nextSize < 1) continue; // this was the final
    const nextAlreadyExists = bracket.some((m) => m.bracketRoundSize === nextSize && !m.isBronzeMatch);
    if (nextAlreadyExists) continue;

    const winners = roundMatches.map((m) => m.winner!);
    const newMatches: TournamentMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      newMatches.push(makeBracketMatch(winners[i], winners[i + 1] ?? null, nextSize, i / 2));
    }
    if (size === 2) {
      const losers = roundMatches.map((m) => (m.winner === m.participantA ? m.participantB : m.participantA));
      if (losers[0] && losers[1]) newMatches.push(makeBracketMatch(losers[0], losers[1], 2, 0, true));
    }
    const advanced: Tournament = { ...t, matches: [...t.matches, ...resolveByes(newMatches)] };
    return advanceBracket(advanced); // cascade through any further all-bye rounds immediately
  }

  const final = bracket.find((m) => m.bracketRoundSize === 1);
  if (final?.winner) {
    return { ...t, status: "done", winner: final.winner, completedAt: new Date().toISOString() };
  }
  return t;
}

/** Builds a brand-new tournament: group-stage matches generated immediately, playoff added once
 *  the group stage completes (see recordMatchResult). `matchSize` > 2 splits each group into fixed
 *  pods of that size (as evenly as possible, via the same distributeEvenly used for groups
 *  themselves) instead of the normal round-robin pairs — one shared-board match per pod. */
export function createTournament(
  mode: TournamentMode,
  participants: Participant[],
  groups: string[][],
  id: string,
  createdAt: string,
  matchSize = 2,
  variant: GameVariant = "standard",
  cup?: CupConfig
): Tournament {
  const matches: TournamentMatch[] = [];
  groups.forEach((group, groupIndex) => {
    if (matchSize <= 2) {
      roundRobinPairs(group).forEach(([a, b], i) => {
        matches.push({ id: `group-${groupIndex}-${i}`, round: "group", groupIndex, participantA: a, participantB: b });
      });
    } else {
      // round(), not floor() — same "closest to target size" idiom suggestGroups already uses,
      // so e.g. 5 people at matchSize 3 gives 2 pods (3+2) instead of one oversized pod of 5.
      const numPods = Math.max(1, Math.round(group.length / matchSize));
      distributeEvenly(group, numPods).forEach((pod, pi) => {
        matches.push({ id: `group-${groupIndex}-pod-${pi}`, round: "group", groupIndex, participantA: null, participantB: null, participants: pod });
      });
    }
  });
  return { id, mode, participants, groups, matches, status: "group", createdAt, matchSize, variant, ...(cup ? { cup } : {}) };
}

/** Pure reducer: records one match's result and advances the tournament to its next stage
 *  (group → playoff, or one bracket round → the next) whenever that stage just completed.
 *  `placements` is the full finishing order (winner first) — for a plain 2-player match the
 *  caller passes [winner, loser], which is exactly what MikkeMusApp always computes anyway. */
export function recordMatchResult(tournament: Tournament, matchId: string, placements: string[], stats: Record<string, TurnAggregate>): Tournament {
  if (tournament.format === "knockout") return recordKnockoutResult(tournament, matchId, placements, stats);
  if (tournament.format === "pilot") return recordPilotResult(tournament, matchId, placements, stats);
  const matches = tournament.matches.map((m) => (m.id === matchId ? { ...m, winner: placements[0], placements, stats } : m));
  let next: Tournament = { ...tournament, matches };

  if (next.status === "group") {
    const groupMatches = matches.filter((m) => m.round === "group");
    if (groupMatches.every((m) => m.winner)) {
      const bracket = buildPlayoffBracket(next.groups, matches);
      if (bracket.length === 0) {
        const standings = computeStandings(next.groups[0], matches);
        next = { ...next, status: "done", winner: standings[0]?.name, completedAt: new Date().toISOString() };
      } else {
        next = advanceBracket({ ...next, status: "playoff", matches: [...matches, ...bracket] });
      }
    }
    return next;
  }

  if (next.status === "playoff") {
    return advanceBracket(next);
  }
  return next;
}

/** What the tournament is called on screen: the name it was given, else the cup's, else just "Turnering". */
export function tournamentTitle(t: Pick<Tournament, "name" | "cup">): string {
  return t.name?.trim() || t.cup?.name || "Turnering";
}
