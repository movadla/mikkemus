export type BotLevel = "nybegynner" | "middels" | "proff" | "legende";

export type BotLevelConfig = {
  key: BotLevel;
  label: string;
  /** Standard deviation (mm) of the bot's simulated throw around its aim point, per
   *  axis. Derived from a target mean-absolute-deviation (the same unit as the
   *  MHD/MVD stats real players are judged on) via the half-normal mean identity
   *  E|X| = sigma * sqrt(2/pi), so a level's mm figure reads the same way a real
   *  player's career MHD would. Fixed presets, not calibrated from real play. */
  sigma: number;
};

const MEAN_ABS_TO_SIGMA = Math.sqrt(Math.PI / 2);

function sigmaFromMeanAbsDeviation(mm: number): number {
  return mm * MEAN_ABS_TO_SIGMA;
}

export const BOT_LEVEL_ORDER: BotLevel[] = ["nybegynner", "middels", "proff", "legende"];

export const BOT_LEVELS: Record<BotLevel, BotLevelConfig> = {
  nybegynner: { key: "nybegynner", label: "Nybegynner", sigma: sigmaFromMeanAbsDeviation(38) },
  middels: { key: "middels", label: "Middels", sigma: sigmaFromMeanAbsDeviation(24) },
  proff: { key: "proff", label: "Proff", sigma: sigmaFromMeanAbsDeviation(14) },
  legende: { key: "legende", label: "Legende", sigma: sigmaFromMeanAbsDeviation(7) },
};
