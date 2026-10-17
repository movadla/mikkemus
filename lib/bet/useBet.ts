"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveMatchState } from "../liveMatch";
import { ensureMatch, expireOffers, loadBooks, settleMatch, type Books } from "./api";
import { currentNight } from "./ledger";

const POLL_MS = 2500;
/** The win screen has an Angre for a misread last dart; a result is only paid out once it has stood this long. */
export const WINNER_SETTLE_MS = 8000;

export type BetState = {
  books: Books | null;
  /** The tables are missing — show the setup instructions. */
  setupNeeded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  night: number;
  /** Seconds until the result of a finished match is paid out, or null. */
  settlingIn: number | null;
};

/**
 * The books, kept fresh, plus the two things /bet does on its own while it is open: it records each
 * match it sees (so a bet can always be decided later, even by hand), and it pays out a finished
 * match once the winner has stood for a few seconds.
 */
export function useBet(live: LiveMatchState | null): BetState {
  const [books, setBooks] = useState<Books | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settlingIn, setSettlingIn] = useState<number | null>(null);
  const seenMatch = useRef(new Set<string>());
  const settled = useRef(new Set<string>());
  const winnerSince = useRef<{ id: string; winner: string; at: number } | null>(null);

  const refresh = useCallback(async () => {
    const r = await loadBooks();
    if (r.ok) {
      setBooks(r.books);
      setSetupNeeded(false);
      setError(null);
    } else {
      setSetupNeeded(r.setupNeeded);
      setError(r.message);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const night = books ? currentNight(books.ledger) : 1;

  useEffect(() => {
    if (!live?.matchId || live.screen === "setup" || setupNeeded) return;
    if (!seenMatch.current.has(live.matchId)) {
      seenMatch.current.add(live.matchId);
      void ensureMatch(live.matchId, live.players).then(() => refresh());
    }
  }, [live?.matchId, live?.screen, live?.players, setupNeeded, refresh]);

  // An open bet is only good for the turn it was made in. When the odds move on, nobody can take it
  // any more, so the stake goes back to whoever put it out.
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  });
  const lm = live?.matchId ?? "";
  const lg = live?.screen === "game";
  const lt = live?.turnToken ?? -1;
  const staleKey = (books?.bets ?? [])
    .filter((b) => b.status === "open" && (!lg || lm !== b.match_id || lt !== b.turn))
    .map((b) => b.id)
    .join(",");
  useEffect(() => {
    if (!books || setupNeeded || !staleKey) return;
    const ids = new Set(staleKey.split(","));
    const stale = books.bets.filter((b) => ids.has(b.id));
    // A match not yet seen live may just be loading: give it a moment before handing anything back.
    const t = setTimeout(() => void expireOffers(stale, liveRef.current, night).then(() => refresh()), 1500);
    return () => clearTimeout(t);
  }, [staleKey, books, setupNeeded, night, refresh]);

  // Pay out a finished match once its winner has stood for WINNER_SETTLE_MS.
  useEffect(() => {
    const id = live?.matchId;
    if (!id || live.screen !== "winner" || !live.winner || setupNeeded || settled.current.has(id)) {
      winnerSince.current = null;
      setSettlingIn(null);
      return;
    }
    if (winnerSince.current?.id !== id || winnerSince.current.winner !== live.winner) winnerSince.current = { id, winner: live.winner, at: Date.now() };
    const winner = live.winner;
    const tick = setInterval(() => {
      const waited = Date.now() - (winnerSince.current?.at ?? Date.now());
      if (waited >= WINNER_SETTLE_MS) {
        clearInterval(tick);
        settled.current.add(id);
        setSettlingIn(null);
        void settleMatch(id, winner, night).then(() => refresh());
      } else setSettlingIn(Math.ceil((WINNER_SETTLE_MS - waited) / 1000));
    }, 500);
    return () => clearInterval(tick);
  }, [live?.matchId, live?.screen, live?.winner, setupNeeded, night, refresh]);

  return { books, setupNeeded, error, refresh, night, settlingIn };
}
