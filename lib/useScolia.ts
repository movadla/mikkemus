import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import type { BoardErrorType, BoardPhase, BoardStatus, TakeoutFinishedPayload, ThrowDetectedPayload } from "./scoliaClient";

export type ScoliaCallbacks = {
  onThrow?: (payload: ThrowDetectedPayload) => void;
  onTakeoutStarted?: () => void;
  onTakeoutFinished?: (payload: TakeoutFinishedPayload) => void;
};

export type ScoliaState = {
  /** Whether the relay script has reported in within the heartbeat window (see scripts/scolia-relay.ts). */
  relay: "connecting" | "live" | "stale";
  boardStatus: BoardStatus | null;
  boardPhase: BoardPhase;
  errorType: BoardErrorType;
};

type StatusRow = {
  board_status: string | null;
  board_phase: string | null;
  error_type: string | null;
  updated_at: string;
};

// The relay heartbeats every 30s (see scripts/scolia-relay.ts) — anything much older
// than that means the relay process probably isn't running right now.
const STALE_AFTER_MS = 90_000;

/**
 * Reads Scolia board status/throw events via Supabase instead of connecting to
 * Scolia directly from the browser — a direct browser connection from the deployed
 * production origin gets closed by Scolia with an undocumented code, so a small
 * always-on relay script (scripts/scolia-relay.ts) holds that connection instead
 * and forwards everything into Supabase, which the browser just subscribes to.
 */
export function useScolia(enabled: boolean, callbacks: ScoliaCallbacks) {
  const [state, setState] = useState<ScoliaState>({
    relay: "connecting",
    boardStatus: null,
    boardPhase: null,
    errorType: null,
  });
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (!enabled || !supabase) return;
    const client = supabase;

    const lastSeenAtRef = { current: 0 };

    function applyStatusRow(row: StatusRow | null) {
      if (!row) return;
      lastSeenAtRef.current = Date.now();
      setState({
        relay: "live",
        boardStatus: row.board_status as BoardStatus | null,
        boardPhase: row.board_phase as BoardPhase,
        errorType: row.error_type as BoardErrorType,
      });
    }

    client
      .from("scolia_status")
      .select("*")
      .eq("id", "current")
      .maybeSingle()
      .then(({ data }) => applyStatusRow(data as StatusRow | null));

    const statusChannel = client
      .channel("scolia-status-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "scolia_status" }, (payload) => {
        console.log("[scolia] status event", payload);
        applyStatusRow(payload.new as StatusRow);
      })
      .subscribe((status, err) => console.log("[scolia] status channel:", status, err));

    const eventsChannel = client
      .channel("scolia-events-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scolia_events" }, (payload) => {
        console.log("[scolia] events event", payload);
        const row = payload.new as { type: string; payload: unknown };
        lastSeenAtRef.current = Date.now();
        if (row.type === "THROW_DETECTED") callbacksRef.current.onThrow?.(row.payload as ThrowDetectedPayload);
        else if (row.type === "TAKEOUT_STARTED") callbacksRef.current.onTakeoutStarted?.();
        else if (row.type === "TAKEOUT_FINISHED") callbacksRef.current.onTakeoutFinished?.(row.payload as TakeoutFinishedPayload);
      })
      .subscribe((status, err) => console.log("[scolia] events channel:", status, err));

    const staleCheck = setInterval(() => {
      if (lastSeenAtRef.current && Date.now() - lastSeenAtRef.current > STALE_AFTER_MS) {
        setState((s) => (s.relay === "stale" ? s : { ...s, relay: "stale" }));
      }
    }, 15_000);

    return () => {
      client.removeChannel(statusChannel);
      client.removeChannel(eventsChannel);
      clearInterval(staleCheck);
    };
  }, [enabled]);

  return { state };
}
