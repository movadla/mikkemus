import { useEffect, useRef, useState } from "react";
import {
  ScoliaConnection,
  type BoardErrorType,
  type BoardPhase,
  type BoardStatus,
  type ConnectionState,
  type TakeoutFinishedPayload,
  type ThrowDetectedPayload,
} from "./scoliaClient";

export type ScoliaCallbacks = {
  onThrow?: (payload: ThrowDetectedPayload) => void;
  onTakeoutStarted?: () => void;
  onTakeoutFinished?: (payload: TakeoutFinishedPayload) => void;
};

export type ScoliaState = {
  connection: ConnectionState;
  boardStatus: BoardStatus | null;
  boardPhase: BoardPhase;
  errorType: BoardErrorType;
};

/**
 * Owns a single ScoliaConnection for the app's lifetime while enabled. Callbacks are read
 * through a ref so callers can pass fresh closures every render without tearing the socket down.
 */
export function useScolia(
  serialNumber: string | undefined,
  accessToken: string | undefined,
  enabled: boolean,
  callbacks: ScoliaCallbacks
) {
  const [state, setState] = useState<ScoliaState>({
    connection: { kind: "connecting" },
    boardStatus: null,
    boardPhase: null,
    errorType: null,
  });
  const connectionRef = useRef<ScoliaConnection | null>(null);
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  function wireConnection(conn: ScoliaConnection) {
    conn.on("onConnectionChange", (connection) => setState((s) => ({ ...s, connection })));
    conn.on("onStatus", (payload) =>
      setState((s) => ({
        ...s,
        boardStatus: payload.boardStatus,
        boardPhase: payload.boardPhase,
        errorType: payload.errorType ?? null,
      }))
    );
    conn.on("onThrow", (payload) => callbacksRef.current.onThrow?.(payload));
    conn.on("onTakeoutStarted", () => callbacksRef.current.onTakeoutStarted?.());
    conn.on("onTakeoutFinished", (payload) => callbacksRef.current.onTakeoutFinished?.(payload));
  }

  useEffect(() => {
    if (!enabled || !serialNumber || !accessToken) return;

    const conn = new ScoliaConnection(serialNumber, accessToken);
    connectionRef.current = conn;
    wireConnection(conn);
    conn.connect();

    return () => {
      conn.disconnect();
      connectionRef.current = null;
    };
  }, [serialNumber, accessToken, enabled]);

  return {
    state,
    /** Takes over the connection slot — use after a stale tab/crash left the old socket dangling. */
    reconnectWithForce: () => {
      if (!serialNumber || !accessToken) return;
      connectionRef.current?.disconnect();
      const conn = new ScoliaConnection(serialNumber, accessToken);
      connectionRef.current = conn;
      wireConnection(conn);
      conn.connect(true);
    },
    recalibrate: () => connectionRef.current?.recalibrate(),
    resetPhase: () => connectionRef.current?.resetPhase(),
    throwCorrected: (i: 0 | 1 | 2) => connectionRef.current?.throwCorrected(i),
    deleteThrow: (i: 0 | 1 | 2) => connectionRef.current?.deleteThrow(i),
  };
}
