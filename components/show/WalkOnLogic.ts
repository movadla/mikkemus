import type { Rival } from "@/lib/career";

/** How long the walk-on runs before it hands over to the intro card (ms), and how long when motion is reduced and everything is simply there. */
export const WALKON_MS = 4800;
export const WALKON_REDUCED_MS = 2200;

/**
 * Whether the walk-on is played before a match: only for the code that has the show, only before a big one (semi-final or final), and not for
 * a cup of teams, where there is no single figure to walk in.
 */
export function shouldWalkOn({ show, big, team }: { show: boolean; big: boolean; team?: boolean }): boolean {
  return show && big && !team;
}

/** The line under a name plate: the world rank of the one walking in, when it is known. */
export const rankPlate = (world: number | null | undefined): string => (world && world > 0 ? `Verden #${world}` : "");

/** The head-to-head under VS: "Innbyrdes 2–1" and who won last. Nothing when the two have not met (there is no data to show, so none is made up). */
export function faceOffOf(rival: Rival | undefined): { score: string; last: string } | null {
  if (!rival || rival.w + rival.l <= 0) return null;
  return { score: `Innbyrdes ${rival.w}–${rival.l}`, last: `Sist: ${rival.lastWon ? "seier" : "tap"} ${rival.last.slice(0, 10)}` };
}

/** The keys that skip the walk-on. */
export const isSkipKey = (key: string): boolean => key === "Escape" || key === "Enter" || key === " ";
