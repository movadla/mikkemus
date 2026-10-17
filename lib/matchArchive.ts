import type { GameVariant } from "./rules";
import type { PlayerProgress, Step, TurnAggregate, TurnResult } from "./game";
import type { OddsSnapshot } from "./oddsLog";
import { supabase } from "./supabaseClient";

/**
 * A finished match as the winner screen showed it: what is needed to draw the same page again later, from the
 * list of matches. Kept when the result is written to the statistics (a match that does not count is not kept),
 * one row per match in the table match_log (supabase-setup-match-log.sql). Older matches have no such row, and the
 * list shows the figures their records kept instead.
 */
export type MatchArchive = {
  id: string;
  /** When the result was written, ISO. */
  date: string;
  variant?: GameVariant;
  winner: string;
  players: string[];
  /** The people in each team, by team name. */
  teams: Record<string, string[]>;
  stats: Record<string, TurnAggregate>;
  luck: Record<string, Record<Step, { sum: number; count: number }>>;
  preBanked: Record<string, { D: number; T: number }>;
  throws: Record<string, [number, number][]>;
  turnLog: Record<string, TurnResult[]>;
  progress: PlayerProgress;
  odds: OddsSnapshot[];
};

/** Writes the match. Fire and forget: a missing table or a bad connection is logged and nothing else, because a
 *  match must never be held up by its own archive. */
export async function saveMatchArchive(archive: MatchArchive): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("match_log").upsert({ id: archive.id, created_at: archive.date, data: archive }, { onConflict: "id" });
  if (error) console.warn("Kunne ikke lagre kampen:", error.message);
}

export async function loadMatchArchive(id: string): Promise<MatchArchive | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("match_log").select("data").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return (data as { data: MatchArchive }).data;
}

/** The ids of the matches that have a full archive, so the list knows which ones can be opened. */
export async function listArchivedIds(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase.from("match_log").select("id").order("created_at", { ascending: false }).limit(1000);
  if (error || !data) return new Set();
  return new Set((data as { id: string }[]).map((r) => r.id));
}
