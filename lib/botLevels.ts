export type BotLevel = "1" | "2" | "3" | "4" | "5" | "6";

export type BotLevelConfig = {
  key: BotLevel;
  name: string;
  /** Target Mean Euclidean Distance (mm) — the same MED accuracy stat real players
   *  are judged on (see lib/storage.ts's meanEuclideanDistance) — this level's
   *  throws are calibrated to average (see lib/botStrategy.ts's sigmaForLevel).
   *  Lower = more precise = stronger bot, so level 1 ("Littler") is the strongest. */
  targetMed: number;
};

export const BOT_LEVEL_ORDER: BotLevel[] = ["1", "2", "3", "4", "5", "6"];

/** The levels offered in the pickers: the three medal tiers, then ChrisBell and Kjetil, who are modelled on real players
 *  (just under Vadla and just under Hans). Level 6 still exists for matches that already have it. */
export const BOT_LEVEL_PICKABLE: BotLevel[] = ["1", "2", "3", "4", "5"];

/** Which medal a level carries, if any: gold is the strongest, as with the players it is named after. */
export function botLevelMedal(level: BotLevel): 0 | 1 | 2 | null {
  return level === "1" ? 0 : level === "2" ? 1 : level === "3" ? 2 : null;
}

/** The name a bot plays under: "Littler". The medal is drawn beside it where it matters (see LevelBadge), not written into the name. */
export function botDisplayName(level: BotLevel): string {
  return BOT_LEVELS[level].name;
}

/** A name as older matches wrote it, with the medal after it ("Littler 🥇"), without the medal. */
export function plainName(name: string): string {
  return name.replace(/\s*[\u{1F947}-\u{1F949}]/gu, "").replace(/\s{2,}/g, " ").trim();
}

/** One entrant in a shared-board team — a real person or a bot, mixed freely. The game engine
 *  uses this to know who's physically up next within a team's turn (see MikkeMusApp.tsx). */
export type TeamMember = {
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  /** A bot in a cup (lib/botCup.ts): its skill on the level scale, which the level of each match is worked out from. */
  skill?: number;
};

export const BOT_LEVELS: Record<BotLevel, BotLevelConfig> = {
  "1": { key: "1", name: "Littler", targetMed: 20 },
  "2": { key: "2", name: "Cor Dekker", targetMed: 25 },
  "3": { key: "3", name: "Dave", targetMed: 30 },
  // Vadla's measured MED is 37.4 mm (153 darts, 2026-10-20): ChrisBell sits marginally behind that. Hans has no measured darts
  // yet; the seeding (lib/odds/seeding.ts) puts him ~26 % behind Vadla in MED, which is ~47 mm, so Kjetil sits marginally behind that.
  // Retune these two once Hans has been measured.
  "4": { key: "4", name: "ChrisBell", targetMed: 39 },
  "5": { key: "5", name: "Kjetil", targetMed: 49 },
  "6": { key: "6", name: "Nivå 6", targetMed: 55 },
};
