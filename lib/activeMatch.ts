import type { HitRecord, PlayerProgress, TurnAggregate, TurnResult } from "./game";
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
  placements: string[];
  turnToken: number;
  turnLog: Record<string, TurnResult[]>;
  turnCounters: Record<string, number>;
  botLevels: Record<string, BotLevel>;
  teamRosters: Record<string, TeamMember[]>;
  teamMemberIdx: Record<string, number>;
  guestPlayers: Record<string, true>;
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
