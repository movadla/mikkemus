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

export const BOT_LEVELS: Record<BotLevel, BotLevelConfig> = {
  "1": { key: "1", name: "Littler", targetMed: 20 },
  "2": { key: "2", name: "Cor Dekker", targetMed: 25 },
  "3": { key: "3", name: "Dave", targetMed: 30 },
  "4": { key: "4", name: "Chris Bell", targetMed: 35 },
  "5": { key: "5", name: "Nivå 5", targetMed: 45 },
  "6": { key: "6", name: "Nivå 6", targetMed: 55 },
};
