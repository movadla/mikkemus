import { supabase } from "./supabaseClient";

export type OddsSnapshot = { key: string; sides: { name: string; p: number; odds: number }[] };

/**
 * Keeps what the odds said after every turn, and who won, so that they can be checked afterwards:
 * of all the times the odds gave a side 70 %, did it win about 70 % of the time? Fire and forget — a
 * missing table or a bad connection is logged to the console and nothing else, because a match
 * must never be held up by its own statistics. Needs supabase-setup-odds.sql.
 */
export async function logOddsMatch(entry: { winner: string; sides: string[]; snapshots: OddsSnapshot[]; variant: string }): Promise<void> {
  if (!supabase || entry.snapshots.length === 0) return;
  const { error } = await supabase.from("odds_log").insert({ data: entry });
  if (error) console.warn("Kunne ikke logge oddsene:", error.message);
}
