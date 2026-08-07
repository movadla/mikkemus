const WS_URL = "wss://game.scoliadarts.com/api/v1/external";

export type BoardStatus = "Offline" | "Updating" | "Initializing" | "Calibrating" | "Ready" | "Error";
export type BoardPhase = "Throw" | "Takeout" | null;
export type BoardErrorType = "Camera" | "Calibrate" | null;

export type ThrowDetectedPayload = {
  sector: string;
  coordinates: [number, number];
  angle: { vertical: number; horizontal: number };
  bounceout: boolean;
  sectorSuggestions: string[];
  detectionTime: string;
};

export type TakeoutFinishedPayload = { falseTakeout: boolean; time: string };
export type TakeoutStartedPayload = { time: string };
export type BoardStatusPayload = { boardStatus: BoardStatus; boardPhase: BoardPhase; errorType?: BoardErrorType };

/** Closes the caller should treat as permanent — reconnecting with the same credentials will just fail again. */
const TERMINAL_CLOSE_CODES = new Set([4100, 4102, 4103]);

type Listeners = {
  onStatus: (payload: BoardStatusPayload) => void;
  onThrow: (payload: ThrowDetectedPayload) => void;
  onTakeoutStarted: (payload: TakeoutStartedPayload) => void;
  onTakeoutFinished: (payload: TakeoutFinishedPayload) => void;
  /** Connection-level state, distinct from board status — "connecting"/"open" is the WS itself, not the SBC. */
  onConnectionChange: (state: ConnectionState) => void;
};

export type ConnectionState =
  | { kind: "connecting" }
  | { kind: "open" }
  | { kind: "closed"; code: number; terminal: boolean };

function randomUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older environments — good enough for a debugging-only id, not security-sensitive.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Thin typed wrapper around the Scolia External API WebSocket. One instance per board connection. */
export class ScoliaConnection {
  private ws: WebSocket | null = null;
  private listeners: Partial<Listeners> = {};

  constructor(
    private serialNumber: string,
    private accessToken: string
  ) {}

  on<K extends keyof Listeners>(event: K, handler: Listeners[K]) {
    this.listeners[event] = handler;
  }

  connect(forceConnect = false) {
    const params = new URLSearchParams({ serialNumber: this.serialNumber, accessToken: this.accessToken });
    if (forceConnect) params.set("forceConnect", "true");
    this.listeners.onConnectionChange?.({ kind: "connecting" });
    const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
    this.ws = ws;

    ws.onopen = () => this.listeners.onConnectionChange?.({ kind: "open" });

    ws.onclose = (event) => {
      this.listeners.onConnectionChange?.({
        kind: "closed",
        code: event.code,
        terminal: TERMINAL_CLOSE_CODES.has(event.code),
      });
    };

    ws.onmessage = (event) => {
      let message: { type: string; payload?: unknown };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (message.type) {
        case "HELLO_CLIENT":
        case "SBC_STATUS":
        case "SBC_STATUS_CHANGED":
          this.listeners.onStatus?.(message.payload as BoardStatusPayload);
          break;
        case "THROW_DETECTED":
          this.listeners.onThrow?.(message.payload as ThrowDetectedPayload);
          break;
        case "TAKEOUT_STARTED":
          this.listeners.onTakeoutStarted?.(message.payload as TakeoutStartedPayload);
          break;
        case "TAKEOUT_FINISHED":
          this.listeners.onTakeoutFinished?.(message.payload as TakeoutFinishedPayload);
          break;
        // ACKNOWLEDGED / REFUSED / CAMERA_IMAGES / SBC_CONFIGURATION / SBC_BOARD_AVAILABILITY_CHANGED
        // are not needed for basic scoring and are intentionally left unhandled.
      }
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  private send(type: string, payload?: Record<string, unknown>) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, id: randomUuid(), ...(payload ? { payload } : {}) }));
  }

  getStatus() {
    this.send("GET_SBC_STATUS");
  }

  recalibrate() {
    this.send("RECALIBRATE");
  }

  resetPhase() {
    this.send("RESET_PHASE");
  }

  /** throwIndex is 0/1/2 — the dart's position within the current round of 3. */
  throwCorrected(throwIndex: 0 | 1 | 2) {
    this.send("THROW_CORRECTED", { throwIndex });
  }

  /** Must be sent whenever the app deletes a throw, to keep the SBC's phase in sync (per Scolia docs). */
  deleteThrow(throwIndex: 0 | 1 | 2) {
    this.send("DELETE_THROW", { throwIndex });
  }
}
