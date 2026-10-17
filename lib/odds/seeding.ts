import type { Prior } from "./skill";

/**
 * The starting point for the regulars before there is data: a seeding, in order of strength.
 *
 * 1 Vadla, 2 Monge, 3 Moen, 4 Lars, 5 Hans, 6 Vegard, 7 Sondre. The gaps are the judgement of the
 * group, as chances of winning a match: Vadla takes 6 of 10 from Monge; Monge, Moen and Lars are about
 * even; they take 6 to 7 of 10 from Hans; Hans takes 8 of 10 from Vegard; Vegard takes 7 to 8 of 10
 * from Sondre.
 *
 * Those chances were turned into skill with the odds model itself, uncertainty and all: each figure
 * below is how far, in ln MED, the player sits from the middle of the group, such that two of them
 * playing a match are priced at the chances above (within two points; the test checks it). The middle is the group's own
 * starting point (the default 30 mm, or what the group's measured darts say), so the seeding says who
 * is better than whom and the data says how good the group is.
 *
 * It is only a starting point. It enters as the prior of that player's skill, worth about
 * SEED_STRENGTH_DARTS measured darts, so it fades the moment real darts come in: a match or two with
 * Scolia and it is the player's own figures that price them. Darts read from the cross rate count for
 * less (lib/odds/hitRate.ts), so the seeding lasts longer without Scolia.
 */
export const SEED_LOG_OFFSET: Record<string, number> = {
  vadla: -0.254,
  monge: -0.1595,
  moen: -0.1595,
  lars: -0.1595,
  hans: -0.02,
  vegard: 0.2724,
  sondre: 0.48,
};

/** The seeding as the group gave it, best first. */
export const SEED_ORDER = ["vadla", "monge", "moen", "lars", "hans", "vegard", "sondre"] as const;

/** How many measured darts the seeding is worth. The spread of the prior follows from it. */
export const SEED_STRENGTH_DARTS = 25;
// The mean of n Rayleigh distances has a relative variance of 0.4292 / (π/2) / n; the same in ln σ.
export const SEED_SD_LOG = Math.sqrt(0.4292 / (Math.PI / 2) / SEED_STRENGTH_DARTS);

/** The seeded prior for a player, or null for someone who is not in the seeding. `base` is the group's own. */
export function seededPrior(name: string, base: Prior): Prior | null {
  const offset = SEED_LOG_OFFSET[name.trim().toLowerCase()];
  if (offset === undefined) return null;
  return { med: base.med * Math.exp(offset), sdLog: SEED_SD_LOG };
}
