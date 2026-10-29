import { BOT_LEVELS } from "./botLevels";

/** A skill on the level scale (1 sharpest to 8) as a MED, the inverse of levelOfMed (lib/botLevels.ts). */
export function medOfLevel(level: number): number {
  const keys = Object.keys(BOT_LEVELS).map(Number).sort((a, b) => a - b);
  const l = Math.min(keys[keys.length - 1], Math.max(keys[0], level));
  const lo = Math.floor(l);
  const hi = Math.min(keys[keys.length - 1], lo + 1);
  const a = BOT_LEVELS[String(lo) as keyof typeof BOT_LEVELS].targetMed;
  const b = BOT_LEVELS[String(hi) as keyof typeof BOT_LEVELS].targetMed;
  return a + (b - a) * (l - lo);
}

/** The chance (0 to 100) that a player with the MED `mine` beats one with `theirs`: the same shape as the match simulation's, a steep curve in the ratio of the two. */
export function winChance(mine: number, theirs: number): number {
  const d = Math.log(theirs / mine) * 3.2;
  return Math.round(Math.min(97, Math.max(3, 100 / (1 + Math.exp(-d)))));
}

/** The world ranking of a skill: the sharpest are in the tens, an ordinary club player in the hundreds. A rank is never better than 1. */
export const worldRankOf = (med: number) => Math.max(1, Math.round(40 * (med / 20) ** 2.2));

/**
 * The world rank of a named player: the rank their skill gives, nudged by a few places that follow from the name, so that two with the same
 * strength do not share a place (the same name always gets the same nudge).
 */
export function worldRankFor(name: string, med: number): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  const base = worldRankOf(med);
  return base + Math.floor(((h >>> 0) / 4294967296) * Math.max(3, base * 0.08));
}

/** The Norwegian ranking, for a Norwegian: about one in eight of the world list. */
export const norwayRankOf = (world: number) => Math.max(1, Math.round(world / 8));

/** The player's world rank: the skill gives where they start, and every rank point they win moves them up. */
export const playerWorldRank = (med: number, points: number) => Math.max(1, Math.round(worldRankOf(med) * 0.992 ** points));
