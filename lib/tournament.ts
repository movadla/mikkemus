import type { TurnAggregate } from "./game";
import type { BotLevel, TeamMember } from "./botLevels";

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
  /** Only set for a team participant — members can freely mix humans and bots. */
  members?: TeamMember[];
};

export type TournamentMatch = {
  id: string;
  round: "group" | "bracket";
  groupIndex?: number;
  /** Number of matches originally in this bracket round (1=final, 2=semifinal/bronze,
   *  4=quarterfinal, larger=`Runde av ${size*2}`) — see bracketRoundLabel. Unset for group matches. */
  bracketRoundSize?: number;
  isBronzeMatch?: boolean;
  /** Null participant = an unfilled bye slot, auto-resolved by resolveByes. */
  participantA: string | null;
  participantB: string | null;
  winner?: string;
  stats?: Record<string, TurnAggregate>;
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
};

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

function headToHead(a: string, b: string, matches: TournamentMatch[]): number {
  const m = matches.find(
    (mm) => mm.winner && ((mm.participantA === a && mm.participantB === b) || (mm.participantA === b && mm.participantB === a))
  );
  if (!m?.winner) return 0;
  return m.winner === a ? -1 : 1;
}

/** Standings for one set of participants (a group, or the pool feeding a bracket seed) —
 *  points (win=2/loss=0, no draws exist in Mikke Mus), then fewest average darts per win, then
 *  head-to-head as tiebreaks. */
export function computeStandings(names: string[], matches: TournamentMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  names.forEach((name) => rows.set(name, { name, played: 0, wins: 0, losses: 0, points: 0, avgDartsPerWin: null }));
  const dartsSum = new Map<string, number>();
  const winCount = new Map<string, number>();

  for (const m of matches) {
    if (!m.winner || !m.participantA || !m.participantB) continue;
    const loser = m.winner === m.participantA ? m.participantB : m.participantA;
    const winnerRow = rows.get(m.winner);
    const loserRow = rows.get(loser);
    if (winnerRow) {
      winnerRow.played += 1;
      winnerRow.wins += 1;
      winnerRow.points += 2;
      const darts = matchDarts(m.stats, m.winner);
      if (darts !== null) {
        dartsSum.set(m.winner, (dartsSum.get(m.winner) ?? 0) + darts);
        winCount.set(m.winner, (winCount.get(m.winner) ?? 0) + 1);
      }
    }
    if (loserRow) {
      loserRow.played += 1;
      loserRow.losses += 1;
    }
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

/** Human-facing round name from its original match count — generalizes past quarterfinal
 *  (e.g. 8 → "Runde av 16") so larger tournaments never hit an unlabeled round. */
export function bracketRoundLabel(size: number, isBronze?: boolean): string {
  if (isBronze) return "Bronsefinale";
  if (size === 1) return "Finale";
  if (size === 2) return "Semifinale";
  if (size === 4) return "Kvartfinale";
  return `Runde av ${size * 2}`;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

/** Standard recursive tournament-bracket seeding order (1v8/4v5/2v7/3v6 for size 8, etc.) — seed
 *  `order[i]` (1-indexed) belongs at bracket slot `i`. */
function bracketSeedOrder(size: number): number[] {
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
    if (m.participantA && !m.participantB) return { ...m, winner: m.participantA };
    if (!m.participantA && m.participantB) return { ...m, winner: m.participantB };
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
 *  the group stage completes (see recordMatchResult). */
export function createTournament(mode: TournamentMode, participants: Participant[], groups: string[][], id: string, createdAt: string): Tournament {
  const matches: TournamentMatch[] = [];
  groups.forEach((group, groupIndex) => {
    roundRobinPairs(group).forEach(([a, b], i) => {
      matches.push({ id: `group-${groupIndex}-${i}`, round: "group", groupIndex, participantA: a, participantB: b });
    });
  });
  return { id, mode, participants, groups, matches, status: "group", createdAt };
}

/** Pure reducer: records one match's result and advances the tournament to its next stage
 *  (group → playoff, or one bracket round → the next) whenever that stage just completed. */
export function recordMatchResult(tournament: Tournament, matchId: string, winner: string, stats: Record<string, TurnAggregate>): Tournament {
  const matches = tournament.matches.map((m) => (m.id === matchId ? { ...m, winner, stats } : m));
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
