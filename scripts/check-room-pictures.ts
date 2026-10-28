/**
 * Checks the ten pictures of the room in public/career before they are looked at in the app: that all ten are there, that they are the same
 * size, that they stand upright in the proportions of a phone (9:16), and that they are large enough and light enough. Run with
 * `npm run check:room`. The old draft pictures (300 x 360) pass the "there" and "same size" checks and get a note that they are drafts.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "career");
const COUNT = 10;
const WANT_RATIO = 9 / 16;

/** The width and height of a JPEG, read from its header, or null when it is not one. */
export function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = buf.readUInt16BE(i + 2);
    // The frame headers (baseline, extended and progressive) say how big the picture is.
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

type Row = { file: string; size?: { width: number; height: number }; kb?: number; notes: string[]; fail: boolean };

function check(n: number): Row {
  const file = `room-${String(n).padStart(2, "0")}.jpg`;
  const path = join(DIR, file);
  if (!existsSync(path)) return { file, notes: ["finnes ikke"], fail: true };
  const buf = readFileSync(path);
  const size = jpegSize(buf);
  const kb = Math.round(statSync(path).size / 1024);
  if (!size) return { file, kb, notes: ["er ikke en JPEG (lagre som .jpg)"], fail: true };
  const notes: string[] = [];
  const fail = false;
  const ratio = size.width / size.height;
  if (Math.abs(ratio - WANT_RATIO) > 0.02) notes.push(`format ${ratio.toFixed(2)}, ønsket 0,56 (9:16)`);
  if (size.height < 1600) notes.push(`lav oppløsning (${size.width} × ${size.height}), ønsket 1080 × 1920`);
  if (kb > 700) notes.push(`stor fil (${kb} kB), ønsket under 700 kB`);
  return { file, size, kb, notes, fail };
}

const rows = Array.from({ length: COUNT }, (_, i) => check(i + 1));
const first = rows.find((r) => r.size)?.size;
for (const r of rows) {
  if (r.size && first && (r.size.width !== first.width || r.size.height !== first.height)) r.notes.push(`annen størrelse enn de andre (${first.width} × ${first.height})`);
}

for (const r of rows) {
  const dims = r.size ? `${r.size.width} × ${r.size.height}` : "–";
  const mark = r.fail ? "✗" : r.notes.length ? "!" : "✓";
  console.log(`${mark} ${r.file.padEnd(12)} ${dims.padEnd(12)} ${String(r.kb ?? "").padStart(4)} kB  ${r.notes.join("; ")}`);
}
const missing = rows.filter((r) => r.fail).length;
const noted = rows.filter((r) => !r.fail && r.notes.length).length;
console.log("");
if (missing) console.log(`${missing} av ${COUNT} mangler eller er feil. Rommet i appen trenger alle ti.`);
else if (noted) console.log(`Alle ti finnes. ${noted} har merknader over: det er utkast eller kan forbedres, men appen virker.`);
else console.log("Alle ti er stående 9:16, like store og lette nok. Klar til å se i appen.");
process.exit(missing ? 1 : 0);
