import type { TurnAggregate } from "./game";

/**
 * A match of the pilot that ended level for a place is not recorded until the bull-offs are thrown (lib/bullOff.ts). Kept on the
 * device meanwhile, so a reload between the match and the last bull-off does not lose a match that was played.
 */
export type PendingTies = { tournamentId: string; matchId: string; placements: string[]; stats: Record<string, TurnAggregate>; groups: string[][] };

const KEY = "mikke-mus-pilot-ties";

export function savePendingTies(ties: PendingTies): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ties));
  } catch {
    // Without storage a reload would start the bull-off over from the match; nothing else is lost.
  }
}

export function loadPendingTies(): PendingTies | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as PendingTies;
    return typeof t.tournamentId === "string" && typeof t.matchId === "string" && Array.isArray(t.placements) && Array.isArray(t.groups) ? t : null;
  } catch {
    return null;
  }
}

export function clearPendingTies(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}
