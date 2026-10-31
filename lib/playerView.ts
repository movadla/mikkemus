import { STEPS, type Step } from "./game";
import { shownHitPct, type HitStat, type MatchHistoryEntry, type MemberStat, type PlayerRecord } from "./playerRows";

/**
 * A player's numbers as one person alone (Singel) and as a member of a team (Lag), and by where the darts were
 * registered: by hand, by Scolia, or both.
 *
 * What can be split by source is what is kept per match: whether it was won, the darts, how often they counted
 * and, when Scolia measured the darts, the distances. A match with measured darts is a Scolia match, one
 * without a manual one. What is only kept as totals over every match (the hits on each row, the longest run,
 * the rating) cannot be split, and is shown for «Begge» only.
 */
export type Source = "manual" | "scolia" | "both";
export const SOURCES: { value: Source; label: string }[] = [
  { value: "manual", label: "Manuell" },
  { value: "scolia", label: "Scolia" },
  { value: "both", label: "Begge" },
];

export const isScoliaMatch = (m: MatchHistoryEntry): boolean => m.med !== null;

export function bySource(entries: MatchHistoryEntry[], source: Source): MatchHistoryEntry[] {
  if (source === "both") return entries;
  return entries.filter((m) => (source === "scolia" ? isScoliaMatch(m) : !isScoliaMatch(m)));
}

const usable = (entries: MatchHistoryEntry[]) => entries.filter((m) => m.dartsUsed > 0);

/** Crosses per dart in percent over matches, each weighed by its darts. */
export function weightedHit(entries: MatchHistoryEntry[]): number | null {
  const e = usable(entries);
  const darts = e.reduce((s, m) => s + m.dartsUsed, 0);
  return darts === 0 ? null : e.reduce((s, m) => s + shownHitPct(m) * m.dartsUsed, 0) / darts;
}

/** A mean distance over matches with measured darts, weighed by the darts measured. */
function weightedDistance(entries: MatchHistoryEntry[], key: "med" | "mhd" | "mvd"): number | null {
  const e = entries.filter((m) => m[key] !== null);
  const w = e.reduce((s, m) => s + (m.throws ?? m.dartsUsed), 0);
  return w === 0 ? null : e.reduce((s, m) => s + (m[key] as number) * (m.throws ?? m.dartsUsed), 0) / w;
}

/** Hit percentage of a row, and the crosses and misses behind it: a figure over a handful of darts says little. */
export type RowStat = { step: Step; pct: number | null; hits: number; misses: number };

export type View = {
  matches: number;
  wins: number;
  winPct: number | null;
  /** How often the darts counted, over these matches. */
  hitPct: number | null;
  med: number | null;
  mhd: number | null;
  mvd: number | null;
  dartsPerWin: number | null;
  /** The last ten results of these matches, oldest first. */
  results: boolean[];
  /** Only for «Begge»: kept as totals, not per match. Null when a source is chosen. */
  bestRun: number | null;
  /** Hit percentage per row: the totals for «Begge», and for a chosen source what its matches kept per row. */
  rows: RowStat[] | null;
  /** Matches on record that have no date or source (from before the matches were kept one by one): left out when a source is chosen. */
  unsorted: number;
  /** Darts spent per row over these matches (see lib/rowCosts.ts), or null when none of them kept it. */
  rowDarts: Record<Step, number> | null;
  /** How many matches rowDarts covers, and how many of those are older matches reckoned the old way (crosses plus misses). */
  rowDartsMatches: number;
  rowDartsApprox: number;
};

/**
 * Darts per row summed over matches: the darts per row each match kept, or — for an older match that kept only its crosses
 * and misses per row — those added up, which is what the chart showed before darts per row were kept. `pick` chooses
 * what to read off an entry (a member's own figures in a team's match, say).
 */
export function rowDartsOver(entries: MatchHistoryEntry[], pick: (m: MatchHistoryEntry) => Partial<Record<Step, number>> | undefined = (m) => m.rowDarts, fallback = true): Pick<View, "rowDarts" | "rowDartsMatches" | "rowDartsApprox"> {
  const sum = {} as Record<Step, number>;
  STEPS.forEach((s) => (sum[s] = 0));
  let matches = 0;
  let approx = 0;
  for (const m of entries) {
    const rows = pick(m);
    if (rows) {
      STEPS.forEach((s) => (sum[s] += rows[s] ?? 0));
      matches++;
    } else if (fallback && m.steps) {
      STEPS.forEach((s) => (sum[s] += (m.steps![s]?.[0] ?? 0) + (m.steps![s]?.[1] ?? 0)));
      matches++;
      approx++;
    }
  }
  return { rowDarts: matches > 0 ? sum : null, rowDartsMatches: matches, rowDartsApprox: approx };
}

const rowsOf = (steps: Record<Step, HitStat> | undefined): RowStat[] | null =>
  steps ? STEPS.map((step) => ({ step, pct: steps[step].hits + steps[step].misses > 0 ? (steps[step].hits / (steps[step].hits + steps[step].misses)) * 100 : null, hits: steps[step].hits, misses: steps[step].misses })) : null;

/** Hit percentage per row over the matches that kept their crosses and misses per row, or null when none of them did. */
export function rowsOver(entries: MatchHistoryEntry[]): RowStat[] | null {
  const kept = entries.filter((m) => m.steps);
  if (kept.length === 0) return null;
  const steps = {} as Record<Step, HitStat>;
  STEPS.forEach((s) => (steps[s] = { hits: kept.reduce((a, m) => a + (m.steps![s]?.[0] ?? 0), 0), misses: kept.reduce((a, m) => a + (m.steps![s]?.[1] ?? 0), 0) }));
  return rowsOf(steps);
}

function viewOf(entries: MatchHistoryEntry[], source: Source, totals: { matches: number; wins: number; bestRun: number | null; steps: Record<Step, HitStat> | undefined; med: number | null; mhd: number | null; mvd: number | null; dartsPerWin: number | null }): View {
  const sel = bySource(entries, source);
  const both = source === "both";
  const matches = both ? Math.max(totals.matches, entries.length) : sel.length;
  const wins = both ? Math.max(totals.wins, entries.filter((m) => m.won).length) : sel.filter((m) => m.won).length;
  const wonDarts = usable(sel.filter((m) => m.won));
  const med = source === "manual" ? null : weightedDistance(sel, "med") ?? (both ? totals.med : null);
  return {
    matches,
    wins,
    winPct: matches > 0 ? (wins / matches) * 100 : null,
    hitPct: weightedHit(sel),
    med,
    mhd: source === "manual" ? null : weightedDistance(sel, "mhd") ?? (both ? totals.mhd : null),
    mvd: source === "manual" ? null : weightedDistance(sel, "mvd") ?? (both ? totals.mvd : null),
    dartsPerWin: wonDarts.length > 0 ? wonDarts.reduce((s, m) => s + m.dartsUsed, 0) / wonDarts.length : both ? totals.dartsPerWin : null,
    results: [...sel].sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map((m) => m.won),
    bestRun: both ? totals.bestRun : null,
    rows: both ? rowsOf(totals.steps) : rowsOver(sel),
    unsorted: both ? 0 : Math.max(0, totals.matches - entries.length),
    ...rowDartsOver(sel),
  };
}

/** A person alone: their own record. */
export function singleView(rec: PlayerRecord, source: Source): View {
  const acc = rec.accuracy;
  return viewOf(rec.matchHistory, source, {
    matches: rec.matchesPlayed,
    wins: rec.matchesWon,
    bestRun: rec.bestRun ?? null,
    steps: rec.steps,
    med: acc.throws > 0 ? acc.sumDistance / acc.throws : null,
    mhd: acc.throws > 0 ? acc.sumHorizontal / acc.throws : null,
    mvd: acc.throws > 0 ? acc.sumVertical / acc.throws : null,
    dartsPerWin: rec.matchesWon > 0 && rec.dartsInWins > 0 ? rec.dartsInWins / rec.matchesWon : null,
  });
}

export type TeamRow = { name: string; partners: string[]; matches: number; wins: number };

export type TeamView = View & {
  /** The teams the player is in, with the matches each has played. */
  teams: TeamRow[];
  /** The player's own darts in team matches: how often they counted, and the darts thrown. Only for «Begge»: they are kept as totals. */
  ownHitPct: number | null;
  ownDarts: number;
  /** Matches the player has numbers of their own for (the per-member figures began later than the teams' matches). */
  ownMatches: number;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A person in a team: the teams they are in, and what they have thrown themselves in them. */
export function teamView(player: PlayerRecord, all: PlayerRecord[], source: Source): TeamView {
  const teams = all.filter((t) => t.kind === "team" && (t.members ?? []).some((m) => same(m, player.name)));
  const entries = teams.flatMap((t) => t.matchHistory);
  const memberStats: MemberStat[] = teams.map((t) => Object.entries(t.memberStats ?? {}).find(([k]) => same(k, player.name))?.[1]).filter((s): s is MemberStat => !!s);
  const throws = memberStats.reduce((s, m) => s + m.throws, 0);
  const sumR = memberStats.reduce((s, m) => s + m.sumR, 0);
  const steps = {} as Record<Step, HitStat>;
  STEPS.forEach((s) => (steps[s] = { hits: memberStats.reduce((a, m) => a + (m.steps[s]?.hits ?? 0), 0), misses: memberStats.reduce((a, m) => a + (m.steps[s]?.misses ?? 0), 0) }));
  const hits = memberStats.reduce((s, m) => s + m.hits, 0);
  const misses = memberStats.reduce((s, m) => s + m.misses, 0);
  const base = viewOf(entries, source, {
    matches: teams.reduce((s, t) => s + t.matchesPlayed, 0),
    wins: teams.reduce((s, t) => s + t.matchesWon, 0),
    bestRun: memberStats.length > 0 ? Math.max(...memberStats.map((m) => m.bestRun)) : null,
    steps: memberStats.length > 0 ? steps : undefined,
    med: throws > 0 ? sumR / throws : null,
    mhd: null,
    mvd: null,
    dartsPerWin: null,
  });
  return {
    ...base,
    // Per match, the rows kept are the team's, not the player's own: those exist only as totals, for «Begge».
    rows: source === "both" ? base.rows : null,
    // The distance is the player's own, measured by Scolia: it exists for «Scolia» and «Begge».
    med: source === "manual" ? null : throws > 0 ? sumR / throws : base.med,
    teams: teams.map((t) => ({
      name: t.name,
      partners: (t.members ?? []).filter((m) => !same(m, player.name)),
      matches: source === "both" ? t.matchesPlayed : bySource(t.matchHistory, source).length,
      wins: source === "both" ? t.matchesWon : bySource(t.matchHistory, source).filter((m) => m.won).length,
    })),
    // The player's own darts per row in the team's matches. Older matches kept nothing per member, so no fallback here.
    ...rowDartsOver(bySource(entries, source), (m) => Object.entries(m.rowDartsByMember ?? {}).find(([k]) => same(k, player.name))?.[1], false),
    ownHitPct: source === "both" && hits + misses > 0 ? (hits / (hits + misses)) * 100 : null,
    ownDarts: source === "both" ? memberStats.reduce((s, m) => s + m.darts, 0) : 0,
    ownMatches: memberStats.reduce((s, m) => s + m.matches, 0),
  };
}

/**
 * Every dart a person has thrown, alone and in teams, as one set of numbers: how often the darts counted, the distance from the middle, the
 * hits on each row and the darts spent on each. Kept as totals, so it exists for «Begge» only. Matches, wins and rating are not in it: they
 * are the person's alone.
 */
export type AllView = {
  /** Darts thrown alone, and in teams (the person's own, from the figures kept per member). */
  aloneDarts: number;
  teamDarts: number;
  hitPct: number | null;
  med: number | null;
  mhd: number | null;
  mvd: number | null;
  bestRun: number | null;
  rows: RowStat[] | null;
  rowDarts: Record<Step, number> | null;
  rowDartsMatches: number;
  rowDartsApprox: number;
};

export function allView(player: PlayerRecord, all: PlayerRecord[]): AllView {
  const single = singleView(player, "both");
  const team = teamView(player, all, "both");
  const teams = all.filter((t) => t.kind === "team" && (t.members ?? []).some((m) => same(m, player.name)));
  const stats: MemberStat[] = teams.map((t) => Object.entries(t.memberStats ?? {}).find(([k]) => same(k, player.name))?.[1]).filter((s): s is MemberStat => !!s);
  const aloneDarts = usable(player.matchHistory).reduce((s, m) => s + m.dartsUsed, 0);
  const teamDarts = stats.reduce((s, m) => s + m.darts, 0);
  const tHits = stats.reduce((s, m) => s + m.hits, 0);
  const tMisses = stats.reduce((s, m) => s + m.misses, 0);
  const hitParts: [number, number][] = [];
  if (single.hitPct !== null && aloneDarts > 0) hitParts.push([single.hitPct, aloneDarts]);
  if (tHits + tMisses > 0 && teamDarts > 0) hitParts.push([(tHits / (tHits + tMisses)) * 100, teamDarts]);
  const weight = hitParts.reduce((s, [, w]) => s + w, 0);
  const acc = player.accuracy;
  const tThrows = stats.reduce((s, m) => s + m.throws, 0);
  const tSumR = stats.reduce((s, m) => s + m.sumR, 0);
  const steps = {} as Record<Step, HitStat>;
  STEPS.forEach(
    (s) =>
      (steps[s] = {
        hits: (player.steps[s]?.hits ?? 0) + stats.reduce((a, m) => a + (m.steps[s]?.hits ?? 0), 0),
        misses: (player.steps[s]?.misses ?? 0) + stats.reduce((a, m) => a + (m.steps[s]?.misses ?? 0), 0),
      }),
  );
  const rowDarts = single.rowDarts || team.rowDarts ? ({} as Record<Step, number>) : null;
  if (rowDarts) STEPS.forEach((s) => (rowDarts[s] = (single.rowDarts?.[s] ?? 0) + (team.rowDarts?.[s] ?? 0)));
  const runs = [player.bestRun ?? 0, ...stats.map((m) => m.bestRun)];
  return {
    aloneDarts,
    teamDarts,
    hitPct: weight > 0 ? hitParts.reduce((s, [p, w]) => s + p * w, 0) / weight : null,
    med: acc.throws + tThrows > 0 ? (acc.sumDistance + tSumR) / (acc.throws + tThrows) : null,
    mhd: single.mhd,
    mvd: single.mvd,
    bestRun: Math.max(...runs) > 0 ? Math.max(...runs) : null,
    rows: rowsOf(steps),
    rowDarts,
    rowDartsMatches: single.rowDartsMatches + team.rowDartsMatches,
    rowDartsApprox: single.rowDartsApprox + team.rowDartsApprox,
  };
}
