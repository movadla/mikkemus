import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
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

type EventRow = { id: number; type: string; payload: unknown };

// The relay heartbeats every 30s (see scripts/scolia-relay.ts) — anything much older
// than that means the relay process probably isn't running right now.
const STALE_AFTER_MS = 90_000;
const EVENTS_POLL_MS = 1_000;
const STATUS_POLL_MS = 5_000;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Next.js's bundled copy of @supabase/supabase-js — same version, same code —
 * fails every Realtime channel with "CHANNEL_ERROR: transport failure" no matter
 * how it's constructed or called, while an unbundled copy loaded straight from
 * a CDN in the same page connects fine every time. Something in how webpack/
 * Turbopack packages @supabase/realtime-js (or its @supabase/phoenix dependency)
 * breaks the websocket handshake. Until that's understood, Realtime specifically
 * uses a dynamically imported, unbundled client to sidestep it; regular
 * REST calls (lib/storage.ts, the polling below) are unaffected and keep using
 * the normal bundled client from ./supabaseClient.
 */
const SUPABASE_JS_CDN_URL = "https://esm.sh/@supabase/supabase-js@2.112.2";

let realtimeClientPromise: Promise<SupabaseClient | null> | null = null;
function getRealtimeClient(): Promise<SupabaseClient | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return Promise.resolve(null);
  realtimeClientPromise ??= import(/* webpackIgnore: true */ SUPABASE_JS_CDN_URL).then((mod) =>
    mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  );
  return realtimeClientPromise;
}

/**
 * Reads Scolia board status/throw events via Supabase instead of connecting to
 * Scolia directly from the browser — a direct browser connection from the deployed
 * production origin gets closed by Scolia with an undocumented code, so a small
 * always-on relay script (scripts/scolia-relay.ts) holds that connection instead
 * and forwards everything into Supabase, which the browser just reads.
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

    let cancelled = false;
    const lastSeenAtRef = { current: 0 };
    const lastEventIdRef = { current: 0 };
    let channels: { status: ReturnType<SupabaseClient["channel"]>; events: ReturnType<SupabaseClient["channel"]> } | null = null;

    function noteAlive() {
      lastSeenAtRef.current = Date.now();
    }

    function applyStatusRow(row: StatusRow | null) {
      if (!row) return;
      noteAlive();
      setState({
        relay: "live",
        boardStatus: row.board_status as BoardStatus | null,
        boardPhase: row.board_phase as BoardPhase,
        errorType: row.error_type as BoardErrorType,
      });
    }

    // Shared by the realtime channel and the poll below, so whichever notices a
    // given row first "wins" and the other silently no-ops on it.
    function processEventRow(row: EventRow) {
      if (row.id <= lastEventIdRef.current) return;
      lastEventIdRef.current = row.id;
      noteAlive();
      if (row.type === "THROW_DETECTED") callbacksRef.current.onThrow?.(row.payload as ThrowDetectedPayload);
      else if (row.type === "TAKEOUT_STARTED") callbacksRef.current.onTakeoutStarted?.();
      else if (row.type === "TAKEOUT_FINISHED") callbacksRef.current.onTakeoutFinished?.(row.payload as TakeoutFinishedPayload);
    }

    /**
     * Subscribes once and then leaves reconnection entirely to realtime-js's own
     * socket/channel rejoin (Phoenix channels rejoin automatically once the socket
     * is back up — that's built in, not something the app needs to drive).
     */
    function subscribeRealtime(realtimeClient: SupabaseClient) {
      const statusChannel = realtimeClient
        .channel("scolia-status-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "scolia_status" }, (payload) => {
          applyStatusRow(payload.new as StatusRow);
        })
        .subscribe();

      const eventsChannel = realtimeClient
        .channel("scolia-events-stream")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "scolia_events" }, (payload) => {
          processEventRow(payload.new as EventRow);
        })
        .subscribe();

      channels = { status: statusChannel, events: eventsChannel };
    }

    // Start listening for events from "now" — not from the beginning of the table.
    client
      .from("scolia_events")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        lastEventIdRef.current = (data as { id: number } | null)?.id ?? 0;
      });

    client
      .from("scolia_status")
      .select("*")
      .eq("id", "current")
      .maybeSingle()
      .then(({ data }) => applyStatusRow(data as StatusRow | null));

    getRealtimeClient().then((realtimeClient) => {
      if (cancelled || !realtimeClient) return;
      subscribeRealtime(realtimeClient);
    });

    /**
     * The Realtime WebSocket handshake to Supabase is unreliable for reasons not
     * fully pinned down — intermittent 1006 closes, seen far more from the
     * deployed Vercel origin than from local dev, sometimes never once
     * succeeding for an entire game. Rather than keep chasing that, polling runs
     * unconditionally alongside the realtime subscription as the reliability
     * backbone; realtime becomes purely a latency optimization for whenever it
     * does happen to connect. processEventRow/applyStatusRow dedupe between them.
     */
    const eventsPoll = setInterval(() => {
      client
        .from("scolia_events")
        .select("id, type, payload")
        .gt("id", lastEventIdRef.current)
        .order("id", { ascending: true })
        .then(({ data }) => {
          if (cancelled) return;
          if (data) {
            noteAlive();
            (data as EventRow[]).forEach(processEventRow);
          }
        });
    }, EVENTS_POLL_MS);

    const statusPoll = setInterval(() => {
      client
        .from("scolia_status")
        .select("*")
        .eq("id", "current")
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          if (data) applyStatusRow(data as StatusRow);
          else noteAlive();
        });
    }, STATUS_POLL_MS);

    // Purely a UI signal (drives the ScoliaStatusBadge) — takes no corrective
    // action itself, since both realtime and polling already run unconditionally.
    const staleCheck = setInterval(() => {
      if (!lastSeenAtRef.current || Date.now() - lastSeenAtRef.current <= STALE_AFTER_MS) return;
      setState((s) => (s.relay === "stale" ? s : { ...s, relay: "stale" }));
    }, 15_000);

    return () => {
      cancelled = true;
      if (channels) {
        getRealtimeClient().then((realtimeClient) => {
          if (!realtimeClient || !channels) return;
          realtimeClient.removeChannel(channels.status);
          realtimeClient.removeChannel(channels.events);
        });
      }
      clearInterval(eventsPoll);
      clearInterval(statusPoll);
      clearInterval(staleCheck);
    };
  }, [enabled]);

  return { state };
}
