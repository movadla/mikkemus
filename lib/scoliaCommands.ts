import { supabase } from "./supabaseClient";

/**
 * The browser can't talk to Scolia — the relay owns that one WebSocket, and a direct
 * connection from the deployed origin gets closed anyway (see lib/useScolia.ts). So a
 * command travels the same road the events do, just the other way: the app writes a row,
 * the relay reads it and acts (see scripts/scolia-relay.ts).
 *
 * These ride in `scolia_events` rather than a table of their own purely so no SQL migration
 * is needed to start using them. Nothing consuming that stream is disturbed by it:
 * useScolia's processEventRow switches on the types it knows and ignores everything else,
 * so the app harmlessly reads back its own command and does nothing with it.
 */
export const RECALIBRATE_COMMAND = "CMD_RECALIBRATE";

/** Asks the relay to recalibrate the board. Resolves false if the write didn't land, so the
 *  caller can say so rather than leaving the user watching a board that never moves. */
export async function requestRecalibration(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("scolia_events").insert({
      type: RECALIBRATE_COMMAND,
      payload: { requestedAt: new Date().toISOString() },
    });
    return !error;
  } catch {
    return false;
  }
}
