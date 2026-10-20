import { fewestDartsToWin } from "./finishState";
import type { PlayerRecord } from "./playerRows";
import { RULES } from "./rules";

/**
 * The fewest darts a player or team has won a match on. Read off the matches on record rather than the stored total alone:
 * a «win» on fewer darts than a board can possibly take (an aborted or a test match, kept as won before matches had an id)
 * once set a record of 3, which no later match could beat. Such entries are ignored here, and the stored figure is only
 * trusted when it is possible, so the record heals itself without touching what is stored.
 */
export function bestWinDarts(record: Pick<PlayerRecord, "bestDartsToFinish" | "matchHistory">): number | null {
  const floor = fewestDartsToWin(RULES.standard.target);
  const possible = (d: number | null | undefined): d is number => d !== null && d !== undefined && d >= floor;
  const candidates = record.matchHistory.filter((m) => m.won && possible(m.dartsUsed)).map((m) => m.dartsUsed);
  if (possible(record.bestDartsToFinish)) candidates.push(record.bestDartsToFinish);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/**
 * The group's record: the fewest darts anyone of the kind has won a match on — among the teams for a team match, among
 * the players for one played alone — and who holds it. What a match in progress is measured against (the record bar).
 */
export function groupBestWin(records: readonly PlayerRecord[], kind: "player" | "team"): { darts: number; who: string } | null {
  let best: { darts: number; who: string } | null = null;
  for (const r of records) {
    if ((r.kind === "team") !== (kind === "team")) continue;
    const d = bestWinDarts(r);
    if (d !== null && (!best || d < best.darts)) best = { darts: d, who: r.name };
  }
  return best;
}
