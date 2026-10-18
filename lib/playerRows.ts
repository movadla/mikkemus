import { STEPS, type Step } from "./game";
import type { TeamKits } from "./teamKit";
import type { WalkOnChoice } from "./fanfare";

/**
 * The shape of a row in the `players` table and how it maps to a PlayerRecord — pulled out of
 * lib/storage.ts so it can be used without a browser: the merge script that turns pair-named
 * "players" into teams works on these rows directly.
 */

export type HitStat = { hits: number; misses: number };

/** Running totals behind the MED/MHD/MVD career stats — see lib/dartboard.ts for what they measure. */
export type AccuracyStat = { sumDistance: number; sumHorizontal: number; sumVertical: number; throws: number };

/** Running total behind one section's "Expected Goals" mean (expected crosses per dart) — see lib/dartboard.ts. */
export type LuckStat = { sum: number; count: number };

/** Career totals behind Bull-duell's kast/poeng/treff%/xG stats — see
 *  lib/bullDuel.ts. `redHits`/`greenHits` back the rødt/grønt drilldown. */
export type BullDuelStat = { throws: number; points: number; redHits: number; greenHits: number; luckSum: number; luckCount: number };

/** Keyed by the number (1–20) as a string — how many times a Triple or Double of that number has landed, regardless of how the game ended up scoring it. */
export type RingHits = Record<string, number>;

/** One completed match's own numbers, for the "over time" trend on a player's stats page — separate from the cumulative career totals above. */
export type MatchHistoryEntry = {
  date: string;
  /** Which match this was and who the other sides were (also bots and guests, who have no record of their own), so
   *  the matches can be listed as matches. Absent on matches from before they were kept. */
  matchId?: string;
  vs?: string[];
  /** Crosses this side still lacked when the match ended: the margin of a win, or how far a loss was from it. */
  left?: number;
  /** Crosses and misses per row in this match: [hits, misses]. */
  steps?: Partial<Record<Step, [number, number]>>;
  won: boolean;
  dartsUsed: number;
  /** The share of crosses among crosses and misses, 0–100, as every screen reads «treff». Matches from before
   *  `cpd` existed hold crosses per dart here (use shownHitPct). */
  hitPct: number;
  /** Crosses per dart, in percent: what the odds read the hit rate as (a triple is three crosses from one dart,
   *  so it can pass 100). Absent on older matches, where hitPct held it. */
  cpd?: number;
  /** This match's own MED/MHD/MVD — null if Scolia didn't detect any throws this match (manual-only play). */
  med: number | null;
  mhd: number | null;
  mvd: number | null;
  /** What the odds are built on (lib/odds): the darts measured, their summed distance and summed
   *  squared distance. Absent on matches from before they were kept. */
  throws?: number;
  sumR?: number;
  sumR2?: number;
  /** In a team's match, the same per member — the team's record is where the match lives, but each
   *  member's own skill is what the odds need. */
  byMember?: Record<string, { throws: number; sumR: number; sumR2: number }>;
};

/**
 * What one person on a team has done over every match the team has played, kept on the team's record
 * since that is where the matches live. `throws`/`sumR` are the Scolia-measured darts and their summed
 * distance from the target (MED = sumR / throws), absent as 0 when a match was played without Scolia.
 */
export type MemberStat = {
  matches: number;
  turns: number;
  darts: number;
  hits: number;
  misses: number;
  steps: Record<Step, HitStat>;
  /** Longest run of counting darts, in darts. */
  bestRun: number;
  throws: number;
  sumR: number;
};

/**
 * A player, or a team. A team is two or more players who play as one side; it has the same
 * statistics as a player (its matches are recorded against the team, not its members) and
 * remembers who is in it. Before teams had a record of their own, people made a "player" called
 * "Vadla & Hans" to get a team name — which is what those rows become.
 */
export type RecordKind = "player" | "team";

export type PlayerRecord = {
  name: string;
  kind: RecordKind;
  /** The people in a team, in playing order. Absent on a player. */
  members?: string[];
  /** A team's home and away shirt — its own, fixed, and changeable in the settings. Absent on a
   *  player, and on a team from before shirts were stored (those get defaultKits on next play). */
  kits?: TeamKits;
  /** The tune played when this team is up (Full party). Absent until one has been chosen. */
  walkOn?: WalkOnChoice;
  photo?: string;
  /** A short recorded clip (data URL), played when it becomes this player's turn. */
  sound?: string;
  matchesPlayed: number;
  /** Matches this player actually finished (won) — the only matches where a
   *  "darts to finish" number even makes sense. */
  matchesWon: number;
  /** Sum of hits+misses across every match this player has won. */
  dartsInWins: number;
  /** Fewest darts used in any single won match. Null until the first win. */
  bestDartsToFinish: number | null;
  /** Longest unbroken run of counting darts in any match, in darts (see lib/turnStats.ts). Absent
   *  until a match has been played with it tracked. */
  bestRun?: number;
  overall: HitStat;
  steps: Record<Step, HitStat>;
  accuracy: AccuracyStat;
  luck: Record<Step, LuckStat>;
  bullDuel: BullDuelStat;
  tripleHits: RingHits;
  doubleHits: RingHits;
  matchHistory: MatchHistoryEntry[];
  /** A team's members, each with their own totals. Absent on a player and until a team match has been played. */
  memberStats?: Record<string, MemberStat>;
  /** The Elo rating (lib/rating.ts), and how many matches it has been through. Absent until a rated match; then the start rating applies. */
  rating?: number;
  ratedMatches?: number;
};

export type PlayerRow = {
  id: string;
  name: string;
  photo: string | null;
  sound: string | null;
  matches_played: number;
  matches_won: number;
  darts_in_wins: number;
  overall_hits: number;
  overall_misses: number;
  steps: Record<Step, HitStat>;
  accuracy_sum_distance: number | null;
  accuracy_sum_horizontal: number | null;
  accuracy_sum_vertical: number | null;
  accuracy_throws: number | null;
  // Superseded by the `luck` column below (per-section breakdown) — left in
  // place as harmless dead columns rather than a destructive migration.
  luck_sum: number | null;
  luck_count: number | null;
  luck: Partial<Record<Step, LuckStat>> | null;
  bull_duel: BullDuelStat | null;
  best_darts_to_finish: number | null;
  triple_hits: RingHits | null;
  double_hits: RingHits | null;
  match_history: MatchHistoryEntry[] | null;
  /** "player" or "team". Nullable columns added after the table (see supabase-setup-teams.sql);
   *  a row from before they existed is a player. Written only for a team, so saving a player keeps
   *  working on a database where the columns have not been added yet. */
  kind?: string | null;
  members?: string[] | null;
  kits?: TeamKits | null;
  /** Nullable column (supabase-setup-teams.sql); written only once a tune has been chosen, so saving
   *  keeps working on a database that does not have it yet. */
  walk_on?: string | null;
  /** Nullable column added later (supabase-setup-teams.sql); written only once there is a value, so
   *  saving keeps working on a database that does not have it yet. */
  best_run?: number | null;
  /** Nullable jsonb column (supabase-setup-teams.sql); written only once a team has member stats. */
  member_stats?: Record<string, MemberStat> | null;
  /** Nullable columns (supabase-setup-teams.sql); written only once there is a rating. */
  rating?: number | null;
  rated_matches?: number | null;
};

export function emptyStepStats(): Record<Step, HitStat> {
  const s = {} as Record<Step, HitStat>;
  STEPS.forEach((step) => (s[step] = { hits: 0, misses: 0 }));
  return s;
}

export function emptyAccuracyStat(): AccuracyStat {
  return { sumDistance: 0, sumHorizontal: 0, sumVertical: 0, throws: 0 };
}

export function emptyLuckStat(): LuckStat {
  return { sum: 0, count: 0 };
}

/** Same per-section breakdown as `steps: Record<Step, HitStat>` — one running xG total per section, not just one overall mean. */
export function emptyLuckByStep(): Record<Step, LuckStat> {
  const s = {} as Record<Step, LuckStat>;
  STEPS.forEach((step) => (s[step] = emptyLuckStat()));
  return s;
}

export function emptyBullDuelStat(): BullDuelStat {
  return { throws: 0, points: 0, redHits: 0, greenHits: 0, luckSum: 0, luckCount: 0 };
}

export function emptyRecord(name: string, kind: RecordKind = "player", members?: string[]): PlayerRecord {
  return {
    name: name.trim(),
    kind,
    ...(kind === "team" ? { members: members ?? [] } : {}),
    matchesPlayed: 0,
    matchesWon: 0,
    dartsInWins: 0,
    bestDartsToFinish: null,
    overall: { hits: 0, misses: 0 },
    steps: emptyStepStats(),
    accuracy: emptyAccuracyStat(),
    luck: emptyLuckByStep(),
    bullDuel: emptyBullDuelStat(),
    tripleHits: {},
    doubleHits: {},
    matchHistory: [],
  };
}

/** The row id: the name, trimmed and lowercased. */
export function recordKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Rows written before the `luck` column existed (or missing individual sections within it) fall back per-section, same convention as emptyStepStats. */
function luckByStepFromRow(row: PlayerRow): Record<Step, LuckStat> {
  const luck = {} as Record<Step, LuckStat>;
  STEPS.forEach((step) => {
    luck[step] = { sum: row.luck?.[step]?.sum ?? 0, count: row.luck?.[step]?.count ?? 0 };
  });
  return luck;
}

export function rowToRecord(row: PlayerRow): PlayerRecord {
  const kind: RecordKind = row.kind === "team" ? "team" : "player";
  return {
    name: row.name,
    kind,
    ...(kind === "team" ? { members: Array.isArray(row.members) ? row.members.filter((m) => typeof m === "string") : [] } : {}),
    ...((row.walk_on === "fanfare" || row.walk_on === "rock" || row.walk_on === "disco" || row.walk_on === "none") ? { walkOn: row.walk_on } : {}),
    ...(row.kits?.home && row.kits?.away ? { kits: { home: row.kits.home, away: row.kits.away } } : {}),
    photo: row.photo ?? undefined,
    sound: row.sound ?? undefined,
    matchesPlayed: row.matches_played,
    matchesWon: row.matches_won,
    dartsInWins: row.darts_in_wins,
    overall: { hits: row.overall_hits, misses: row.overall_misses },
    // A row written before a step existed in the table default has it missing — fall back per step.
    steps: STEPS.reduce((acc, step) => ({ ...acc, [step]: row.steps?.[step] ?? { hits: 0, misses: 0 } }), {} as Record<Step, HitStat>),
    // Rows written before the accuracy columns existed have them as null.
    accuracy: {
      sumDistance: row.accuracy_sum_distance ?? 0,
      sumHorizontal: row.accuracy_sum_horizontal ?? 0,
      sumVertical: row.accuracy_sum_vertical ?? 0,
      throws: row.accuracy_throws ?? 0,
    },
    luck: luckByStepFromRow(row),
    // Rows written before the bull_duel column existed (or with an empty
    // '{}' default, or from before the points/redHits/greenHits fields
    // replaced the old "hits" count) have some/all fields missing — fall
    // back per-field. Old "hits" data isn't migrated into points (a count
    // and a point-sum aren't the same number) — it's simply reset to 0.
    bullDuel: {
      throws: row.bull_duel?.throws ?? 0,
      points: row.bull_duel?.points ?? 0,
      redHits: row.bull_duel?.redHits ?? 0,
      greenHits: row.bull_duel?.greenHits ?? 0,
      luckSum: row.bull_duel?.luckSum ?? 0,
      luckCount: row.bull_duel?.luckCount ?? 0,
    },
    bestDartsToFinish: row.best_darts_to_finish ?? null,
    ...(row.best_run ? { bestRun: row.best_run } : {}),
    tripleHits: row.triple_hits ?? {},
    doubleHits: row.double_hits ?? {},
    matchHistory: row.match_history ?? [],
    ...(kind === "team" && row.member_stats && typeof row.member_stats === "object" ? { memberStats: row.member_stats } : {}),
    ...(typeof row.rating === "number" ? { rating: row.rating, ratedMatches: row.rated_matches ?? 0 } : {}),
  };
}

export function recordToRow(k: string, record: PlayerRecord): PlayerRow {
  return {
    id: k,
    name: record.name,
    photo: record.photo ?? null,
    sound: record.sound ?? null,
    matches_played: record.matchesPlayed,
    matches_won: record.matchesWon,
    darts_in_wins: record.dartsInWins,
    overall_hits: record.overall.hits,
    overall_misses: record.overall.misses,
    steps: record.steps,
    accuracy_sum_distance: record.accuracy.sumDistance,
    accuracy_sum_horizontal: record.accuracy.sumHorizontal,
    accuracy_sum_vertical: record.accuracy.sumVertical,
    accuracy_throws: record.accuracy.throws,
    // Dead columns, superseded by the per-section `luck` below — but they're NOT NULL in
    // the table, so writing null here made EVERY write to `players` fail wholesale
    // ("null value in column luck_sum violates not-null constraint"), silently killing all
    // stat saving from 2026-08-22 until this was found. Written as 0 rather than dropped
    // from the payload, since an insert can't rely on a default that may not exist.
    luck_sum: 0,
    luck_count: 0,
    luck: record.luck,
    bull_duel: record.bullDuel,
    best_darts_to_finish: record.bestDartsToFinish,
    triple_hits: record.tripleHits,
    double_hits: record.doubleHits,
    match_history: record.matchHistory,
    ...(record.bestRun ? { best_run: record.bestRun } : {}),
    ...(record.walkOn ? { walk_on: record.walkOn } : {}),
    ...(record.kind === "team" && record.memberStats && Object.keys(record.memberStats).length > 0 ? { member_stats: record.memberStats } : {}),
    ...(typeof record.rating === "number" ? { rating: record.rating, rated_matches: record.ratedMatches ?? 0 } : {}),
    // Only a team touches the two newer columns — see PlayerRow.
    ...(record.kind === "team" ? { kind: "team", members: record.members ?? [], kits: record.kits ?? null } : record.kits ? { kits: record.kits } : {}),
  };
}

/** A match's hit share for display, 0–100. Matches from before `cpd` kept crosses per dart in hitPct, which can pass
 *  100: where the rows are kept, it is worked out from them, and otherwise held to 100. */
export function shownHitPct(h: MatchHistoryEntry): number {
  if (h.cpd !== undefined) return h.hitPct;
  if (h.steps) {
    let hits = 0;
    let misses = 0;
    for (const v of Object.values(h.steps)) {
      hits += v[0];
      misses += v[1];
    }
    if (hits + misses > 0) return Math.round((hits / (hits + misses)) * 100);
  }
  return Math.min(100, h.hitPct);
}

/** Crosses per dart for a match, in percent: what the odds are built on. */
export const crossesPerDartPct = (h: MatchHistoryEntry): number => h.cpd ?? h.hitPct;
