import { useSyncExternalStore } from "react";
import { STEPS, type Step, type TurnAggregate } from "./game";

const noopSubscribe = () => () => {};
const EMPTY_ARRAY: never[] = [];
const emptyArraySnapshot = () => EMPTY_ARRAY;

const STORAGE_KEY = "mikke-mus:roster";

// useSyncExternalStore requires getSnapshot to return a stable reference when
// nothing changed, so cache the derived arrays alongside the raw string they
// were built from and only recompute when the underlying storage differs.
let cachedRaw: string | null | undefined;
let cachedNames: string[] = EMPTY_ARRAY;
let cachedRecords: PlayerRecord[] = EMPTY_ARRAY;

export type HitStat = { hits: number; misses: number };

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
  overall: HitStat;
  steps: Record<Step, HitStat>;
};

type Roster = Record<string, PlayerRecord>;

function emptyStepStats(): Record<Step, HitStat> {
  const s = {} as Record<Step, HitStat>;
  STEPS.forEach((step) => (s[step] = { hits: 0, misses: 0 }));
  return s;
}

function key(name: string) {
  return name.trim().toLowerCase();
}

function readRoster(): Roster {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Roster) : {};
  } catch {
    return {};
  }
}

function writeRoster(roster: Roster) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
}

export function loadRosterNames(): string[] {
  return Object.values(readRoster())
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b, "no"));
}

export function loadRoster(): PlayerRecord[] {
  return Object.values(readRoster()).sort((a, b) => a.name.localeCompare(b.name, "no"));
}

function refreshCache() {
  if (typeof window === "undefined") return;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return;
  cachedRaw = raw;
  const roster: Roster = raw ? JSON.parse(raw) : {};
  cachedRecords = Object.values(roster).sort((a, b) => a.name.localeCompare(b.name, "no"));
  cachedNames = cachedRecords.map((p) => p.name);
}

function cachedNamesSnapshot(): string[] {
  refreshCache();
  return cachedNames;
}

function cachedRecordsSnapshot(): PlayerRecord[] {
  refreshCache();
  return cachedRecords;
}

/** Client-only read of the roster names, safe to call during render (no effect/setState needed). */
export function useRosterNames(): string[] {
  return useSyncExternalStore(noopSubscribe, cachedNamesSnapshot, emptyArraySnapshot);
}

/** Client-only read of the full roster, safe to call during render (no effect/setState needed). */
export function useRoster(): PlayerRecord[] {
  return useSyncExternalStore(noopSubscribe, cachedRecordsSnapshot, emptyArraySnapshot);
}

export function getPlayerRecord(name: string): PlayerRecord | undefined {
  return readRoster()[key(name)];
}

export function ensurePlayer(name: string): PlayerRecord {
  const roster = readRoster();
  const k = key(name);
  if (!roster[k]) {
    roster[k] = {
      name: name.trim(),
      matchesPlayed: 0,
      matchesWon: 0,
      dartsInWins: 0,
      overall: { hits: 0, misses: 0 },
      steps: emptyStepStats(),
    };
    writeRoster(roster);
  }
  return roster[k];
}

export function setPlayerPhoto(name: string, photo: string) {
  const roster = readRoster();
  const k = key(name);
  if (!roster[k]) return;
  roster[k].photo = photo;
  writeRoster(roster);
}

export function setPlayerSound(name: string, sound: string) {
  const roster = readRoster();
  const k = key(name);
  if (!roster[k]) return;
  roster[k].sound = sound;
  writeRoster(roster);
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
  const roster = readRoster();
  delete roster[key(name)];
  writeRoster(roster);
}

/** Rolls one player's final turn-by-turn match aggregate into their persisted stats. */
export function recordMatchResult(name: string, aggregate: TurnAggregate, won: boolean) {
  const roster = readRoster();
  const k = key(name);
  if (!roster[k]) {
    roster[k] = {
      name,
      matchesPlayed: 0,
      matchesWon: 0,
      dartsInWins: 0,
      overall: { hits: 0, misses: 0 },
      steps: emptyStepStats(),
    };
  }
  const record = roster[k];
  record.matchesPlayed += 1;
  if (won) {
    // Defensive fallback in case this record predates these two fields.
    record.matchesWon = (record.matchesWon ?? 0) + 1;
    record.dartsInWins = (record.dartsInWins ?? 0) + aggregate.hits + aggregate.misses;
  }
  record.overall.hits += aggregate.hits;
  record.overall.misses += aggregate.misses;
  STEPS.forEach((step) => {
    record.steps[step].hits += aggregate.hitsByStep[step] ?? 0;
    record.steps[step].misses += aggregate.missesByStep[step] ?? 0;
  });
  writeRoster(roster);
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
