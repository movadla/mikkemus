import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { PlayerProgress } from "./game";
import type { BotLevel } from "./botLevels";

/**
 * A deliberately small broadcast of "what a spectator watching this match right now would want
 * to see" — not the full ActiveMatchSnapshot lib/activeMatch.ts saves to localStorage (that also
 * carries pendingHits/history/turnLog, which only matter for resuming THIS device's own session
 * after a reload, not for a second "storskjerm" device rendering a live view).
 */
export type LiveMatchState = {
  screen: "setup" | "game" | "winner";
  players: string[];
  progress: PlayerProgress;
  activePlayer: string | null;
  turnToken: number;
  winner: string | null;
  botLevels: Record<string, BotLevel>;
  guestPlayers: Record<string, true>;
};

type LiveMatchRow = { id: string; state: LiveMatchState | null; updated_at: string };

/** Fire-and-forget, same as the relay's own status updates — a failed write just leaves the
 *  storskjerm view a little stale, never something the actual game logic depends on. */
export async function publishLiveMatch(state: LiveMatchState | null) {
  if (!supabase) return;
  const { error } = await supabase.from("live_match").upsert({ id: "current", state, updated_at: new Date().toISOString() });
  if (error) console.error("Kunne ikke oppdatere live_match:", error.message);
}

const POLL_MS = 1000;

/**
 * Polling only, deliberately — lib/useScolia.ts already found that Supabase Realtime's socket
 * handshake is unreliable from this bundled app and treats polling as the actual reliability
 * backbone, realtime as a pure bonus. A storskjerm display isn't latency-sensitive the way a
 * live throw is, so it isn't worth pulling in that same CDN-unbundled-client workaround here —
 * plain REST polling is simpler and already proven "good enough" in this exact codebase.
 */
export function useLiveMatch(): LiveMatchState | null {
  const [state, setState] = useState<LiveMatchState | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    function fetchOnce() {
      client
        .from("live_match")
        .select("state")
        .eq("id", "current")
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setState((data as Pick<LiveMatchRow, "state"> | null)?.state ?? null);
        });
    }

    fetchOnce();
    const interval = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
