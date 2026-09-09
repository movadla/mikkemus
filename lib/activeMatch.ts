import type { HitRecord, PlayerProgress, Step, TurnAggregate, TurnResult } from "./game";
import type { BotLevel, TeamMember } from "./botLevels";

export type ActiveMatchSnapshot = {
  screen: "game" | "winner";
  players: string[];
  progress: PlayerProgress;
  currentIdx: number;
  pendingHits: HitRecord[];
  history: HitRecord[];
  rewound: string | null;
  rewoundTurnIndex: number | null;
  winner: string | null;
  winnerStats: Record<string, TurnAggregate>;
  // Optional: absent in snapshots saved before "Expected Goals" (or before
  // its per-section breakdown) existed — restore falls back to {} rather
  // than requiring a migration.
  winnerLuck?: Record<string, Record<Step, { sum: number; count: number }>>;
  placements: string[];
  turnToken: number;
  turnLog: Record<string, TurnResult[]>;
  turnCounters: Record<string, number>;
  botLevels: Record<string, BotLevel>;
  teamRosters: Record<string, TeamMember[]>;
  teamMemberIdx: Record<string, number>;
  guestPlayers: Record<string, true>;
  /**
   * The match's accumulating statistics. All optional, and all absent from snapshots saved
   * before they were persisted at all — restore falls back to empty rather than migrating.
   *
   * These used to live only in refs and component state, so a reload mid-match kept the score
   * and lost every number behind it: the heatmap went blank, xH reset, and finalizeMatch then
   * wrote a half-length match to Supabase looking perfectly ordinary. iOS reloads a backgrounded
   * tab on its own, so this was not hypothetical.
   */
  matchThrows?: Record<string, [number, number][]>;
  luckTotals?: Record<string, Record<Step, { sum: number; count: number }>>;
  accuracyTotals?: Record<string, { distance: number; horizontal: number; vertical: number; throws: number }>;
  ringHits?: Record<string, { triple: Record<string, number>; double: Record<string, number> }>;
  /** D/T crosses banked while the player was NOT on that row — see MikkeMusApp's preBanked. */
  preBanked?: Record<string, { D: number; T: number }>;
};

const STORAGE_KEY = "mikke-mus-active-match";

/**
 * Keeps an in-progress match in localStorage so refreshing the page (or the
 * tablet browser restarting) resumes it instead of dropping back to setup —
 * this is per-device, on purpose: unlike player stats (Supabase, synced
 * across devices), which physical board a match is being played on doesn't
 * need to sync anywhere.
 */
export function saveActiveMatch(snapshot: ActiveMatchSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota/private-mode failures just mean no resume-on-reload — not fatal.
  }
}

export function loadActiveMatch(): ActiveMatchSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveMatchSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearActiveMatch() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
