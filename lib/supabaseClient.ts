import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Undefined during local dev before .env.local is filled in — callers guard on this. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
