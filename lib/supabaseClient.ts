import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Undefined during local dev before .env.local is filled in — callers guard on this. */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        // Without this, the bundled realtime-js's environment auto-detection has been
        // seen to pick a broken transport in Next.js production builds, failing every
        // channel with "CHANNEL_ERROR: transport failure" — forcing the native browser
        // WebSocket sidesteps that detection entirely.
        realtime: { transport: typeof WebSocket !== "undefined" ? WebSocket : undefined },
      })
    : null;

if (typeof window !== "undefined") {
  (window as unknown as { __appSupabase: unknown }).__appSupabase = supabase;
  (window as unknown as { __appCreateClient: unknown; __appUrl: unknown; __appKey: unknown }).__appCreateClient = createClient;
  (window as unknown as { __appUrl: unknown }).__appUrl = url;
  (window as unknown as { __appKey: unknown }).__appKey = anonKey;
}
