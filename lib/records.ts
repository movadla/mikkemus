import { buildMatchLog } from "./matchLog";
import { bestWinDarts } from "./bestWin";
import { shownHitPct, type PlayerRecord } from "./playerRows";

export type RecordHolder = { name: string; value: number; /** Shown under the name, e.g. the date or the opponent. */ note?: string };
export type RecordList = {
  key: string;
  title: string;
  /** How the value is written. */
  format: (v: number) => string;
  /** The best three, best first. */
  holders: RecordHolder[];
};

const MIN_DARTS_PCT = 20;
const MIN_DARTS_ALL = 100;
/** Measured darts a match needs before its MED counts as a record: a handful of darts can be lucky. */
const MIN_THROWS_MED = 20;
const MIN_BULL_THROWS = 20;
const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function top(rows: RecordHolder[], low: boolean, n = 3): RecordHolder[] {
  return [...rows].sort((a, b) => (low ? a.value - b.value : b.value - a.value)).slice(0, n);
}

function winStreak(history: PlayerRecord["matchHistory"]): number {
  let best = 0;
  let run = 0;
  for (const m of history) {
    run = m.won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The records of the group: the best three on each, from what the player records have kept. Lists with nobody on them are left out. */
export function buildRecords(records: PlayerRecord[]): RecordList[] {
  const people = records.filter((r) => r.kind !== "team");
  const lists: RecordList[] = [];
  const add = (key: string, title: string, format: (v: number) => string, rows: RecordHolder[], low = false) => {
    const holders = top(rows, low);
    if (holders.length > 0) lists.push({ key, title, format, holders });
  };
  const n = (v: number) => String(Math.round(v));

  add("run", "Lengste serie: treff på rad", (v) => `${v} på rad`, people.filter((r) => (r.bestRun ?? 0) > 0).map((r) => ({ name: r.name, value: r.bestRun as number })));
  add("fast", "Seier på færrest piler", (v) => `${v} piler`, people.map((r) => ({ name: r.name, value: bestWinDarts(r) })).filter((h): h is { name: string; value: number } => h.value !== null), true);

  const matches = people.flatMap((r) => r.matchHistory.filter((m) => m.dartsUsed >= MIN_DARTS_PCT).map((m) => ({ r, m })));
  add("hit", "Høyeste treffprosent i en kamp", (v) => `${n(v)} %`, matches.map(({ r, m }) => ({ name: r.name, value: shownHitPct(m), note: day(m.date) })));
  add("med", "Beste presisjon i en kamp (MED)", (v) => `${n(v)} mm`, matches.filter(({ m }) => m.med !== null && (m.throws ?? 0) >= MIN_THROWS_MED).map(({ r, m }) => ({ name: r.name, value: m.med as number, note: day(m.date) })), true);

  add("streak", "Lengste seiersrekke", (v) => `${v} på rad`, people.map((r) => ({ name: r.name, value: winStreak(r.matchHistory) })).filter((h) => h.value >= 2));
  add("wins", "Flest seire", n, people.filter((r) => r.matchesWon > 0).map((r) => ({ name: r.name, value: r.matchesWon })));
  add(
    "pct",
    "Beste treffprosent totalt",
    (v) => `${n(v)} %`,
    people.filter((r) => r.overall.hits + r.overall.misses >= MIN_DARTS_ALL).map((r) => ({ name: r.name, value: (r.overall.hits / (r.overall.hits + r.overall.misses)) * 100 })),
  );
  add(
    "bull",
    "Beste bull-duell",
    (v) => `${n(v)} %`,
    people.filter((r) => r.bullDuel.throws >= MIN_BULL_THROWS).map((r) => ({ name: r.name, value: ((r.bullDuel.redHits + r.bullDuel.greenHits) / r.bullDuel.throws) * 100 })),
  );

  const margins = buildMatchLog(records)
    .filter((m) => m.winner && m.margin !== null && m.margin > 0)
    .map((m) => ({ name: m.winner as string, value: m.margin as number, note: `${day(m.date)} mot ${m.sides.filter((s) => s.name !== m.winner).map((s) => s.name).join(", ")}` }));
  add("margin", "Største seier: streker igjen hos taperen", (v) => `${v} streker`, margins);
  return lists;
}
