import { useSyncExternalStore } from "react";
import { STEPS, type Step, type TurnAggregate } from "./game";
import { supabase } from "./supabaseClient";

export type HitStat = { hits: number; misses: number };

/** Running totals behind the MED/MHD/MVD career stats — see lib/dartboard.ts for what they measure. */
export type AccuracyStat = { sumDistance: number; sumHorizontal: number; sumVertical: number; throws: number };

function emptyAccuracyStat(): AccuracyStat {
  return { sumDistance: 0, sumHorizontal: 0, sumVertical: 0, throws: 0 };
}

/** Keyed by the number (1–20) as a string — how many times a Triple or Double of that number has landed, regardless of how the game ended up scoring it. */
export type RingHits = Record<string, number>;

/** One completed match's own numbers, for the "over time" trend on a player's stats page — separate from the cumulative career totals above. */
export type MatchHistoryEntry = {
  date: string;
  won: boolean;
  dartsUsed: number;
  hitPct: number;
  /** This match's own MED/MHD/MVD — null if Scolia didn't detect any throws this match (manual-only play). */
  med: number | null;
  mhd: number | null;
  mvd: number | null;
};

export type PlayerRecord = {
  name: string;
  photo?: string;
  /** A short recorded clip (data URL), played when it becomes this player's turn. */
  sound?: string;
  matchesPlayed: number;
  /** Matches this player actually finished (won) — the only matches where a
   *  "darts to finish" number even makes sense. */
  matchesWon: number;
  /** Sum of hits+misses across every match this player has won. */
  dartsInWins: number;
  /** Fewest darts used in any single won match. Null until the first win. */
  bestDartsToFinish: number | null;
  overall: HitStat;
  steps: Record<Step, HitStat>;
  accuracy: AccuracyStat;
  tripleHits: RingHits;
  doubleHits: RingHits;
  matchHistory: MatchHistoryEntry[];
};

type Roster = Record<string, PlayerRecord>;

type PlayerRow = {
  id: string;
  name: string;
  photo: string | null;
  sound: string | null;
  matches_played: number;
  matches_won: number;
  darts_in_wins: number;
  overall_hits: number;
  overall_misses: number;
  steps: Record<Step, HitStat>;
  accuracy_sum_distance: number | null;
  accuracy_sum_horizontal: number | null;
  accuracy_sum_vertical: number | null;
  accuracy_throws: number | null;
  best_darts_to_finish: number | null;
  triple_hits: RingHits | null;
  double_hits: RingHits | null;
  match_history: MatchHistoryEntry[] | null;
};

function emptyStepStats(): Record<Step, HitStat> {
  const s = {} as Record<Step, HitStat>;
  STEPS.forEach((step) => (s[step] = { hits: 0, misses: 0 }));
  return s;
}

function key(name: string) {
  return name.trim().toLowerCase();
}

function rowToRecord(row: PlayerRow): PlayerRecord {
  return {
    name: row.name,
    photo: row.photo ?? undefined,
    sound: row.sound ?? undefined,
    matchesPlayed: row.matches_played,
    matchesWon: row.matches_won,
    dartsInWins: row.darts_in_wins,
    overall: { hits: row.overall_hits, misses: row.overall_misses },
    steps: row.steps,
    // Rows written before the accuracy columns existed have them as null.
    accuracy: {
      sumDistance: row.accuracy_sum_distance ?? 0,
      sumHorizontal: row.accuracy_sum_horizontal ?? 0,
      sumVertical: row.accuracy_sum_vertical ?? 0,
      throws: row.accuracy_throws ?? 0,
    },
    bestDartsToFinish: row.best_darts_to_finish ?? null,
    tripleHits: row.triple_hits ?? {},
    doubleHits: row.double_hits ?? {},
    matchHistory: row.match_history ?? [],
  };
}

function recordToRow(k: string, record: PlayerRecord): PlayerRow {
  return {
    id: k,
    name: record.name,
    photo: record.photo ?? null,
    sound: record.sound ?? null,
    matches_played: record.matchesPlayed,
    matches_won: record.matchesWon,
    darts_in_wins: record.dartsInWins,
    overall_hits: record.overall.hits,
    overall_misses: record.overall.misses,
    steps: record.steps,
    accuracy_sum_distance: record.accuracy.sumDistance,
    accuracy_sum_horizontal: record.accuracy.sumHorizontal,
    accuracy_sum_vertical: record.accuracy.sumVertical,
    accuracy_throws: record.accuracy.throws,
    best_darts_to_finish: record.bestDartsToFinish,
    triple_hits: record.tripleHits,
    double_hits: record.doubleHits,
    match_history: record.matchHistory,
  };
}

// In-memory cache, kept in sync with the Supabase "players" table so every
// device sees the same roster. useSyncExternalStore needs a stable snapshot
// reference, so cache the derived arrays and only recompute on real changes.
let roster: Roster = {};
const listeners = new Set<() => void>();
const EMPTY_ARRAY: never[] = [];
let cachedNames: string[] = EMPTY_ARRAY;
let cachedRecords: PlayerRecord[] = EMPTY_ARRAY;

function recomputeSnapshots() {
  cachedRecords = Object.values(roster).sort((a, b) => a.name.localeCompare(b.name, "no"));
  cachedNames = cachedRecords.map((p) => p.name);
}

function notify() {
  recomputeSnapshots();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function upsertRow(k: string, record: PlayerRecord) {
  if (!supabase) return;
  const { error } = await supabase.from("players").upsert(recordToRow(k, record));
  if (error) console.error("Kunne ikke lagre spiller i Supabase:", error.message);
}

async function deleteRow(k: string) {
  if (!supabase) return;
  const { error } = await supabase.from("players").delete().eq("id", k);
  if (error) console.error("Kunne ikke slette spiller i Supabase:", error.message);
}

let initialized = false;

/** Fetches the roster once and subscribes to realtime changes from other devices. Safe to call repeatedly. */
function ensureInitialized() {
  if (initialized || typeof window === "undefined" || !supabase) return;
  initialized = true;

  supabase
    .from("players")
    .select("*")
    .then(({ data, error }) => {
      if (error) {
        console.error("Kunne ikke hente spillere fra Supabase:", error.message);
        return;
      }
      const next: Roster = {};
      (data as PlayerRow[]).forEach((row) => {
        next[row.id] = rowToRecord(row);
      });
      roster = next;
      notify();
    });

  // Dev Fast Refresh can re-run this while a previous channel with the same
  // topic is still subscribed — drop it first so `.on()` never targets an
  // already-subscribed channel.
  const stale = supabase.getChannels().find((c) => c.topic === "realtime:players-changes");
  if (stale) supabase.removeChannel(stale);

  supabase
    .channel("players-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const oldId = (payload.old as { id: string }).id;
        const next = { ...roster };
        delete next[oldId];
        roster = next;
      } else {
        const row = payload.new as PlayerRow;
        roster = { ...roster, [row.id]: rowToRecord(row) };
      }
      notify();
    })
    .subscribe();
}

function cachedNamesSnapshot(): string[] {
  ensureInitialized();
  return cachedNames;
}

function cachedRecordsSnapshot(): PlayerRecord[] {
  ensureInitialized();
  return cachedRecords;
}

/** Client-only read of the roster names, safe to call during render (no effect/setState needed). */
export function useRosterNames(): string[] {
  return useSyncExternalStore(subscribe, cachedNamesSnapshot, () => EMPTY_ARRAY);
}

/** Client-only read of the full roster, safe to call during render (no effect/setState needed). */
export function useRoster(): PlayerRecord[] {
  return useSyncExternalStore(subscribe, cachedRecordsSnapshot, () => EMPTY_ARRAY);
}

export function getPlayerRecord(name: string): PlayerRecord | undefined {
  ensureInitialized();
  return roster[key(name)];
}

export function ensurePlayer(name: string): PlayerRecord {
  ensureInitialized();
  const k = key(name);
  if (!roster[k]) {
    const record: PlayerRecord = {
      name: name.trim(),
      matchesPlayed: 0,
      matchesWon: 0,
      dartsInWins: 0,
      bestDartsToFinish: null,
      overall: { hits: 0, misses: 0 },
      steps: emptyStepStats(),
      accuracy: emptyAccuracyStat(),
      tripleHits: {},
      doubleHits: {},
      matchHistory: [],
    };
    roster = { ...roster, [k]: record };
    notify();
    upsertRow(k, record);
  }
  return roster[k];
}

export function setPlayerPhoto(name: string, photo: string) {
  const k = key(name);
  if (!roster[k]) return;
  const record = { ...roster[k], photo };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

export function setPlayerSound(name: string, sound: string) {
  const k = key(name);
  if (!roster[k]) return;
  const record = { ...roster[k], sound };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** Plays a player's recorded turn-start clip, if they have one. Never throws. */
export function playPlayerSound(name: string | null) {
  if (!name || typeof window === "undefined") return;
  const sound = getPlayerRecord(name)?.sound;
  if (!sound) return;
  try {
    new Audio(sound).play().catch(() => {});
  } catch {
    // Playback can fail for all sorts of platform reasons — never let it break a turn.
  }
}

/** Permanently removes a player and all their stats/photo from the roster. */
export function deletePlayer(name: string) {
  const k = key(name);
  const next = { ...roster };
  delete next[k];
  roster = next;
  notify();
  deleteRow(k);
}

/** Rolls one player's final turn-by-turn match aggregate into their persisted stats. */
export function recordMatchResult(name: string, aggregate: TurnAggregate, won: boolean) {
  const k = key(name);
  const existing =
    roster[k] ??
    ({
      name,
      matchesPlayed: 0,
      matchesWon: 0,
      dartsInWins: 0,
      bestDartsToFinish: null,
      overall: { hits: 0, misses: 0 },
      steps: emptyStepStats(),
      accuracy: emptyAccuracyStat(),
      tripleHits: {},
      doubleHits: {},
      matchHistory: [],
    } satisfies PlayerRecord);

  const steps = { ...existing.steps };
  STEPS.forEach((step) => {
    steps[step] = {
      hits: steps[step].hits + (aggregate.hitsByStep[step] ?? 0),
      misses: steps[step].misses + (aggregate.missesByStep[step] ?? 0),
    };
  });

  const dartsUsed = aggregate.hits + aggregate.misses;
  const record: PlayerRecord = {
    ...existing,
    matchesPlayed: existing.matchesPlayed + 1,
    matchesWon: won ? existing.matchesWon + 1 : existing.matchesWon,
    dartsInWins: won ? existing.dartsInWins + dartsUsed : existing.dartsInWins,
    bestDartsToFinish:
      won && (existing.bestDartsToFinish === null || dartsUsed < existing.bestDartsToFinish)
        ? dartsUsed
        : existing.bestDartsToFinish,
    overall: {
      hits: existing.overall.hits + aggregate.hits,
      misses: existing.overall.misses + aggregate.misses,
    },
    steps,
  };

  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** Rolls one player's per-throw accuracy samples from a finished match into their career totals. */
export function recordAccuracyTotals(name: string, totals: { distance: number; horizontal: number; vertical: number; throws: number }) {
  if (totals.throws === 0) return;
  const k = key(name);
  const existing = roster[k] ?? ensurePlayer(name);
  const accuracy: AccuracyStat = {
    sumDistance: existing.accuracy.sumDistance + totals.distance,
    sumHorizontal: existing.accuracy.sumHorizontal + totals.horizontal,
    sumVertical: existing.accuracy.sumVertical + totals.vertical,
    throws: existing.accuracy.throws + totals.throws,
  };
  const record = { ...existing, accuracy };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** Appends one finished match's own numbers to the player's history — the "over time" trend on their stats page. */
export function recordMatchHistory(name: string, entry: MatchHistoryEntry) {
  const k = key(name);
  const existing = roster[k] ?? ensurePlayer(name);
  const record: PlayerRecord = { ...existing, matchHistory: [...existing.matchHistory, entry] };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** Rolls one match's Triple/Double-by-number hit counts into the player's career totals (favorite triple/double). */
export function recordRingHits(name: string, triple: RingHits, double: RingHits) {
  if (Object.keys(triple).length === 0 && Object.keys(double).length === 0) return;
  const k = key(name);
  const existing = roster[k] ?? ensurePlayer(name);
  const merge = (a: RingHits, b: RingHits): RingHits => {
    const out = { ...a };
    for (const [num, count] of Object.entries(b)) out[num] = (out[num] ?? 0) + count;
    return out;
  };
  const record: PlayerRecord = {
    ...existing,
    tripleHits: merge(existing.tripleHits, triple),
    doubleHits: merge(existing.doubleHits, double),
  };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** The number (as a step) this player hits most reliably, among the tracked numbers 20–14. Null with no throws yet at any of them. */
export function favoriteNumber(record: PlayerRecord): Step | null {
  const numberSteps = STEPS.filter((s) => !Number.isNaN(Number(s)));
  let best: Step | null = null;
  let bestPct = -1;
  let bestAttempts = 0;
  for (const step of numberSteps) {
    const stat = record.steps[step];
    const attempts = stat.hits + stat.misses;
    if (attempts === 0) continue;
    const pct = stat.hits / attempts;
    if (pct > bestPct) {
      best = step;
      bestPct = pct;
      bestAttempts = attempts;
    }
  }
  return bestAttempts > 0 ? best : null;
}

/** The specific number whose Triple/Double this player has physically landed most often — a raw frequency count, not a percentage (there's no fixed "attempts" denominator per number). Null with no ring hits recorded yet. */
export function favoriteRingNumber(hits: RingHits): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [num, count] of Object.entries(hits)) {
    if (count > bestCount) {
      best = Number(num);
      bestCount = count;
    }
  }
  return best;
}

/** Mean Euclidean Distance — average straight-line miss distance from target, in mm. Null with no data yet. */
export function meanEuclideanDistance(record: PlayerRecord): number | null {
  return record.accuracy.throws === 0 ? null : record.accuracy.sumDistance / record.accuracy.throws;
}

/** Mean Horizontal Distance — average horizontal miss component, in mm. */
export function meanHorizontalDistance(record: PlayerRecord): number | null {
  return record.accuracy.throws === 0 ? null : record.accuracy.sumHorizontal / record.accuracy.throws;
}

/** Mean Vertical Distance — average vertical miss component, in mm. */
export function meanVerticalDistance(record: PlayerRecord): number | null {
  return record.accuracy.throws === 0 ? null : record.accuracy.sumVertical / record.accuracy.throws;
}

export function averagePct(stat: HitStat): number {
  const total = stat.hits + stat.misses;
  return total === 0 ? 0 : Math.round((stat.hits / total) * 100);
}

/** Average darts used across the matches this player has actually finished. Null if they've never won. */
export function averageDartsPerWin(record: PlayerRecord): number | null {
  const wins = record.matchesWon ?? 0;
  if (wins === 0) return null;
  return Math.round((record.dartsInWins ?? 0) / wins);
}
