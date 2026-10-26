import { reportError } from "./errorReporting";
import { supabase } from "./supabaseClient";
import { normalizeVariant } from "./rules";
import type { CupConfig } from "./botCup";
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
  /** Game variant (see lib/rules.ts) — the row length and the stand rule, as one string.
   *  Nullable column, added after the table: run
   *    alter table tournaments add column if not exists variant text;
   *  in Supabase before the first non-standard tournament — see tournamentToRow. */
  variant?: string | null;
  /** A cup against bots (lib/botCup.ts). Nullable column, added after the table — see supabase-setup-cup.sql. */
  cup?: CupConfig | null;
};

function rowToTournament(row: TournamentRow): Tournament {
  const knockout = row.matches.some((m) => m.feedA || m.feedB) || (row.groups.length === 0 && row.matches.length > 0);
  return {
    // A knockout carries no groups, so that is what marks it (no column to add): its seeding is the order of its entrants.
    ...(knockout ? { format: "knockout" as const, seeds: row.participants.map((p) => p.name) } : {}),
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
    variant: normalizeVariant(row.variant),
    ...(row.cup ? { cup: row.cup } : {}),
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
    // Only written when it says something. A standard tournament never touches the column, so
    // saving one keeps working on a database where the column has not been added yet.
    ...(t.variant && t.variant !== "standard" ? { variant: t.variant } : {}),
    // Likewise: only a cup touches the column (run supabase-setup-cup.sql first).
    ...(t.cup ? { cup: t.cup } : {}),
  };
}

/** Supabase is the source of truth for a tournament (active or completed) — see lib/tournament.ts's
 *  doc comment on why this differs from lib/activeMatch.ts's localStorage-only approach: a
 *  tournament spans many real-world sessions, so it needs to survive a cleared browser and be
 *  checkable from another device, not just resume-without-a-flash on the same one. */
export async function upsertTournament(tournament: Tournament): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tournaments").upsert(tournamentToRow(tournament));
  if (error) {
    console.error("Kunne ikke lagre turnering i Supabase:", error.message);
    reportError("Kunne ikke lagre turnering i skyen.", { key: "tournament-upsert" });
  }
}

/** Permanently removes an abandoned tournament — used when the player explicitly cancels one
 *  (see TournamentOverviewScreen's confirm dialog), unlike a completed tournament, which is
 *  always kept. */
export async function deleteTournament(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) {
    console.error("Kunne ikke slette turnering i Supabase:", error.message);
    reportError("Kunne ikke slette turnering i skyen. Prøv igjen senere.", { key: "tournament-delete" });
  }
}

export type FetchTournamentResult =
  | { status: "found"; tournament: Tournament }
  | { status: "not-found" }
  | { status: "error" };

/** Distinguishes "genuinely doesn't exist" from "couldn't reach Supabase" — the caller (see
 *  TournamentApp's resume-on-load effect) must only clear the local resume pointer on the former;
 *  clearing it on a transient network error would permanently lose the ability to resume. */
export async function fetchTournament(id: string): Promise<FetchTournamentResult> {
  if (!supabase) return { status: "error" };
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Kunne ikke hente turnering fra Supabase:", error.message);
    reportError("Kunne ikke hente turnering. Prøv å laste siden på nytt.", { key: "tournament-fetch" });
    return { status: "error" };
  }
  return data ? { status: "found", tournament: rowToTournament(data as TournamentRow) } : { status: "not-found" };
}

/** The finished tournaments, newest first — the trophy cabinet. */
export async function listFinishedTournaments(limit = 50): Promise<Tournament[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tournaments").select("*").eq("status", "done").order("completed_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("Kunne ikke hente tidligere turneringer:", error.message);
    return [];
  }
  return ((data ?? []) as TournamentRow[]).map(rowToTournament);
}

/** The tournament made most recently, whoever made it: what the big screen shows, since it is another device with no pointer of its own. */
export async function fetchLatestTournament(): Promise<Tournament | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return rowToTournament(data as TournamentRow);
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
