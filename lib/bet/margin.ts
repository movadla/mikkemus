import { STEPS } from "../game";

/** Crosses a side still lacks on its board: what a winner's margin is made of. */
export function crossesLeft(progress: Record<string, number> | undefined, target: number): number {
  if (!progress) return 0;
  return STEPS.reduce((sum, s) => sum + Math.max(0, target - Math.min(target, progress[s] ?? 0)), 0);
}
