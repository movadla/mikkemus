import type { CountdownStart } from "./countdown";

/**
 * The game a career is played in: Mikke Mus (the app's own, rows to close), or 501 or 301 (down to nothing, with or without a double to finish).
 * It is a setting of the career that can be changed on the way; an event keeps the game it was entered in.
 */
export type CareerGame = "mm" | "501" | "301";

export const CAREER_GAMES: { id: CareerGame; name: string; about: string }[] = [
  { id: "mm", name: "Mikke Mus", about: "Lukk radene, så få piler som mulig" },
  { id: "501", name: "501", about: "Ned til null fra 501" },
  { id: "301", name: "301", about: "Ned til null fra 301, kortere kamper" },
];

export type CareerGameSettings = { game: CareerGame; doubleOut: boolean };

/** The settings of a career, with what an older career is missing filled in: Mikke Mus, and a double to finish. */
export const gameOf = (profile: { game?: CareerGame; doubleOut?: boolean } | undefined): CareerGameSettings => ({ game: profile?.game ?? "mm", doubleOut: profile?.doubleOut ?? true });

/** What a countdown cup is played as, or nothing for Mikke Mus. */
export const countdownOf = (s: CareerGameSettings): { start: CountdownStart; doubleOut: boolean } | undefined => (s.game === "mm" ? undefined : { start: s.game === "301" ? 301 : 501, doubleOut: s.doubleOut });

export const gameName = (game: CareerGame) => CAREER_GAMES.find((g) => g.id === game)?.name ?? "Mikke Mus";

/**
 * What a skill means in numbers, for each game. A bot's skill is a MED in mm, and everything it throws follows from that, so none of this is
 * made up: each figure was found by letting the bots play the game, at each level, many times over (the darts at the 20 and the finishing time
 * of Mikke Mus from the model of the matches; the averages and legs of 501 and 301 from the bot that plays them).
 */
const MEDS = [20, 25, 30, 39, 49, 55, 65, 80];
const TABLES = {
  /** Share of darts that hit the number aimed at (%). */
  hit: [69, 58, 50, 39, 29, 26, 20, 15],
  /** Darts a player needs to finish a game of Mikke Mus, on average. */
  mmDarts: [47, 58, 68, 85, 111, 130, 164, 226],
  /** Share of darts at a double 20 that hit it (%). */
  double: [18, 13, 10, 6, 4, 3, 2, 2],
  "501-D": { avg: [54.0, 45.6, 37.4, 29.2, 23.6, 22.0, 19.2, 14.2], darts: [26, 31, 39, 50, 62, 67, 77, 105] },
  "501-S": { avg: [57.4, 48.6, 42.1, 36.3, 33.1, 31.9, 29.2, 25.5], darts: [24, 29, 33, 39, 43, 45, 49, 57] },
  "301-D": { avg: [50.3, 39.6, 33.7, 25.5, 19.3, 17.4, 14.6, 12.0], darts: [17, 22, 25, 34, 45, 51, 60, 75] },
  "301-S": { avg: [55.0, 46.0, 40.3, 34.1, 31.2, 29.3, 26.3, 23.2], darts: [15, 18, 20, 24, 27, 29, 33, 37] },
} as const;

function at(table: readonly number[], med: number): number {
  if (med <= MEDS[0]) return table[0];
  for (let i = 1; i < MEDS.length; i++) {
    if (med <= MEDS[i]) {
      const t = (med - MEDS[i - 1]) / (MEDS[i] - MEDS[i - 1]);
      return table[i - 1] + t * (table[i] - table[i - 1]);
    }
  }
  return table[table.length - 1];
}

/** One figure that sets two players apart: what it is called, the number, and whether the higher or the lower is the better. */
export type Stat = { key: string; label: string; short: string; value: number; better: "high" | "low"; suffix?: string };

/** The figures for a player of this skill in this game: the ones the comparison and the profile show. */
export function statsFor(settings: CareerGameSettings, med: number): Stat[] {
  if (settings.game === "mm") {
    return [
      { key: "hit", label: "Treffprosent", short: "Treff", value: Math.round(at(TABLES.hit, med)), better: "high", suffix: " %" },
      { key: "darts", label: "Piler til ferdig", short: "Piler", value: Math.round(at(TABLES.mmDarts, med)), better: "low" },
    ];
  }
  const t = TABLES[`${settings.game}-${settings.doubleOut ? "D" : "S"}` as "501-D"];
  const stats: Stat[] = [
    { key: "avg", label: "Snitt, 3 piler", short: "Snitt", value: Math.round(at(t.avg, med)), better: "high" },
    { key: "legs", label: "Piler per runde", short: "Runde", value: Math.round(at(t.darts, med)), better: "low" },
  ];
  if (settings.doubleOut) stats.push({ key: "double", label: "Utsjekk dobbel", short: "Utsjekk", value: Math.round(at(TABLES.double, med)), better: "high", suffix: " %" });
  return stats;
}
