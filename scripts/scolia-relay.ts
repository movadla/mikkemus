/**
 * Holds the one WebSocket connection to Scolia and forwards throw/takeout/status
 * events into Supabase, so the deployed browser app never has to connect to Scolia
 * directly (that direct-from-browser path gets closed with an undocumented code
 * from the production origin — see project notes). Run with: npm run scolia-relay
 */
process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import { ScoliaConnection } from "../lib/scoliaClient";

const serialNumber = process.env.SCOLIA_SERIAL_NUMBER;
const accessToken = process.env.SCOLIA_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!serialNumber || !accessToken) {
  console.error("Mangler SCOLIA_SERIAL_NUMBER / SCOLIA_ACCESS_TOKEN i .env.local");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertStatus(boardStatus: string | null, boardPhase: string | null, errorType: string | null) {
  const { error } = await supabase.from("scolia_status").upsert({
    id: "current",
    board_status: boardStatus,
    board_phase: boardPhase,
    error_type: errorType,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("Kunne ikke oppdatere scolia_status:", error.message);
}

async function insertEvent(type: string, payload: unknown) {
  const { error } = await supabase.from("scolia_events").insert({ type, payload });
  if (error) console.error("Kunne ikke sette inn scolia_events-rad:", error.message);
}

const conn = new ScoliaConnection(serialNumber, accessToken);

conn.on("onConnectionChange", (state) => {
  console.log("[connection]", state);
  if (state.kind === "open") {
    console.log("[recalibrate] sender RECALIBRATE ved tilkobling");
    conn.recalibrate();
  }
  if (state.kind === "closed" && !state.terminal) {
    console.log("Kobler til på nytt om 5 sekunder...");
    setTimeout(() => conn.connect(), 5000);
  }
  if (state.kind === "closed" && state.terminal) {
    console.error("Terminal feil (ugyldig serienummer/token/suspendert) — stopper.");
    upsertStatus(null, null, null);
  }
});

/**
 * The board stops detecting throws entirely while it's in the Takeout phase — it's waiting
 * to see the darts come out. If that detection is missed (seen in practice: a TAKEOUT_STARTED
 * with no TAKEOUT_FINISHED ever following), the board sits in Takeout forever and every
 * subsequent throw is silently ignored, while the relay and the app both still look perfectly
 * healthy — status keeps heartbeating and the badge stays "Online". RESET_PHASE is the API's
 * way out; nothing was calling it. A real takeout resolves in seconds, so a full minute in
 * that phase means stuck, not slow.
 */
const STUCK_TAKEOUT_MS = 60_000;
let takeoutSince: number | null = null;

conn.on("onStatus", (payload) => {
  console.log("[status]", payload);
  if (payload.boardPhase === "Takeout") takeoutSince ??= Date.now();
  else takeoutSince = null;
  upsertStatus(payload.boardStatus, payload.boardPhase, payload.errorType ?? null);
});

conn.on("onThrow", (payload) => {
  console.log("[throw]", payload.sector, payload.coordinates);
  insertEvent("THROW_DETECTED", payload);
});

conn.on("onTakeoutStarted", (payload) => {
  console.log("[takeout started]");
  insertEvent("TAKEOUT_STARTED", payload);
});

conn.on("onTakeoutFinished", (payload) => {
  console.log("[takeout finished]", payload);
  takeoutSince = null;
  insertEvent("TAKEOUT_FINISHED", payload);
});

// Forwarded as-is (best effort) — the payload shape isn't documented anywhere we could find,
// see lib/extractImageUrls.ts for how the app tries to make sense of whatever arrives.
conn.on("onCameraImages", (payload) => {
  console.log("[camera images]", payload);
  insertEvent("CAMERA_IMAGES", payload);
});

/**
 * Commands from the app travel the same table the events do, just the other way (see
 * lib/scoliaCommands.ts for why there's no separate table). This polls for them.
 *
 * `lastCommandId` starts at whatever the newest row is RIGHT NOW, before any polling
 * begins — without that, a relay restart would find every recalibrate ever requested still
 * sitting in the table and run them all. That is the same trap the browser side fell into
 * with throw events, so it is worth being explicit about here.
 */
const COMMAND_POLL_MS = 2_000;
let lastCommandId: number | null = null;

async function pollCommands() {
  if (lastCommandId === null) return;
  const { data, error } = await supabase
    .from("scolia_events")
    .select("id, type")
    .gt("id", lastCommandId)
    .like("type", "CMD_%")
    .order("id", { ascending: true })
    .limit(10);
  if (error || !data) return;
  for (const row of data as { id: number; type: string }[]) {
    lastCommandId = Math.max(lastCommandId, row.id);
    if (row.type === "CMD_RECALIBRATE") {
      console.log("[command] RECALIBRATE bedt om fra appen");
      conn.recalibrate();
    }
  }
}

async function initCommandBaseline() {
  const { data } = await supabase
    .from("scolia_events")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  lastCommandId = (data as { id: number } | null)?.id ?? 0;
  setInterval(() => {
    pollCommands().catch(() => {});
  }, COMMAND_POLL_MS);
}
initCommandBaseline().catch((err) => console.error("Kunne ikke starte kommando-lytting:", err));

// Periodic heartbeat so the browser can tell "relay is alive" from "relay has been
// down for a while" even during long stretches with no real status change. Doubles as the
// tick that notices a board stuck in Takeout (see STUCK_TAKEOUT_MS above) and frees it.
setInterval(() => {
  if (takeoutSince !== null && Date.now() - takeoutSince > STUCK_TAKEOUT_MS) {
    console.log("[recover] brettet har stått i Takeout i over ett minutt — sender RESET_PHASE");
    conn.resetPhase();
    // Restart the clock rather than clearing it: if RESET_PHASE doesn't take, this retries
    // once a minute instead of firing on every heartbeat.
    takeoutSince = Date.now();
  }
  conn.getStatus();
}, 30_000);

conn.connect();
console.log(`Scolia-relay kjører for brett ${serialNumber}. Ctrl+C for å stoppe.`);
