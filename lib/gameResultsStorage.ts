import { useEffect, useRef, useSyncExternalStore } from "react";
import type { GameResult } from "./gameResults";
import { supabase } from "./supabaseClient";

/**
 * The results of 301/501, Highstriker and Lava, in the table game_results (supabase-setup-game-results.sql). Every call is fire and forget:
 * a missing table or a bad connection is logged and nothing else, because a game must never be held up by its own statistics. With no
 * table there are no results, and the tab that shows them stays away.
 */
const EMPTY: GameResult[] = [];
let results: GameResult[] = EMPTY;
let loaded = false;
let loading = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

async function load() {
  if (loaded || loading || !supabase) return;
  loading = true;
  const { data, error } = await supabase.from("game_results").select("data").order("played_at", { ascending: false }).limit(1000);
  loading = false;
  if (error || !Array.isArray(data)) return;
  loaded = true;
  const fetched = (data as { data: GameResult }[]).map((r) => r.data).filter((r) => r && typeof r.id === "string" && typeof r.winner === "string" && Array.isArray(r.players));
  // What was written while the list was on its way is kept: it is not in the answer yet.
  const fresh = results.filter((r) => !fetched.some((f) => f.id === r.id));
  results = [...fresh, ...fetched];
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/** Every result written down, newest first. Empty until they are loaded, and for good when there is no table. */
export function useGameResults(): GameResult[] {
  return useSyncExternalStore(subscribe, () => results, () => EMPTY);
}

/** Writes a result (or writes it again: the id is the same for the same game). */
export async function saveGameResult(r: GameResult): Promise<void> {
  results = [r, ...results.filter((x) => x.id !== r.id)];
  notify();
  if (!supabase) return;
  const { error } = await supabase.from("game_results").upsert({ id: r.id, game: r.game, played_at: r.playedAt, data: r }, { onConflict: "id" });
  if (error) console.warn("Kunne ikke lagre resultatet:", error.message);
}

/** Takes a result back, for a win that was undone. */
export async function deleteGameResult(id: string): Promise<void> {
  results = results.filter((x) => x.id !== id);
  notify();
  if (!supabase) return;
  const { error } = await supabase.from("game_results").delete().eq("id", id);
  if (error) console.warn("Kunne ikke slette resultatet:", error.message);
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Writes the result of a game when it has a winner, once. A win that is taken back (Angre on the winner screen) takes the result back
 * too; a fresh game (`fresh`: nothing thrown yet, as after Spill igjen) keeps it and starts on a new id.
 */
export function useRecordResult(winner: string | null, fresh: boolean, build: (id: string, playedAt: string) => GameResult | null) {
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
      const r = latest.current(id.current, new Date().toISOString());
      if (r) {
        written.current = true;
        void saveGameResult(r);
      }
      return;
    }
    if (!written.current) return;
    written.current = false;
    if (fresh) id.current = null;
    else if (id.current) void deleteGameResult(id.current);
  }, [winner, fresh]);
}
