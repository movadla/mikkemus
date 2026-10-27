/** How big a round of three darts is, for the moment it gets: 100 and up is a ton, 140 and up a big one, and 180 is the most there is. */
export type RoundTier = "none" | "ton" | "big" | "max";

export function tierOf(scored: number): RoundTier {
  if (scored >= 180) return "max";
  if (scored >= 140) return "big";
  if (scored >= 100) return "ton";
  return "none";
}

/** The label on the card for a tier. */
export const TIER_LABEL: Record<RoundTier, string> = { none: "", ton: "TON", big: "140+", max: "180" };

/**
 * The top of the tower in Highstriker: what the scale reaches. The mark for what has to be beaten sits at about two thirds of it, so there
 * is room above to go past it, and it never goes below 60 or above the most three darts can make.
 */
export function towerScale(least: number | null): number {
  if (least === null) return 120;
  return Math.max(60, Math.min(180, Math.ceil((least * 1.5) / 10) * 10));
}

/** A value on the tower as a share of its height, between 0 and 1. */
export function towerShare(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale));
}
