import { useSyncExternalStore } from "react";
import { reportError } from "./errorReporting";
import { STEPS, type Step, type TurnAggregate } from "./game";
import { supabase } from "./supabaseClient";
import { defaultKits, type TeamKits } from "./teamKit";
import { cleanTeamName } from "./teamNames";
import type { WalkOnChoice } from "./fanfare";
import { mergeMemberStats } from "./memberStats";
import { START_RATING, ratingChange, replayRatings } from "./rating";
import {
  emptyRecord,
  recordKey as key,
  recordToRow,
  rowToRecord,
  type AccuracyStat,
  type BullDuelStat,
  type HitStat,
  type MatchHistoryEntry,
  type MemberStat,
  type PlayerRecord,
  type PlayerRow,
  type RingHits,
} from "./playerRows";

export type { AccuracyStat, BullDuelStat, HitStat, LuckStat, MatchHistoryEntry, MemberStat, PlayerRecord, RecordKind, RingHits } from "./playerRows";

type Roster = Record<string, PlayerRecord>;

// In-memory cache, kept in sync with the Supabase "players" table so every
// device sees the same roster. useSyncExternalStore needs a stable snapshot
// reference, so cache the derived arrays and only recompute on real changes.
let roster: Roster = {};
const listeners = new Set<() => void>();
const EMPTY_ARRAY: never[] = [];
let cachedNames: string[] = EMPTY_ARRAY;
let cachedRecords: PlayerRecord[] = EMPTY_ARRAY;
let cachedTeams: PlayerRecord[] = EMPTY_ARRAY;

function recomputeSnapshots() {
  cachedRecords = Object.values(roster).sort((a, b) => a.name.localeCompare(b.name, "no"));
  // The names the pickers offer are people. Teams are picked as teams (see useTeamRecords).
  cachedNames = cachedRecords.filter((p) => p.kind !== "team").map((p) => p.name);
  cachedTeams = cachedRecords.filter((p) => p.kind === "team");
}

function notify() {
  recomputeSnapshots();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A transient network blip must not silently drop a write — retries a couple of times
 *  with a short backoff before giving up and logging, since these calls are fire-and-forget
 *  from the caller's perspective (the in-memory roster is already updated optimistically). */
async function withRetry(run: () => PromiseLike<{ error: { message: string } | null }>, failureLabel: string, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { error } = await run();
    if (!error) return;
    if (attempt === attempts - 1) {
      console.error(failureLabel, error.message);
      reportError(failureLabel.replace(/:$/, ""), { key: failureLabel });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
}

/** The writes of one row, one at a time and in the order they were asked for. A finished match writes the same row
 *  half a dozen times, each with its own retries, and without this an older write that was held up could arrive after
 *  a newer one and be what the database ends on. */
const writeChains = new Map<string, Promise<void>>();
function inOrder(k: string, task: () => Promise<void>): Promise<void> {
  const next = (writeChains.get(k) ?? Promise.resolve()).then(task, task);
  writeChains.set(k, next);
  void next.finally(() => {
    if (writeChains.get(k) === next) writeChains.delete(k);
  });
  return next;
}

async function upsertRow(k: string, record: PlayerRecord) {
  if (!supabase) return;
  const client = supabase;
  await inOrder(k, async () => {
    // What the record is by the time its turn comes, not what it was when asked: a later change is in it already.
    // A record deleted in the meantime is not written back.
    const latest = roster[k];
    if (!latest && record) return;
    await withRetry(() => client.from("players").upsert(recordToRow(k, latest)), "Kunne ikke lagre spiller i Supabase:");
  });
}

/** Writes only the rating of a row: a recalculation must not carry a copy of the rest of the row that another
 *  device may have changed since it was fetched. */
async function updateRating(k: string, rating: number, rated: number) {
  if (!supabase) return;
  const client = supabase;
  await inOrder(k, () => withRetry(() => client.from("players").update({ rating, rated_matches: rated }).eq("id", k), "Kunne ikke lagre rating i Supabase:"));
}

async function deleteRow(k: string) {
  if (!supabase) return;
  const client = supabase;
  await inOrder(k, () => withRetry(() => client.from("players").delete().eq("id", k), "Kunne ikke slette spiller i Supabase:"));
}

let initialized = false;

const CACHE_KEY = "mikke-mus-roster-cache";

/** The roster as it was the last time it was fetched, kept on this device so the setup screen has
 *  the players the moment it opens instead of waiting for the network. It is only what to show
 *  first: the fetch below always replaces it. Never throws — full or blocked storage just means
 *  no head start. */
function readRosterCache(): Roster | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Roster;
  } catch {
    return null;
  }
}

function writeRosterCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(roster));
  } catch {
    // Too big for the quota, or storage is blocked: the next visit just waits for the network.
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Nothing more to do.
    }
  }
}

/** Fetches the roster once and subscribes to realtime changes from other devices. Safe to call repeatedly. */
function ensureInitialized() {
  if (initialized || typeof window === "undefined" || !supabase) return;
  initialized = true;

  // Last visit's roster straight away, so nothing waits for the fetch. Set without notifying:
  // this runs from inside a snapshot read, and the snapshot is recomputed right here instead.
  const cached = readRosterCache();
  if (cached) {
    roster = cached;
    recomputeSnapshots();
  }

  supabase
    .from("players")
    .select("*")
    .then(({ data, error }) => {
      if (error) {
        console.error("Kunne ikke hente spillere fra Supabase:", error.message);
        // With last visit's roster on screen the list is usable; only say so when there is nothing.
        if (!cached) reportError("Kunne ikke hente spillerliste. Prøv å laste siden på nytt.", { key: "roster-fetch" });
        return;
      }
      const next: Roster = {};
      (data as PlayerRow[]).forEach((row) => {
        next[row.id] = rowToRecord(row);
      });
      roster = next;
      rebuildRatings();
      notify();
      writeRosterCache();
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

/** Starts loading the roster now — called when the app opens, so by the time someone reaches the
 *  setup screen the players are already there. */
export function preloadRoster() {
  ensureInitialized();
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

/** Client-only read of the full roster — players and teams — safe to call during render. */
export function useRoster(): PlayerRecord[] {
  return useSyncExternalStore(subscribe, cachedRecordsSnapshot, () => EMPTY_ARRAY);
}

function cachedTeamsSnapshot(): PlayerRecord[] {
  ensureInitialized();
  return cachedTeams;
}

/** The teams that have a record of their own — the ones with statistics. */
export function useTeamRecords(): PlayerRecord[] {
  return useSyncExternalStore(subscribe, cachedTeamsSnapshot, () => EMPTY_ARRAY);
}

export function getPlayerRecord(name: string): PlayerRecord | undefined {
  ensureInitialized();
  return roster[key(name)];
}

export function ensurePlayer(name: string): PlayerRecord {
  ensureInitialized();
  const k = key(name);
  if (!roster[k]) {
    const record = emptyRecord(name);
    roster = { ...roster, [k]: record };
    notify();
    upsertRow(k, record);
  }
  return roster[k];
}

/**
 * The record a team's matches are written to. Made the first time the team plays; a row that
 * already exists under that name — a pair name someone once entered as a player — becomes the
 * team, keeping whatever statistics it had. The members are refreshed each time, so a renamed
 * player follows.
 */
export function ensureTeam(name: string, members: string[]): PlayerRecord {
  ensureInitialized();
  const k = key(name);
  const existing = roster[k];
  const sameMembers = existing?.kind === "team" && JSON.stringify(existing.members ?? []) === JSON.stringify(members);
  if (existing && sameMembers && existing.kits) return existing;
  // Every saved team has its two shirts from the start; a team from before they were stored gets
  // its default ones the next time it plays.
  const kits = existing?.kits ?? defaultKits(members);
  const record: PlayerRecord = existing ? { ...existing, kind: "team", members, kits } : { ...emptyRecord(name, "team", members), kits };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
  return record;
}

/**
 * Gives a team another name. The row is keyed by the name, so this writes the team under the new
 * one and removes the old row — statistics, shirts, members and picture come along. Returns an
 * error text instead when the name will not do: empty, or already taken by a player or a team.
 */
export function renameTeam(oldName: string, newName: string): { ok: true; name: string } | { ok: false; error: string } {
  ensureInitialized();
  const name = cleanTeamName(newName);
  const from = key(oldName);
  const record = roster[from];
  if (!record || record.kind !== "team") return { ok: false, error: "Fant ikke laget" };
  if (!name) return { ok: false, error: "Laget trenger et navn" };
  const to = key(name);
  if (to !== from && roster[to]) return { ok: false, error: "Det navnet er allerede i bruk" };
  const next: PlayerRecord = { ...record, name };
  const rest = { ...roster };
  if (to !== from) delete rest[from];
  roster = { ...rest, [to]: next };
  notify();
  upsertRow(to, next);
  if (to !== from) deleteRow(from);
  return { ok: true, name };
}

/** The two shirts a team plays in — its own if it has them, otherwise the default for its people. */
export function teamKitsOf(record: PlayerRecord): TeamKits {
  return record.kits ?? defaultKits(record.kind === "team" ? record.members ?? [] : [record.name]);
}

/** Chooses the tune a player or a team walks on to, from their own page. */
export function setWalkOn(name: string, walkOn: WalkOnChoice) {
  const k = key(name);
  if (!roster[k]) return;
  const record = { ...roster[k], walkOn };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** Changes the shirts of a player or a team, from their own page. A player has one shirt, kept as both. */
export function setKits(name: string, kits: TeamKits) {
  const k = key(name);
  if (!roster[k]) return;
  const record = { ...roster[k], kits };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
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
  const existing = roster[k] ?? emptyRecord(name);

  const steps = { ...existing.steps };
  STEPS.forEach((step) => {
    steps[step] = {
      hits: steps[step].hits + (aggregate.hitsByStep[step] ?? 0),
      misses: steps[step].misses + (aggregate.missesByStep[step] ?? 0),
    };
  });

  // Darts actually thrown — hits counts crosses, so a triple would add two darts nobody threw.
  const dartsUsed = aggregate.darts;
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

/** Keeps the longest run of counting darts (in darts) if this match beat the old one. */
export function recordBestRun(name: string, darts: number) {
  const k = key(name);
  const existing = roster[k];
  if (!existing || darts <= (existing.bestRun ?? 0)) return;
  const record = { ...existing, bestRun: darts };
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

/** Rolls one player's per-throw "Expected Goals" samples from a finished match into their career mean, broken down per section (see lib/dartboard.ts's luckForThrow). */
export function recordLuckTotals(name: string, totalsByStep: Record<Step, { sum: number; count: number }>) {
  if (STEPS.every((step) => totalsByStep[step].count === 0)) return;
  const k = key(name);
  const existing = roster[k] ?? ensurePlayer(name);
  const luck = { ...existing.luck };
  STEPS.forEach((step) => {
    const totals = totalsByStep[step];
    if (totals.count === 0) return;
    luck[step] = { sum: luck[step].sum + totals.sum, count: luck[step].count + totals.count };
  });
  const record = { ...existing, luck };
  roster = { ...roster, [k]: record };
  notify();
  upsertRow(k, record);
}

/** Rolls one player's Bull-duell match totals (kast/treff/xG) into their career stats. Only called for a match that actually finished — see lib/bullDuel.ts. */
export function recordBullDuelMatch(name: string, totals: BullDuelStat) {
  if (totals.throws === 0) return;
  const k = key(name);
  const existing = roster[k] ?? ensurePlayer(name);
  const bullDuel: BullDuelStat = {
    throws: existing.bullDuel.throws + totals.throws,
    points: existing.bullDuel.points + totals.points,
    redHits: existing.bullDuel.redHits + totals.redHits,
    greenHits: existing.bullDuel.greenHits + totals.greenHits,
    luckSum: existing.bullDuel.luckSum + totals.luckSum,
    luckCount: existing.bullDuel.luckCount + totals.luckCount,
  };
  const record = { ...existing, bullDuel };
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

/** Works every rating out again from the matches on record, and writes those that differ from what is stored: a
 *  rating always follows the matches, so a change of rules, or a match that came in late, corrects itself. */
function rebuildRatings() {
  const replayed = replayRatings(Object.values(roster));
  for (const [k, record] of Object.entries(roster)) {
    const r = replayed.get(record.name) ?? { rating: START_RATING, rated: 0 };
    if (record.rating === r.rating && (record.ratedMatches ?? 0) === r.rated) continue;
    if (record.rating === undefined && r.rated === 0) continue;
    const next: PlayerRecord = { ...record, rating: r.rating, ratedMatches: r.rated };
    roster = { ...roster, [k]: next };
    void updateRating(k, r.rating, r.rated);
  }
}

/** The rating a player or team has now: what the matches have made of it, or where it starts. */
export const ratingOf = (record: PlayerRecord): number => record.rating ?? START_RATING;

/** What a win does to the two ratings, worked out from the records as they stand. Null if either side has no record. */
export function previewRating(winner: string, loser: string): { winner: PlayerRecord; loser: PlayerRecord; winnerDelta: number; loserDelta: number } | null {
  const w = roster[key(winner)];
  const l = roster[key(loser)];
  if (!w || !l) return null;
  const c = ratingChange({ rating: ratingOf(w), rated: w.ratedMatches ?? 0 }, { rating: ratingOf(l), rated: l.ratedMatches ?? 0 });
  return { winner: w, loser: l, ...c };
}

/** Books a won match between two sides in their ratings. Does nothing unless both have a record. */
export function recordRating(winner: string, loser: string) {
  const p = previewRating(winner, loser);
  if (!p) return;
  const w: PlayerRecord = { ...p.winner, rating: ratingOf(p.winner) + p.winnerDelta, ratedMatches: (p.winner.ratedMatches ?? 0) + 1 };
  const l: PlayerRecord = { ...p.loser, rating: ratingOf(p.loser) + p.loserDelta, ratedMatches: (p.loser.ratedMatches ?? 0) + 1 };
  roster = { ...roster, [key(winner)]: w, [key(loser)]: l };
  notify();
  upsertRow(key(winner), w);
  upsertRow(key(loser), l);
}

/** Adds one finished match to what each member of a team has done (see lib/memberStats.ts). */
export function recordMemberStats(team: string, delta: Record<string, MemberStat>) {
  if (Object.keys(delta).length === 0) return;
  const k = key(team);
  const existing = roster[k];
  if (!existing || existing.kind !== "team") return;
  const record: PlayerRecord = { ...existing, memberStats: mergeMemberStats(existing.memberStats, delta) };
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

/** Career "Expected Hits" — cumulative expected-crosses total (xG-style sum, NOT an average)
 *  across ALL sections combined, directly comparable to `record.overall.hits` (the actual
 *  crosses landed) so the two can be read side by side as "forventet / faktisk". Comparing a
 *  mean per dart to a 3-per-section target doesn't mean anything; comparing two sums does — see
 *  lib/dartboard.ts. Null with no data yet. */
export function luckSum(record: PlayerRecord): number | null {
  const totals = STEPS.reduce(
    (acc, step) => ({ sum: acc.sum + record.luck[step].sum, count: acc.count + record.luck[step].count }),
    { sum: 0, count: 0 }
  );
  return totals.count === 0 ? null : totals.sum;
}

/** Career "Expected Hits" sum for ONE section (e.g. just "T", or just "20") — comparable to
 *  `record.steps[step].hits` (actual). Null with no data yet for that section. */
export function luckSumForStep(record: PlayerRecord, step: Step): number | null {
  const stat = record.luck[step];
  return stat.count === 0 ? null : stat.sum;
}

/** Career Bull-duell hit percentage (red+green hits / darts thrown). Null with no data yet. */
export function bullDuelHitPct(record: PlayerRecord): number | null {
  if (record.bullDuel.throws === 0) return null;
  return Math.round(((record.bullDuel.redHits + record.bullDuel.greenHits) / record.bullDuel.throws) * 100);
}

/** Career Bull-duell "Expected Hits" sum — comparable to `record.bullDuel.points` (actual). See
 *  lib/dartboard.ts's luckForBullDuelThrow. Null with no data yet. */
export function bullDuelLuckSum(record: PlayerRecord): number | null {
  return record.bullDuel.luckCount === 0 ? null : record.bullDuel.luckSum;
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
