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
    let channels: { status: ReturnType<typeof client.channel>; events: ReturnType<typeof client.channel> } | null = null;

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

    // Supabase's realtime socket can go quiet (e.g. a dropped mobile connection)
    // without ever firing a close event, so its own reconnect logic never kicks
    // in — subscribe() picks a unique channel name each call so a stale pair can
    // be torn down and replaced without "already subscribed" errors.
    function dbgPush(entry: unknown) {
      const dbg = window as unknown as { __scoliaDebug?: unknown[] };
      dbg.__scoliaDebug ??= [];
      dbg.__scoliaDebug.push(entry);
    }

    function subscribe() {
      dbgPush({ at: "subscribe:enter" });
      let statusChannel;
      try {
        statusChannel = client
          .channel(`scolia-status-changes-${Date.now()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "scolia_status" }, (payload) => {
            applyStatusRow(payload.new as StatusRow);
          })
          .subscribe((status, err) => dbgPush({ at: "statusChannel.subscribe", status, err: err ? String(err) : null }));
        dbgPush({ at: "subscribe:statusChannelCreated" });
      } catch (err) {
        dbgPush({ at: "subscribe:statusChannel:error", err: String(err) });
        throw err;
      }

      let eventsChannel;
      try {
        eventsChannel = client
          .channel(`scolia-events-stream-${Date.now()}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "scolia_events" }, (payload) => {
            dbgPush({ at: "eventsChannel.on", payload });
            try {
              const row = payload.new as { type: string; payload: unknown };
              lastSeenAtRef.current = Date.now();
              if (row.type === "THROW_DETECTED") callbacksRef.current.onThrow?.(row.payload as ThrowDetectedPayload);
              else if (row.type === "TAKEOUT_STARTED") callbacksRef.current.onTakeoutStarted?.();
              else if (row.type === "TAKEOUT_FINISHED") callbacksRef.current.onTakeoutFinished?.(row.payload as TakeoutFinishedPayload);
            } catch (err) {
              dbgPush({ at: "eventsChannel.on:error", err: String(err) });
            }
          })
          .subscribe((status, err) => dbgPush({ at: "eventsChannel.subscribe", status, err: err ? String(err) : null }));
        dbgPush({ at: "subscribe:eventsChannelCreated" });
      } catch (err) {
        dbgPush({ at: "subscribe:eventsChannel:error", err: String(err) });
        throw err;
      }

      channels = { status: statusChannel, events: eventsChannel };
    }

    client
      .from("scolia_status")
      .select("*")
      .eq("id", "current")
      .maybeSingle()
      .then(({ data }) => applyStatusRow(data as StatusRow | null));

    try {
      subscribe();
    } catch (err) {
      dbgPush({ at: "mount:subscribe:error", err: String(err) });
    }

    function reconnect() {
      if (channels) {
        client.removeChannel(channels.status);
        client.removeChannel(channels.events);
      }
      // A dead socket rarely fires a close event, so the channels above can come
      // back "subscribed" while still riding the same broken connection — force
      // the underlying websocket itself to reconnect, not just the channels.
      client.realtime.disconnect();
      subscribe();
      client
        .from("scolia_status")
        .select("*")
        .eq("id", "current")
        .maybeSingle()
        .then(({ data }) => applyStatusRow(data as StatusRow | null));
    }

    const staleCheck = setInterval(() => {
      if (!lastSeenAtRef.current || Date.now() - lastSeenAtRef.current <= STALE_AFTER_MS) return;
      setState((s) => (s.relay === "stale" ? s : { ...s, relay: "stale" }));
    }, 15_000);

    // The events channel only fires when a dart is actually thrown, so silence
    // there doesn't mean it's dead — unlike the status channel, it has no
    // heartbeat to go quiet on. Recreate both channels on a fixed cadence
    // regardless of apparent health, so a silently-dropped events channel can
    // never stay dead longer than this interval.
    const periodicReconnect = setInterval(reconnect, 60_000);

    return () => {
      if (channels) {
        client.removeChannel(channels.status);
        client.removeChannel(channels.events);
      }
      clearInterval(staleCheck);
      clearInterval(periodicReconnect);
    };
  }, [enabled]);

  return { state };
}
