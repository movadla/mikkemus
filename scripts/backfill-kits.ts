/**
 * Gives every saved team its two shirts — the default ones for its people (lib/teamKit.ts) — where
 * it has none yet. A one-off for the teams from before shirts were stored; a team made after that
 * gets them when it is made. Needs the `kits` column (supabase-setup-teams.sql).
 *
 *   npx tsx scripts/backfill-kits.ts          prints which teams would get shirts, writes nothing
 *   npx tsx scripts/backfill-kits.ts --apply  writes them
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { defaultKits } from "../lib/teamKit";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY mangler i .env.local");
  const db = createClient(url, key);

  const { data, error } = await db.from("players").select("id,name,kind,members,kits").eq("kind", "team");
  if (error) throw error;
  const rows = data as { id: string; name: string; members: string[] | null; kits: unknown }[];
  const missing = rows.filter((r) => !r.kits);
  for (const r of rows) {
    const kits = defaultKits(r.members ?? []);
    console.log(`${r.name.padEnd(16)} ${r.kits ? "har drakter" : `får ${kits.home.primary}/${kits.home.pattern} og ${kits.away.primary}/${kits.away.pattern}`}`);
  }
  if (!apply) {
    console.log(`\n${missing.length} lag mangler drakter (tørrkjøring — kjør med --apply for å skrive)`);
    return;
  }
  for (const r of missing) {
    const { error: e } = await db.from("players").update({ kits: defaultKits(r.members ?? []) }).eq("id", r.id);
    if (e) throw new Error(`skriving av «${r.name}» feilet: ${e.message}`);
    console.log(`skrev ${r.name}`);
  }
  console.log("ferdig");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
