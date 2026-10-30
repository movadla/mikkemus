import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Evening, NightMatch } from "./nightScore";
import { supabase } from "./supabaseClient";

/**
 * The evenings and their matches, in the table night_scores (supabase-setup-night-score.sql). Every call is fire and forget, as for the results of
 * the other games: a missing table or a bad connection is logged and nothing else, because a game must never be held up by its own score. What
 * is written before the list has arrived waits for it, so a match does not start a second evening when the database has one.
 */
export type NightSnapshot = { evenings: Evening[]; matches: NightMatch[]; loaded: boolean };
const EMPTY: NightSnapshot = { evenings: [], matches: [], loaded: false };
let snap: NightSnapshot = EMPTY;
let loading = false;
const waiting: (() => void)[] = [];
/** Writes on their way, and the ids written lately: a fresh list from the database must not take away what it has not got yet. */
let pending = 0;
const lately = new Map<string, number>();
const LATELY_MS = 60_000;
const touched = (...ids: string[]) => ids.forEach((id) => lately.set(id, Date.now()));
const isLately = (id: string) => Date.now() - (lately.get(id) ?? 0) < LATELY_MS;
async function tracked<T>(p: PromiseLike<T>): Promise<T> {
  pending++;
  try {
    return await p;
  } finally {
    pending--;
  }
}
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
const set = (next: Partial<NightSnapshot>) => {
  snap = { ...snap, ...next };
  notify();
};

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

type Row = { id: string; kind: "evening" | "match"; at: string; data: Evening | NightMatch };

const fetchRows = () => supabase!.from("night_scores").select("id, kind, at, data").order("at", { ascending: false }).limit(3000);

async function load() {
  if (snap.loaded || loading) return;
  if (!supabase) {
    set({ loaded: true });
    waiting.splice(0).forEach((f) => f());
    return;
  }
  loading = true;
  const { data, error } = await fetchRows();
  loading = false;
  if (error || !Array.isArray(data)) {
    // No table: there is no evening, and nothing waits for one.
    set({ loaded: true });
    waiting.splice(0).forEach((f) => f());
    return;
  }
  const rows = data as Row[];
  const evenings = rows.filter((r) => r.kind === "evening").map((r) => r.data as Evening);
  const matches = rows.filter((r) => r.kind === "match").map((r) => r.data as NightMatch);
  // What was written while the list was on its way is kept: it is not in the answer yet.
  set({
    loaded: true,
    evenings: [...snap.evenings.filter((e) => !evenings.some((x) => x.id === e.id)), ...evenings],
    matches: [...snap.matches.filter((m) => !matches.some((x) => x.id === m.id)), ...matches],
  });
  waiting.splice(0).forEach((f) => f());
}

let refreshedAt = 0;
let refreshing = false;

/**
 * Fetches the list again, for what other phones have written since: what the database says is taken as it is (a match changed or an evening
 * deleted elsewhere too), except what this phone wrote lately or is still writing. Not while a write is on its way, and not more than once in five seconds.
 */
export async function refreshNight(force = false): Promise<void> {
  if (!supabase || !snap.loaded || loading || refreshing || pending > 0) return;
  if (!force && Date.now() - refreshedAt < 5000) return;
  refreshing = true;
  const { data, error } = await fetchRows();
  refreshing = false;
  refreshedAt = Date.now();
  if (error || !Array.isArray(data) || pending > 0) return;
  const rows = data as Row[];
  const evenings = rows.filter((r) => r.kind === "evening").map((r) => r.data as Evening);
  const matches = rows.filter((r) => r.kind === "match").map((r) => r.data as NightMatch);
  set({
    evenings: [...snap.evenings.filter((e) => isLately(e.id) && !evenings.some((x) => x.id === e.id)), ...evenings],
    matches: [...snap.matches.filter((m) => isLately(m.id) && !matches.some((x) => x.id === m.id)), ...matches],
  });
}

/** Runs when the list is there (at once, if it is). */
function whenLoaded(f: () => void) {
  if (snap.loaded) f();
  else {
    waiting.push(f);
    void load();
  }
}

/** Comes back to the page: look again, for what the others have written while it was away. */
const onBack = () => {
  if (typeof document === "undefined" || document.visibilityState === "visible") void refreshNight();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
  }
  void load();
  void refreshNight();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    }
  };
}

/** The evenings and matches written down. Empty until they are loaded, and for good when there is no table. */
export function useNightScore(): NightSnapshot {
  return useSyncExternalStore(subscribe, () => snap, () => EMPTY);
}

/** The evening that is on: the one that began last. */
export const currentEvening = (s: NightSnapshot): Evening | null => [...s.evenings].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;

async function write(kind: "evening" | "match", id: string, at: string, data: Evening | NightMatch) {
  if (!supabase) return;
  touched(id);
  const { error } = await tracked(supabase.from("night_scores").upsert({ id, kind, at, data }, { onConflict: "id" }));
  if (error) console.warn("Kunne ikke lagre kvelden:", error.message);
}

/** A new evening begins now: the matches from here on belong to it. */
export function startNewEvening(): void {
  whenLoaded(() => {
    const e: Evening = { id: newId(), startedAt: new Date().toISOString() };
    set({ evenings: [e, ...snap.evenings] });
    void write("evening", e.id, e.startedAt, e);
  });
}

export type NewNightMatch = Omit<NightMatch, "evening" | "at"> & { at?: string };

/** Writes a match into the evening that is on (an evening is begun if there is none). The same id is only written once. */
export function recordNightMatch(input: NewNightMatch): void {
  whenLoaded(() => {
    if (snap.matches.some((m) => m.id === input.id)) return;
    let evening = currentEvening(snap);
    if (!evening) {
      evening = { id: newId(), startedAt: input.at ?? new Date().toISOString() };
      set({ evenings: [evening, ...snap.evenings] });
      void write("evening", evening.id, evening.startedAt, evening);
    }
    const at = input.at ?? new Date().toISOString();
    const m: NightMatch = { ...input, evening: evening.id, at };
    set({ matches: [m, ...snap.matches] });
    void write("match", m.id, m.at, m);
  });
}

/** Changes a match: an override, or taking it out of the evening and putting it back. */
export function updateNightMatch(id: string, patch: Partial<NightMatch>): void {
  const found = snap.matches.find((m) => m.id === id);
  if (!found) return;
  const m = { ...found, ...patch };
  // An override that is none is gone: the key is taken off, not kept as undefined.
  if ("override" in patch && patch.override === undefined) delete m.override;
  set({ matches: snap.matches.map((x) => (x.id === id ? m : x)) });
  void write("match", m.id, m.at, m);
}

/** Takes an evening away with all its matches, for good: from Kveldsscore only, what the statistics and the other lists keep is not touched. */
export function deleteEvening(id: string): void {
  const matchIds = snap.matches.filter((m) => m.evening === id).map((m) => m.id);
  set({ evenings: snap.evenings.filter((e) => e.id !== id), matches: snap.matches.filter((m) => m.evening !== id) });
  if (supabase) void tracked(supabase.from("night_scores").delete().in("id", [id, ...matchIds])).then(({ error }) => error && console.warn("Kunne ikke slette kvelden:", error.message));
}

/** Takes a match away for good: for a win that was undone, which was never a result. */
export function removeNightMatch(id: string): void {
  if (!snap.matches.some((m) => m.id === id)) return;
  set({ matches: snap.matches.filter((m) => m.id !== id) });
  if (supabase) void tracked(supabase.from("night_scores").delete().eq("id", id)).then(({ error }) => error && console.warn("Kunne ikke slette kampen:", error.message));
}

/**
 * Writes the match of a game when it has a winner, once, like the result of the game itself. A win that is taken back takes the match back too;
 * a fresh game (`fresh`: nothing thrown yet, as after Spill igjen) keeps it and starts on a new id. `build` gives null for a match that does not
 * count (a bot in it).
 */
export function useRecordNight(winner: string | null, fresh: boolean, build: (id: string) => NewNightMatch | null) {
  const latest = useRef(build);
  useEffect(() => {
    latest.current = build;
  });
  const id = useRef<string | null>(null);
  const written = useRef(false);
  useEffect(() => {
    if (winner) {
      if (written.current) return;
      id.current ??= newId();
      const m = latest.current(id.current);
      if (m) {
        written.current = true;
        recordNightMatch(m);
      }
      return;
    }
    if (!written.current) return;
    written.current = false;
    if (fresh) id.current = null;
    else if (id.current) removeNightMatch(id.current);
  }, [winner, fresh]);
}
