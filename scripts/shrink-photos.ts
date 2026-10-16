/**
 * Shrinks the pictures in the players table. They were stored as the phone's camera made them —
 * 1.4 to 3.6 MB each, 15 MB for the whole list — and the list is fetched in one go, so on a phone
 * it never finished and the players, the teams and every picture seemed to be gone. A picture is
 * shown at 72 px at the most, so 320 px on the long side is plenty.
 *
 *   npx tsx scripts/shrink-photos.ts <backup.json>          prints what would shrink, writes nothing
 *   npx tsx scripts/shrink-photos.ts <backup.json> --apply  saves the originals to the backup file
 *                                                           first, then writes the small versions
 *
 * The backup file is {id: originalDataUrl}. Restoring one picture is an update of that row's
 * `photo` with the stored text.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const MAX_SIDE = 320;
/** Anything under this is already small and is left alone. */
const SMALL_ENOUGH = 60_000;

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function shrink(dataUrl: string): Promise<string> {
  const comma = dataUrl.indexOf(",");
  const input = Buffer.from(dataUrl.slice(comma + 1), "base64");
  // rotate() applies the camera's orientation, which the resize would otherwise drop.
  const out = await sharp(input).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

async function main() {
  loadEnv();
  const backupPath = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!backupPath || backupPath.startsWith("--")) throw new Error("Oppgi en sikkerhetskopi-fil som første argument");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY mangler i .env.local");
  const db = createClient(url, key);

  const { data, error } = await db.from("players").select("id,photo");
  if (error) throw error;
  const rows = (data as { id: string; photo: string | null }[]).filter((r) => r.photo && r.photo.length > SMALL_ENOUGH);

  const originals: Record<string, string> = {};
  const small: Record<string, string> = {};
  let before = 0;
  let after = 0;
  for (const r of rows) {
    const next = await shrink(r.photo!);
    originals[r.id] = r.photo!;
    small[r.id] = next;
    before += r.photo!.length;
    after += next.length;
    console.log(`${r.id.padEnd(16)} ${(r.photo!.length / 1024).toFixed(0).padStart(6)} KB → ${(next.length / 1024).toFixed(0).padStart(4)} KB`);
  }
  console.log(`\n${rows.length} bilder: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(2)} MB`);
  if (!apply) {
    console.log("(tørrkjøring — kjør med --apply for å lagre originalene i sikkerhetskopien og skrive de små)");
    return;
  }

  // The originals are on disk before anything is changed.
  writeFileSync(backupPath, JSON.stringify(originals));
  console.log(`originalene er lagret i ${backupPath}`);
  for (const id of Object.keys(small)) {
    const { error: e } = await db.from("players").update({ photo: small[id] }).eq("id", id);
    if (e) throw new Error(`skriving av «${id}» feilet: ${e.message}`);
    console.log(`skrev ${id}`);
  }
  console.log("ferdig");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
