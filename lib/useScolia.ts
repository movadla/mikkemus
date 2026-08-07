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

// The relay heartbeats every 30s (see scripts/scolia-relay.ts) — anything much older
// than that means the relay process probably isn't running right now.
const STALE_AFTER_MS = 90_000;

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
 * REST calls (lib/storage.ts, the initial status fetch below) are unaffected
 * and keep using the normal bundled client from ./supabaseClient.
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

    let cancelled = false;
    const lastSeenAtRef = { current: 0 };
    let channels: { status: ReturnType<SupabaseClient["channel"]>; events: ReturnType<SupabaseClient["channel"]> } | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;

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

    function scheduleReconnect(client: SupabaseClient) {
      if (reconnectTimer || cancelled) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
        subscribe(client);
      }, reconnectDelay);
    }

    function handleChannelStatus(client: SupabaseClient, status: string, err: unknown) {
      if (cancelled) return;
      if (status === "SUBSCRIBED") reconnectDelay = 1000;
      else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") scheduleReconnect(client);
      if (err) void err;
    }

    function subscribe(client: SupabaseClient) {
      if (channels) {
        client.removeChannel(channels.status);
        client.removeChannel(channels.events);
      }

      const statusChannel = client
        .channel(`scolia-status-changes-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "scolia_status" }, (payload) => {
          applyStatusRow(payload.new as StatusRow);
        })
        .subscribe((status, err) => handleChannelStatus(client, status, err));

      const eventsChannel = client
        .channel(`scolia-events-stream-${Date.now()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "scolia_events" }, (payload) => {
          const row = payload.new as { type: string; payload: unknown };
          lastSeenAtRef.current = Date.now();
          if (row.type === "THROW_DETECTED") callbacksRef.current.onThrow?.(row.payload as ThrowDetectedPayload);
          else if (row.type === "TAKEOUT_STARTED") callbacksRef.current.onTakeoutStarted?.();
          else if (row.type === "TAKEOUT_FINISHED") callbacksRef.current.onTakeoutFinished?.(row.payload as TakeoutFinishedPayload);
        })
        .subscribe((status, err) => handleChannelStatus(client, status, err));

      channels = { status: statusChannel, events: eventsChannel };
    }

    // The initial read-once status fetch is plain REST, unaffected by the
    // Realtime bundling issue, so it stays on the normal bundled client.
    supabase
      .from("scolia_status")
      .select("*")
      .eq("id", "current")
      .maybeSingle()
      .then(({ data }) => applyStatusRow(data as StatusRow | null));

    getRealtimeClient().then((client) => {
      if (cancelled || !client) return;
      subscribe(client);
    });

    // The events channel only fires when a dart is actually thrown, so silence
    // there doesn't mean it's dead — unlike the status channel, it has no
    // heartbeat to go quiet on. Recreate both channels on a fixed cadence
    // regardless of apparent health, so a silently-dropped events channel can
    // never stay dead longer than this interval.
    const periodicReconnect = setInterval(() => {
      getRealtimeClient().then((client) => {
        if (!cancelled && client) subscribe(client);
      });
    }, 60_000);

    const staleCheck = setInterval(() => {
      if (!lastSeenAtRef.current || Date.now() - lastSeenAtRef.current <= STALE_AFTER_MS) return;
      setState((s) => (s.relay === "stale" ? s : { ...s, relay: "stale" }));
    }, 15_000);

    return () => {
      cancelled = true;
      if (channels) {
        getRealtimeClient().then((client) => {
          if (!client || !channels) return;
          client.removeChannel(channels.status);
          client.removeChannel(channels.events);
        });
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(staleCheck);
      clearInterval(periodicReconnect);
    };
  }, [enabled]);

  return { state };
}
