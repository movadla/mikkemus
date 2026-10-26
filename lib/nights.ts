import type { MatchHistoryEntry, PlayerRecord } from "./storage";
import { shownHitPct } from "./playerRows";
import { dayLabel } from "./formatDate";

/** The hour a dart night is taken to end: a match after midnight still belongs to the evening before. */
const NIGHT_ENDS_HOUR = 5;
const two = (n: number) => String(n).padStart(2, "0");

/** The night (YYYY-MM-DD, local time) an ISO moment belongs to. Not the UTC date: after midnight in Norway that
 *  is still yesterday, and a late match would end up on the wrong night. */
export function nightOf(iso: string): string {
  const d = new Date(new Date(iso).getTime() - NIGHT_ENDS_HOUR * 3600 * 1000);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

export type PlayerNightStat = { name: string; wins: number; losses: number; matches: MatchHistoryEntry[] };
export type NightSummary = { date: string; players: PlayerNightStat[] };

/**
 * Groups every player's matchHistory entries by calendar date — matchHistory has no shared
 * "match id" to group by (it's per-player, appended independently at each match's end, see
 * recordMatchHistory in lib/storage.ts), so a calendar day is the closest proxy for "one dart
 * night" this data actually supports. Shared by the Hall of Fame page and the per-night
 * summary page so both agree on what counts as "a night".
 */
export function groupNights(roster: PlayerRecord[]): NightSummary[] {
  const nights = new Map<string, Map<string, PlayerNightStat>>();
  roster.forEach((p) => {
    p.matchHistory.forEach((entry) => {
      const date = nightOf(entry.date);
      const night = nights.get(date) ?? new Map<string, PlayerNightStat>();
      const stat = night.get(p.name) ?? { name: p.name, wins: 0, losses: 0, matches: [] };
      if (entry.won) stat.wins += 1;
      else stat.losses += 1;
      stat.matches.push(entry);
      night.set(p.name, stat);
      nights.set(date, night);
    });
  });
  return Array.from(nights.entries())
    .map(([date, players]) => ({
      date,
      // Wins, then fewest losses, then the better hit share that night: the same order the night's story uses.
      players: Array.from(players.values()).sort((a, b) => b.wins - a.wins || a.losses - b.losses || (nightAverages(b).hitPct ?? 0) - (nightAverages(a).hitPct ?? 0)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function formatNightDate(iso: string): string {
  return dayLabel(iso);
}

function avg(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** This night's own average hit% and average darts-per-match for one player — distinct from
 *  their career-wide averages, which is what makes a per-night summary worth looking at. */
export function nightAverages(stat: PlayerNightStat): { hitPct: number | null; darts: number | null } {
  return {
    hitPct: avg(stat.matches.map((m) => shownHitPct(m))),
    darts: avg(stat.matches.map((m) => m.dartsUsed)),
  };
}
