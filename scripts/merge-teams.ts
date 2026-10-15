/**
 * Turns pair-named "players" into teams with the statistics they had — a one-off for the rows
 * made before teams had a record of their own (see lib/playerRows.ts).
 *
 *   npx tsx scripts/merge-teams.ts          prints what would be written and deleted, writes nothing
 *   npx tsx scripts/merge-teams.ts --apply  writes the teams, makes the new players, deletes the old rows
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local. The database
 * needs the two team columns first (supabase-setup-teams.sql); without them --apply fails on the
 * first write and nothing is deleted.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { mergeRecords } from "../lib/mergeRecords";
import { emptyRecord, recordKey, recordToRow, rowToRecord, type PlayerRecord, type PlayerRow } from "../lib/playerRows";

/** What becomes what. `from` are the rows folded together; `members` are made as players if missing.
 *  A row that already has the team's name just changes kind. Run so far (2026-10-15):
 *  E L → Erik & Lars; H V + Vadla og Hans → Vadla & Hans; then the seven below. */
const MERGES: { from: string[]; name: string; members: string[] }[] = [
  { from: ["Hans og Lars"], name: "Hans & Lars", members: ["Hans", "Lars"] },
  { from: ["Lars og Monge"], name: "Lars & Monge", members: ["Lars", "Monge"] },
  { from: ["Moen & Monge"], name: "Moen & Monge", members: ["Moen", "Monge"] },
  { from: ["Moen og Hans"], name: "Moen & Hans", members: ["Moen", "Hans"] },
  { from: ["Vadla & Lars"], name: "Vadla & Lars", members: ["Vadla", "Lars"] },
  { from: ["Vadla og Moen"], name: "Vadla & Moen", members: ["Vadla", "Moen"] },
  { from: ["Vadla og Monge"], name: "Vadla & Monge", members: ["Vadla", "Monge"] },
];

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function summary(r: PlayerRecord): string {
  const hits = r.overall.hits + r.overall.misses;
  return `${r.matchesPlayed} kamper, ${r.matchesWon} seire, ${r.overall.hits}/${hits} treff, beste ${r.bestDartsToFinish ?? "–"}, ${r.matchHistory.length} i historikk, bilde ${r.photo ? "ja" : "nei"}, lyd ${r.sound ? "ja" : "nei"}`;
}

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY mangler i .env.local");
  const db = createClient(url, key);

  const { data, error } = await db.from("players").select("*");
  if (error) throw error;
  const rows = new Map<string, PlayerRow>((data as PlayerRow[]).map((r) => [r.id, r]));

  const writes: { k: string; record: PlayerRecord }[] = [];
  const deletes: string[] = [];

  for (const m of MERGES) {
    const sources = m.from.map((n) => {
      const row = rows.get(recordKey(n));
      if (!row) throw new Error(`fant ikke raden «${n}»`);
      return rowToRecord(row);
    });
    const targetKey = recordKey(m.name);
    const existingTarget = rows.get(targetKey);
    if (existingTarget && !m.from.some((n) => recordKey(n) === targetKey)) {
      sources.unshift(rowToRecord(existingTarget));
      console.log(`«${m.name}» finnes fra før og tas med i sammenslåingen`);
    }
    const merged = mergeRecords(sources, { name: m.name, kind: "team", members: m.members });
    console.log(`\n${m.name}  ←  ${m.from.join(" + ")}`);
    sources.forEach((s) => console.log(`   ${s.name.padEnd(16)} ${summary(s)}`));
    console.log(`   ${"= lag".padEnd(16)} ${summary(merged)}  medlemmer ${merged.members!.join(", ")}`);
    writes.push({ k: targetKey, record: merged });
    for (const n of m.from) if (recordKey(n) !== targetKey) deletes.push(recordKey(n));
    for (const member of m.members) {
      if (rows.has(recordKey(member)) || writes.some((w) => w.k === recordKey(member))) continue;
      console.log(`   ny spiller: ${member}`);
      writes.push({ k: recordKey(member), record: emptyRecord(member) });
    }
  }

  console.log(`\nSkrives: ${writes.map((w) => w.record.name).join(", ")}`);
  console.log(`Slettes: ${deletes.join(", ")}`);
  if (!apply) {
    console.log("\n(tørrkjøring — kjør med --apply for å skrive)");
    return;
  }

  for (const w of writes) {
    const { error: e } = await db.from("players").upsert(recordToRow(w.k, w.record));
    if (e) throw new Error(`skriving av «${w.record.name}» feilet: ${e.message}`);
    console.log(`skrev ${w.record.name}`);
  }
  for (const id of deletes) {
    const { error: e } = await db.from("players").delete().eq("id", id);
    if (e) throw new Error(`sletting av «${id}» feilet: ${e.message}`);
    console.log(`slettet ${id}`);
  }
  console.log("ferdig");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
