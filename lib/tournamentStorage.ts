import { supabase } from "./supabaseClient";
import type { Participant, Tournament, TournamentMatch, TournamentMode } from "./tournament";

type TournamentRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  mode: string;
  participants: Participant[];
  groups: string[][];
  matches: TournamentMatch[];
  status: string;
  winner: string | null;
  match_size: number;
};

function rowToTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    mode: row.mode as TournamentMode,
    participants: row.participants,
    groups: row.groups,
    matches: row.matches,
    status: row.status as Tournament["status"],
    winner: row.winner ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    // Older tournaments (before match_size existed) default to the normal 1-vs-1 behavior.
    matchSize: row.match_size ?? 2,
  };
}

function tournamentToRow(t: Tournament): TournamentRow {
  return {
    id: t.id,
    created_at: t.createdAt,
    completed_at: t.completedAt ?? null,
    mode: t.mode,
    participants: t.participants,
    groups: t.groups,
    matches: t.matches,
    status: t.status,
    winner: t.winner ?? null,
    match_size: t.matchSize,
  };
}

/** Supabase is the source of truth for a tournament (active or completed) — see lib/tournament.ts's
 *  doc comment on why this differs from lib/activeMatch.ts's localStorage-only approach: a
 *  tournament spans many real-world sessions, so it needs to survive a cleared browser and be
 *  checkable from another device, not just resume-without-a-flash on the same one. */
export async function upsertTournament(tournament: Tournament): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tournaments").upsert(tournamentToRow(tournament));
  if (error) console.error("Kunne ikke lagre turnering i Supabase:", error.message);
}

/** Permanently removes an abandoned tournament — used when the player explicitly cancels one
 *  (see TournamentOverviewScreen's confirm dialog), unlike a completed tournament, which is
 *  always kept. */
export async function deleteTournament(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) console.error("Kunne ikke slette turnering i Supabase:", error.message);
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Kunne ikke hente turnering fra Supabase:", error.message);
    return null;
  }
  return data ? rowToTournament(data as TournamentRow) : null;
}

export function newTournamentId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Per-device pointer to "which tournament is active" — just an id, so a reload knows instantly
// (no network round-trip) whether to offer "Fortsett turnering" before the full record loads from
// Supabase. Mirrors lib/activeMatch.ts's resume-without-a-flash approach.
const ACTIVE_TOURNAMENT_ID_KEY = "mikke-mus-active-tournament-id";

export function saveActiveTournamentId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_TOURNAMENT_ID_KEY, id);
  } catch {
    // Quota/private-mode failures just mean no resume-on-reload — not fatal.
  }
}

export function loadActiveTournamentId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_TOURNAMENT_ID_KEY);
  } catch {
    return null;
  }
}

export function clearActiveTournamentId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_TOURNAMENT_ID_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
