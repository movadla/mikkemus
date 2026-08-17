import type { MatchHistoryEntry, PlayerRecord } from "./storage";

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
      const date = entry.date.slice(0, 10);
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
      players: Array.from(players.values()).sort((a, b) => b.wins - a.wins || a.losses - b.losses),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function formatNightDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function avg(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** This night's own average hit% and average darts-per-match for one player — distinct from
 *  their career-wide averages, which is what makes a per-night summary worth looking at. */
export function nightAverages(stat: PlayerNightStat): { hitPct: number | null; darts: number | null } {
  return {
    hitPct: avg(stat.matches.map((m) => m.hitPct)),
    darts: avg(stat.matches.map((m) => m.dartsUsed)),
  };
}
