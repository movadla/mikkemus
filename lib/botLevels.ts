export type BotLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

export type BotLevelConfig = {
  key: BotLevel;
  name: string;
  /** Target Mean Euclidean Distance (mm) — the same MED accuracy stat real players
   *  are judged on (see lib/storage.ts's meanEuclideanDistance) — this level's
   *  throws are calibrated to average (see lib/botStrategy.ts's sigmaForLevel).
   *  Lower = more precise = stronger bot, so level 1 ("Littler") is the strongest. */
  targetMed: number;
};

export const BOT_LEVEL_ORDER: BotLevel[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** The levels offered in the pickers: the three medal tiers, then Halfdan and Guro, two of the regulars of Ly whose strength there
 *  (lib/opponents.ts) is the one the level throws at. Level 6 still exists for matches that already have it. */
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
  // Vadla's measured MED is 37.4 mm (153 darts, 2026-10-20): level 4 sits marginally behind that. Hans has no measured darts yet; the
  // seeding (lib/odds/seeding.ts) puts him ~26 % behind Vadla in MED, which is ~47 mm, so level 5 sits marginally behind that. The two
  // carry the names of the regulars of Ly who throw at just these strengths in the career (lib/opponents.ts), so a name means one strength.
  "4": { key: "4", name: "Halfdan", targetMed: 39 },
  "5": { key: "5", name: "Guro", targetMed: 49 },
  "6": { key: "6", name: "Nivå 6", targetMed: 55 },
  // The two weakest are for the career (lib/career.ts), where the opponents are set from the player's own level and a beginner has to be
  // able to meet people who are worse than they are. They are not offered in any picker.
  "7": { key: "7", name: "Nivå 7", targetMed: 65 },
  "8": { key: "8", name: "Nivå 8", targetMed: 80 },
};

/** Where a MED in mm falls on the scale of levels, between the levels (1 is the sharpest, 8 the weakest). The inverse of what each level throws at. */
export function levelOfMed(med: number): number {
  const points = BOT_LEVEL_ORDER.map((k) => ({ level: Number(k), med: BOT_LEVELS[k].targetMed }));
  if (med <= points[0].med) return points[0].level;
  for (let i = 1; i < points.length; i++) {
    if (med <= points[i].med) {
      const [a, b] = [points[i - 1], points[i]];
      return a.level + ((med - a.med) / (b.med - a.med)) * (b.level - a.level);
    }
  }
  return points[points.length - 1].level;
}
