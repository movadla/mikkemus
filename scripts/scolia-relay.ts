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
  if (state.kind === "closed" && !state.terminal) {
    console.log("Kobler til på nytt om 5 sekunder...");
    setTimeout(() => conn.connect(), 5000);
  }
  if (state.kind === "closed" && state.terminal) {
    console.error("Terminal feil (ugyldig serienummer/token/suspendert) — stopper.");
    upsertStatus(null, null, null);
  }
});

conn.on("onStatus", (payload) => {
  console.log("[status]", payload);
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
  insertEvent("TAKEOUT_FINISHED", payload);
});

// Periodic heartbeat so the browser can tell "relay is alive" from "relay has been
// down for a while" even during long stretches with no real status change.
setInterval(() => conn.getStatus(), 30_000);

conn.connect();
console.log(`Scolia-relay kjører for brett ${serialNumber}. Ctrl+C for å stoppe.`);
