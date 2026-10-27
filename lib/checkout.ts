/**
 * The way out in 301 and 501: what to throw with three darts or fewer to take the number to nothing. With a double out the last dart
 * has to be a double (or the bull); without it any dart can be the last. Fewest darts first, then the way a player would call it:
 * a treble or the bull to start, and a double that is easy to find again if the last one misses.
 */

type Dart = { label: string; value: number; double: boolean; weight: number };

/** The doubles players like to be left on, best first: a miss on D16 leaves D8, a miss on D20 leaves D10. */
const DOUBLE_PREFERENCE = [20, 16, 8, 10, 12, 18, 14, 6, 4, 2, 13, 15, 17, 19, 11, 9, 7, 5, 3, 1];

const DARTS: Dart[] = (() => {
  const all: Dart[] = [];
  for (let n = 1; n <= 20; n++) {
    all.push({ label: String(n), value: n, double: false, weight: 3 });
    all.push({ label: `D${n}`, value: n * 2, double: true, weight: DOUBLE_PREFERENCE.indexOf(n) });
    all.push({ label: `T${n}`, value: n * 3, double: false, weight: n >= 15 ? 0 : 1 });
  }
  all.push({ label: "25", value: 25, double: false, weight: 3 });
  all.push({ label: "Bull", value: 50, double: true, weight: 1 });
  return all;
})();

export const MAX_CHECKOUT = 170;

/** The ways out of `left`, best first, as a list of darts ("T20", "T20", "Bull"). Empty when there is none (or nothing to finish). */
export function checkoutsOf(left: number, doubleOut: boolean, limit = 1): string[][] {
  if (left < 2 && doubleOut) return [];
  if (left < 1 || left > MAX_CHECKOUT) return [];
  const found: { darts: Dart[]; score: number }[] = [];
  const ends = (d: Dart) => !doubleOut || d.double;
  for (const a of DARTS) {
    if (a.value === left && ends(a)) found.push({ darts: [a], score: 0 });
  }
  for (const a of DARTS) {
    for (const b of DARTS) {
      if (a.value + b.value === left && ends(b)) found.push({ darts: [a, b], score: 0 });
    }
  }
  for (const a of DARTS) {
    for (const b of DARTS) {
      for (const c of DARTS) {
        if (a.value + b.value + c.value === left && ends(c)) found.push({ darts: [a, b, c], score: 0 });
      }
    }
  }
  for (const f of found) {
    const first = f.darts.slice(0, -1);
    const last = f.darts[f.darts.length - 1];
    // Fewer darts is far better; then the best last dart; then the big dart first (high value up front, treble over single).
    f.score = f.darts.length * 1000 + last.weight * 10 + first.reduce((s, d) => s + d.weight * 3 + (d.value >= 40 ? 0 : 5), 0) - first.reduce((s, d) => s + d.value / 10, 0) - (first[0]?.value ?? 0) / 100;
  }
  found.sort((x, y) => x.score - y.score);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const f of found) {
    const key = f.darts.map((d) => d.label).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f.darts.map((d) => d.label));
    if (out.length >= limit) break;
  }
  return out;
}

/** The best way out as one line ("T20 T20 Bull"), or null when there is none. */
export function checkoutLine(left: number, doubleOut: boolean): string | null {
  const best = checkoutsOf(left, doubleOut, 1)[0];
  return best ? best.join(" ") : null;
}
