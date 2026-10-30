/**
 * Extra points («bonus») for feats, chosen under Avanserte innstillinger and counted in Kveldsscore: a person who does one gets one point more
 * that evening. 180 and a checkout of 100 or more are read from the rounds of 301/501; three bulls in a round (150 in 301/501, where the thrower is
 * asked, since 150 can be made in other ways; and three crosses on the bull in a turn of the main game).
 */
import type { CountdownGame } from "./countdown";
import { winnerOf } from "./countdown";
import type { TurnResult } from "./game";

export type Feat = "180" | "bull3" | "co100";

export const FEAT_NAMES: Record<Feat, string> = { "180": "180", bull3: "Tre i bull", co100: "Utsjekk 100+" };

/** Which feats give a point: all off unless they are asked for. */
export type BonusSettings = { s180: boolean; bull3: boolean; co100: boolean };
export const NO_BONUS: BonusSettings = { s180: false, bull3: false, co100: false };
export const anyBonus = (b: BonusSettings | undefined): boolean => !!b && (b.s180 || b.bull3 || b.co100);

/** A feat done by a person: it is the person who gets the point, not their team. */
export type NightBonus = { who: string; feat: Feat };

/** The feats of a game of 301/501, from its rounds. */
export function countdownBonuses(g: CountdownGame, b: BonusSettings | undefined): NightBonus[] {
  if (!b) return [];
  const out: NightBonus[] = [];
  for (const t of g.turns) {
    const who = t.by ?? t.player;
    if (!t.bust && b.s180 && t.scored === 180) out.push({ who, feat: "180" });
    if (!t.bust && b.bull3 && t.bull3) out.push({ who, feat: "bull3" });
  }
  const last = g.turns[g.turns.length - 1];
  if (b.co100 && winnerOf(g) && last && last.scored >= 100) out.push({ who: last.by ?? last.player, feat: "co100" });
  return out;
}

/** Three crosses on the bull in one turn of the main game, per person (the member who threw, in a team). */
export function mikkeBull3(turnLog: Record<string, TurnResult[]>, b: BonusSettings | undefined): NightBonus[] {
  if (!b?.bull3) return [];
  return Object.entries(turnLog).flatMap(([side, turns]) => turns.filter((t) => t && (t.hitsByStep.BULL ?? 0) >= 3).map((t) => ({ who: t.thrower ?? side, feat: "bull3" as const })));
}
