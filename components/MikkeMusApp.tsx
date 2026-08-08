"use client";

import { useEffect, useRef, useState } from "react";
import {
  aggregateTurns,
  applyHit,
  currentStepFor,
  DARTS_PER_TURN,
  emptyProgress,
  isRegistrable,
  isFinished,
  summarizeTurn,
  type HitRecord,
  type PlayerProgress,
  type Step,
  type TurnAggregate,
  type TurnResult,
  type TurnShot,
  type PendingAmbiguous,
} from "@/lib/game";
import { playPlayerSound, recordAccuracyTotals, recordMatchHistory, recordMatchResult, recordRingHits, type RingHits } from "@/lib/storage";
import { clearActiveMatch, loadActiveMatch, saveActiveMatch } from "@/lib/activeMatch";
import { sectorAt, throwAccuracy } from "@/lib/dartboard";
import { haptics } from "@/lib/haptics";
import { classifyThrow, formatSectorLabel, parseSector } from "@/lib/scoliaMapping";
import { botChooseThrow, botDecideRedirect } from "@/lib/botStrategy";
import { type BotLevel } from "@/lib/botLevels";
import { useScolia } from "@/lib/useScolia";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";
import { ScoliaStatusBadge } from "./ScoliaStatusBadge";

type Screen = "setup" | "game" | "winner";

const EMPTY_TURN_SHOTS: (TurnShot | null)[] = [null, null, null];

/**
 * Ultimate fallback for clearing the shot boxes/highlight if neither a real
 * takeout-finished event nor the next turn's first dart ever arrives (fully
 * manual play with no Scolia board, or a relay that never reports takeouts).
 */
const TURN_DISPLAY_FALLBACK_MS = 20_000;

/** Pause between a bot's simulated darts — purely cosmetic pacing, so the shot
 *  boxes/marks visibly animate in one at a time instead of all landing at once. */
const BOT_THROW_DELAY_MS = 900;

function setTurnAt(turns: TurnResult[], index: number, turn: TurnResult): TurnResult[] {
  const next = turns.slice();
  next[index] = turn;
  return next;
}

export function MikkeMusApp() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [players, setPlayers] = useState<string[]>([]);
  const [progress, setProgress] = useState<PlayerProgress>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pendingHits, setPendingHits] = useState<HitRecord[]>([]);
  const [history, setHistory] = useState<HitRecord[]>([]);
  const [rewound, setRewound] = useState<string | null>(null);
  const [rewoundTurnIndex, setRewoundTurnIndex] = useState<number | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerStats, setWinnerStats] = useState<Record<string, TurnAggregate>>({});
  // Bumped on every confirm that starts a new turn — lets the turn-start
  // animations replay even when the same player goes again (solo play, or
  // any time the active player doesn't literally change).
  const [turnToken, setTurnToken] = useState(0);

  // Per player: every confirmed turn, indexed by turn number. A rewound
  // correction overwrites its slot instead of appending, so re-confirming an
  // edited turn never double-counts it in the persisted stats.
  const [turnLog, setTurnLog] = useState<Record<string, TurnResult[]>>({});
  const [turnCounters, setTurnCounters] = useState<Record<string, number>>({});
  // The current turn's darts as Scolia detects them, for the shot-indicator boxes —
  // held on screen until the darts are physically taken out (see clearTurnDisplay).
  const [turnShots, setTurnShots] = useState<(TurnShot | null)[]>(EMPTY_TURN_SHOTS);
  // Which player's marks from their just-finished turn should still render in the
  // "just placed" accent tint rather than settled gold/cream, and which steps —
  // same held-until-takeout lifetime as turnShots. Cleared in undo() too, since an
  // undo can make it inconsistent with progress (see clearTurnDisplay call sites).
  const [recentlyConfirmed, setRecentlyConfirmed] = useState<{ player: string; byStep: Partial<Record<Step, number>> } | null>(null);
  // Every physical dart's landing coordinate this match, per player — shown as a
  // heatmap on the winner screen and discarded after (not persisted; see
  // lib/dartboard.ts for the coordinate system these are in).
  const [matchThrows, setMatchThrows] = useState<Record<string, [number, number][]>>({});
  // Running MED/MHD/MVD sums this match, per player — a ref (not state) since it's
  // only ever read once, at match end, and shouldn't trigger a re-render per dart.
  const accuracyTotalsRef = useRef<Record<string, { distance: number; horizontal: number; vertical: number; throws: number }>>({});
  // Which specific number's Triple/Double physically landed this match, per player —
  // for the career "favorite triple/double" stat. Counts every ring hit as thrown,
  // regardless of how the triple/double-redirect ambiguity later got resolved.
  const ringHitsRef = useRef<Record<string, { triple: RingHits; double: RingHits }>>({});
  // Flips true after the one-time localStorage restore below has had its chance to
  // run — the save effect must not fire before that, or it would see the plain
  // "setup" initial state and wipe a saved match before it's even restored.
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);
  // Triple/double-on-active-number hits still undecided between staying on T/D or
  // redirecting to complete the number (see PendingAmbiguous). Resolved in LIFO
  // order — only the most recent one is ever live/shown.
  const [pendingAmbiguous, setPendingAmbiguous] = useState<PendingAmbiguous[]>([]);
  const pendingAmbiguousKeyRef = useRef(0);
  // Mirrors pendingAmbiguous synchronously — confirm() must check this, not the
  // state variable, because onThrow can call setPendingAmbiguous(...) and then
  // confirm() in the very same synchronous tick (a dart that's both ambiguous and
  // the turn's 3rd dart), and React wouldn't have applied that state update yet by
  // the time confirm() reads it. Every setPendingAmbiguous call goes through
  // updatePendingAmbiguous below, which keeps this ref and the state in lockstep.
  const pendingAmbiguousRef = useRef<PendingAmbiguous[]>([]);
  function updatePendingAmbiguous(updater: PendingAmbiguous[] | ((prev: PendingAmbiguous[]) => PendingAmbiguous[])) {
    const next = typeof updater === "function" ? updater(pendingAmbiguousRef.current) : updater;
    pendingAmbiguousRef.current = next;
    setPendingAmbiguous(next);
  }
  // True once Confirm has been requested but is blocked on resolving pendingAmbiguous.
  const [awaitingConfirmResolution, setAwaitingConfirmResolution] = useState(false);
  // Which players in this match are bots, and at what difficulty — set once at
  // startGame from SetupScreen's picks. Bots are never written via ensurePlayer and
  // are excluded from finalizeMatch's persistence calls (see there).
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});

  const activePlayer = rewound ?? players[currentIdx] ?? null;
  const activeBotLevel = activePlayer ? botLevels[activePlayer] ?? null : null;

  // Always-current mirrors of state the bot-turn effect below reads from inside
  // setTimeout callbacks, where a closure over the render-time `progress`/
  // `activePlayer` would otherwise go stale between one simulated dart and the next.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const activePlayerRef = useRef(activePlayer);
  activePlayerRef.current = activePlayer;
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // Resume an in-progress match after a reload instead of dropping back to setup.
  // Deliberately not read during useState's initializer (which would run during
  // SSR/hydration too and mismatch the statically-prerendered "setup" markup) —
  // this runs client-only, once, after the first paint, hydrating this component's
  // state from an external source (localStorage) exactly like the docs' own
  // exception to "you might not need an effect" for synchronizing external systems.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time restore-from-localStorage on mount, not a render-loop */
  useEffect(() => {
    const restored = loadActiveMatch();
    if (restored) {
      setScreen(restored.screen);
      setPlayers(restored.players);
      setProgress(restored.progress);
      setCurrentIdx(restored.currentIdx);
      setPendingHits(restored.pendingHits);
      setHistory(restored.history);
      setRewound(restored.rewound);
      setRewoundTurnIndex(restored.rewoundTurnIndex);
      setWinner(restored.winner);
      setWinnerStats(restored.winnerStats);
      setTurnToken(restored.turnToken);
      setTurnLog(restored.turnLog);
      setTurnCounters(restored.turnCounters);
      setBotLevels(restored.botLevels ?? {});
    }
    setHydratedFromStorage(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persists the in-progress match on every change, and clears it once the match
  // ends or is aborted (both routes back to screen "setup" — see abortGame/playAgain).
  useEffect(() => {
    if (!hydratedFromStorage) return;
    if (screen === "setup") {
      clearActiveMatch();
      return;
    }
    saveActiveMatch({
      screen,
      players,
      progress,
      currentIdx,
      pendingHits,
      history,
      rewound,
      rewoundTurnIndex,
      winner,
      winnerStats,
      turnToken,
      turnLog,
      turnCounters,
      botLevels,
    });
  }, [
    hydratedFromStorage,
    screen,
    players,
    progress,
    currentIdx,
    pendingHits,
    history,
    rewound,
    rewoundTurnIndex,
    winner,
    winnerStats,
    turnToken,
    turnLog,
    turnCounters,
    botLevels,
  ]);

  /** Clears the shot boxes and the "just placed" mark highlight — see the call sites below for when. */
  function clearTurnDisplay() {
    setTurnShots(EMPTY_TURN_SHOTS);
    setRecentlyConfirmed(null);
  }

  // Counts physical darts Scolia has detected this turn (registrable or not) —
  // distinct from pendingHits, which only holds darts that actually scored a cross.
  const scoliaDartsRef = useRef(0);

  /**
   * Applies one dart's outcome to the game — the single processing path shared by
   * real Scolia throws and the bot's simulated ones, so a bot dart is scored
   * through exactly the same rules a physical throw would be. Bots reach this via
   * a synthetic payload built from botStrategy's simulated coordinates + sectorAt.
   */
  function processDart(payload: { sector: string; bounceout: boolean; coordinates: [number, number] }) {
    if (!activePlayer) return;
    const dartIndex = scoliaDartsRef.current;
    scoliaDartsRef.current += 1;

    if (dartIndex === 0) {
      // Fallback for a missed/late takeout-finished event: a genuinely new turn's
      // first physical dart has landed, so whatever was held from the previous
      // turn is moot now regardless. Safe to batch with this dart's own turnShots
      // write below — React applies same-state updates in order within one tick.
      clearTurnDisplay();
    }

    // What the player was working on right before this dart lands — used both to
    // resolve the throw itself and, below, as the MED/MHD/MVD target (see
    // lib/dartboard.ts: for a miss, this is still the meaningful "how far off
    // from what you were aiming at" reference, not just a no-op).
    const activeStepAtThrow = currentStepFor(progress[activePlayer]);

    const parsed = parseSector(payload.sector, payload.bounceout);

    // Physical placement, tracked independent of how the ambiguity below (if any)
    // ends up scoring it — "favorite triple/double" is about where darts land.
    if (parsed.kind === "number" && (parsed.ring === "D" || parsed.ring === "T")) {
      const bucket = parsed.ring === "T" ? "triple" : "double";
      const playerRingHits = ringHitsRef.current[activePlayer] ?? { triple: {}, double: {} };
      const numKey = String(parsed.number);
      ringHitsRef.current = {
        ...ringHitsRef.current,
        [activePlayer]: {
          ...playerRingHits,
          [bucket]: { ...playerRingHits[bucket], [numKey]: (playerRingHits[bucket][numKey] ?? 0) + 1 },
        },
      };
    }

    const classified = classifyThrow(parsed, activeStepAtThrow, progress[activePlayer]);
    const hitResult: HitRecord[] | null = classified.step ? registerHit(classified.step, classified.crosses) : null;
    if (classified.ambiguous && hitResult) {
      const created = hitResult[0];
      updatePendingAmbiguous((prev) => [
        ...prev,
        { key: ++pendingAmbiguousKeyRef.current, hitRecord: created, ...classified.ambiguous! },
      ]);
    } else if (classified.step !== null && !Number.isNaN(Number(classified.step))) {
      // A plain hit landing on a number with an undecided redirect signals "still
      // working this number" — resolve that ambiguity toward "keep on T/D" now,
      // instead of waiting for Confirm to ask.
      updatePendingAmbiguous((prev) => prev.filter((p) => p.number !== classified.step));
    }
    const hit = hitResult !== null;

    setMatchThrows((prev) => ({
      ...prev,
      [activePlayer]: [...(prev[activePlayer] ?? []), payload.coordinates],
    }));
    const accuracy = activeStepAtThrow ? throwAccuracy(activeStepAtThrow, payload.coordinates) : null;
    if (accuracy) {
      const totals = accuracyTotalsRef.current[activePlayer] ?? { distance: 0, horizontal: 0, vertical: 0, throws: 0 };
      accuracyTotalsRef.current = {
        ...accuracyTotalsRef.current,
        [activePlayer]: {
          distance: totals.distance + accuracy.distance,
          horizontal: totals.horizontal + accuracy.horizontal,
          vertical: totals.vertical + accuracy.vertical,
          throws: totals.throws + 1,
        },
      };
    }

    if (dartIndex < DARTS_PER_TURN) {
      const shot: TurnShot = { label: formatSectorLabel(parsed), hit };
      setTurnShots((prev) => {
        const next = prev.slice();
        next[dartIndex] = shot;
        return next;
      });
    }
    if (scoliaDartsRef.current >= DARTS_PER_TURN) {
      scoliaDartsRef.current = 0;
      confirm();
    }
  }

  const scoliaEnabled = screen === "game";
  const scolia = useScolia(scoliaEnabled, {
    // Ignored while a bot is active — a bot's turn has no physical darts to detect,
    // and gating this here (rather than toggling `enabled`) avoids tearing down and
    // re-establishing the realtime/polling connection on every turn switch.
    onThrow: (payload) => {
      if (activeBotLevel !== null) return;
      processDart(payload);
    },
    onTakeoutStarted: () => {
      if (activeBotLevel !== null) return;
      // Player started collecting darts before the 3rd was thrown (e.g. they checked out early).
      if (scoliaDartsRef.current > 0) {
        scoliaDartsRef.current = 0;
        confirm();
      }
    },
    onTakeoutFinished: (payload) => {
      if (activeBotLevel !== null) return;
      // The real signal the shot boxes/highlight are held for: darts are physically
      // out of the board now. A "false" takeout means nothing was actually pulled.
      if (!payload.falseTakeout) clearTurnDisplay();
    },
  });

  function startGame(startPlayers: string[], startBotLevels: Record<string, BotLevel> = {}) {
    const prog: PlayerProgress = {};
    startPlayers.forEach((p) => (prog[p] = emptyProgress()));
    setPlayers(startPlayers);
    setProgress(prog);
    setCurrentIdx(0);
    setPendingHits([]);
    setHistory([]);
    setRewound(null);
    setRewoundTurnIndex(null);
    setWinner(null);
    setTurnLog({});
    setTurnCounters({});
    setTurnToken(0);
    setTurnShots(EMPTY_TURN_SHOTS);
    setRecentlyConfirmed(null);
    setMatchThrows({});
    accuracyTotalsRef.current = {};
    ringHitsRef.current = {};
    updatePendingAmbiguous([]);
    setAwaitingConfirmResolution(false);
    setBotLevels(startBotLevels);
    scoliaDartsRef.current = 0;
    setScreen("game");
    if (!startBotLevels[startPlayers[0]]) playPlayerSound(startPlayers[0] ?? null);
  }

  // Ultimate safety net for clearTurnDisplay — normally it fires on the real
  // takeout-finished signal (or, failing that, the next turn's first dart); this
  // only matters for fully-manual play with no Scolia board, or a relay that never
  // reports takeouts, so the display doesn't linger forever in those cases.
  useEffect(() => {
    const timer = setTimeout(clearTurnDisplay, TURN_DISPLAY_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [turnToken]);

  // Auto-plays a bot's whole turn — three paced, simulated darts, each scored
  // through the exact same processDart path a real Scolia throw would use.
  // Re-runs whenever the active player or turn changes; the `cancelled` flag plus
  // the activePlayerRef/screenRef guards inside throwNext stop a stale chain the
  // instant the real turn moves on (see their own comments for why refs are
  // needed here rather than the closed-over `player`/`screen` values going stale).
  useEffect(() => {
    if (screen !== "game" || rewound || !activePlayer) return;
    const level = botLevels[activePlayer];
    if (!level) return;

    const player = activePlayer;
    let cancelled = false;

    function throwNext() {
      if (cancelled || screenRef.current !== "game" || activePlayerRef.current !== player) return;
      const currentProgress = progressRef.current[player];
      if (isFinished(currentProgress)) {
        // Won mid-turn on an earlier simulated dart — stop and let confirm() close it out.
        scoliaDartsRef.current = 0;
        confirm();
        return;
      }

      const coordinates = botChooseThrow(level, progressRef.current, player, botLevels);
      processDart({ sector: sectorAt(coordinates), bounceout: false, coordinates });

      const pending = pendingAmbiguousRef.current;
      if (pending.length > 0) {
        const item = pending[pending.length - 1];
        const progressBeforeThrow = { ...progressRef.current[player], [item.ringStep]: item.hitRecord.prevCount };
        const redirect = botDecideRedirect(
          level,
          progressRef.current,
          progressBeforeThrow,
          player,
          botLevels,
          item.ringStep,
          item.multiplier
        );
        resolvePendingChoice(redirect ? "redirect" : "keep");
      }

      if (!cancelled && scoliaDartsRef.current < DARTS_PER_TURN) {
        setTimeout(throwNext, BOT_THROW_DELAY_MS);
      }
    }

    const timer = setTimeout(throwNext, BOT_THROW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processDart/confirm/resolvePendingChoice close over per-render state on purpose, like the rest of this file's handlers; re-running this effect on their identity would defeat the ref-guarded single-chain-per-turn design above.
  }, [screen, activePlayer, turnToken, botLevels, rewound]);

  /**
   * Registers `crosses` marks on `step` (crosses > 1 for a Scolia-detected inner bull).
   * Chains the prevCount->newCount sequence up front so multiple crosses from a single
   * dart stack correctly — calling registerHit(step) twice in a row would instead apply
   * the same prevCount->newCount delta twice, since `progress` in this closure doesn't
   * reflect the first call's setProgress until the next render.
   */
  /** Returns the HitRecord(s) this dart created, or null if nothing registered (also used by GameScreen's manual taps, which ignore the return value). */
  function registerHit(step: Step, crosses: number = 1): HitRecord[] | null {
    if (!activePlayer) return null;
    const playerProgress = progress[activePlayer];
    const activeStep = currentStepFor(playerProgress);
    if (!isRegistrable(step, activeStep, playerProgress)) return null;

    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const newPendingHits: HitRecord[] = [];
    let count = playerProgress[step];
    for (let i = 0; i < crosses; i++) {
      const nextCount = applyHit(count);
      if (nextCount === count) break;
      newPendingHits.push({ player: activePlayer, step, prevCount: count, newCount: nextCount, turnIndex });
      count = nextCount;
    }
    if (newPendingHits.length === 0) return null;

    haptics.hit();
    setProgress((prev) => ({
      ...prev,
      [activePlayer]: { ...prev[activePlayer], [step]: count },
    }));
    setPendingHits((prev) => [...prev, ...newPendingHits]);
    return newPendingHits;
  }

  /**
   * Applies the player's choice for the most recent undecided triple/double-on-
   * active-number hit. When this was the last one Confirm was waiting on, it
   * must advance the turn itself — not via an effect watching pendingAmbiguous —
   * because a "redirect" choice's progress/pendingHits changes are computed
   * right here as plain local values (not read back from state, which
   * wouldn't reflect this same call's setProgress/setPendingHits until the
   * next render) and handed straight to advanceTurn.
   */
  function resolvePendingChoice(choice: "keep" | "redirect") {
    const item = pendingAmbiguousRef.current[pendingAmbiguousRef.current.length - 1];
    if (!item || !activePlayer) return;

    let finalProgress = progress;
    let finalPendingHits = pendingHits;

    if (choice === "redirect") {
      const rolledBack = { ...progress[item.hitRecord.player], [item.ringStep]: item.hitRecord.prevCount };
      finalPendingHits = pendingHits.filter((h) => h !== item.hitRecord);

      // Mirrors registerHit's own prevCount->newCount chaining loop — duplicated
      // rather than called, since registerHit reads `progress` from this
      // component's state and would miss the rollback above until re-render.
      const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
      const newHits: HitRecord[] = [];
      let count = rolledBack[item.number];
      for (let i = 0; i < item.multiplier; i++) {
        const nextCount = applyHit(count);
        if (nextCount === count) break;
        newHits.push({ player: activePlayer, step: item.number, prevCount: count, newCount: nextCount, turnIndex });
        count = nextCount;
      }
      finalProgress = { ...progress, [activePlayer]: { ...rolledBack, [item.number]: count } };
      finalPendingHits = [...finalPendingHits, ...newHits];

      haptics.hit();
      setProgress(finalProgress);
      setPendingHits(finalPendingHits);
    }

    const remaining = pendingAmbiguousRef.current.filter((p) => p.key !== item.key);
    updatePendingAmbiguous(remaining);

    if (remaining.length === 0 && awaitingConfirmResolution) {
      setAwaitingConfirmResolution(false);
      advanceTurn(finalProgress, finalPendingHits);
    }
  }

  function undo() {
    haptics.undo();
    // Any held "just placed" highlight can go stale the instant progress is rewound
    // (most obviously on a second, cascading undo) — simplest correct move is to
    // always drop it here rather than try to reconcile it with the rollback below.
    setRecentlyConfirmed(null);
    if (pendingHits.length > 0) {
      const last = pendingHits[pendingHits.length - 1];
      setProgress((prev) => ({
        ...prev,
        [last.player]: { ...prev[last.player], [last.step]: last.prevCount },
      }));
      setPendingHits((prev) => prev.slice(0, -1));
      // If the undone dart was still awaiting a T/D-or-number choice, that choice is moot now.
      updatePendingAmbiguous((prev) => prev.filter((p) => p.hitRecord !== last));
      return;
    }
    if (history.length > 0) {
      const last = history[history.length - 1];
      setProgress((prev) => ({
        ...prev,
        [last.player]: { ...prev[last.player], [last.step]: last.prevCount },
      }));
      setHistory((prev) => prev.slice(0, -1));
      setRewound(last.player);
      setRewoundTurnIndex(last.turnIndex);
    }
  }

  function finalizeMatch(finalTurnLog: Record<string, TurnResult[]>, winnerName: string | null = null) {
    const stats: Record<string, TurnAggregate> = {};
    players.forEach((p) => {
      const aggregate = aggregateTurns(finalTurnLog[p] ?? []);
      stats[p] = aggregate;
      // A bot's darts aren't real play — never let them land in a human player's
      // career stats, and bots are never ensurePlayer'd into the roster to begin with.
      if (botLevels[p]) return;
      recordMatchResult(p, aggregate, p === winnerName);
      const accuracy = accuracyTotalsRef.current[p];
      if (accuracy) recordAccuracyTotals(p, accuracy);
      const ringHits = ringHitsRef.current[p];
      if (ringHits) recordRingHits(p, ringHits.triple, ringHits.double);

      const dartsUsed = aggregate.hits + aggregate.misses;
      if (dartsUsed > 0) {
        recordMatchHistory(p, {
          date: new Date().toISOString(),
          won: p === winnerName,
          dartsUsed,
          hitPct: Math.round((aggregate.hits / dartsUsed) * 100),
          med: accuracy && accuracy.throws > 0 ? accuracy.distance / accuracy.throws : null,
          mhd: accuracy && accuracy.throws > 0 ? accuracy.horizontal / accuracy.throws : null,
          mvd: accuracy && accuracy.throws > 0 ? accuracy.vertical / accuracy.throws : null,
        });
      }
    });
    return stats;
  }

  function confirm() {
    if (!activePlayer) return;
    scoliaDartsRef.current = 0;
    // Reads the ref, not the pendingAmbiguous state — see pendingAmbiguousRef's
    // comment above for why the state can be stale right here.
    if (pendingAmbiguousRef.current.length > 0) {
      setAwaitingConfirmResolution(true);
      return;
    }
    advanceTurn();
  }

  /**
   * `progressOverride`/`pendingHitsOverride` let resolvePendingChoice hand in
   * values it just computed locally, for the one case (a redirect that was the
   * last undecided choice) where this needs to see a change from the very same
   * event that's calling it, before that change has made it back through a
   * render — reading `progress`/`pendingHits` here directly would still be the
   * pre-redirect snapshot at that point.
   */
  function advanceTurn(progressOverride?: PlayerProgress, pendingHitsOverride?: HitRecord[]) {
    if (!activePlayer) return;
    const effectiveProgress = progressOverride ?? progress;
    const effectivePendingHits = pendingHitsOverride ?? pendingHits;
    const activeStepNow = currentStepFor(effectiveProgress[activePlayer]);
    const turn = summarizeTurn(effectivePendingHits, activeStepNow);
    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const nextTurnLog = {
      ...turnLog,
      [activePlayer]: setTurnAt(turnLog[activePlayer] ?? [], turnIndex, turn),
    };
    setTurnLog(nextTurnLog);
    if (!rewound) {
      setTurnCounters((prev) => ({ ...prev, [activePlayer]: (prev[activePlayer] ?? 0) + 1 }));
    }

    if (effectivePendingHits.length > 0) {
      setHistory((prev) => [...prev, ...effectivePendingHits]);
      setPendingHits([]);
      // Tallied from effectivePendingHits, not the (possibly stale) pendingHits
      // state, so this is automatically correct whichever way a redirect choice
      // went: lands on the number after "redirect", stays on the ring after "keep".
      const byStep: Partial<Record<Step, number>> = {};
      effectivePendingHits.forEach((h) => {
        byStep[h.step] = (byStep[h.step] ?? 0) + 1;
      });
      setRecentlyConfirmed({ player: activePlayer, byStep });
    }

    if (isFinished(effectiveProgress[activePlayer])) {
      haptics.win();
      // Reaching the winner screen must never depend on stats persistence succeeding —
      // see abortGame's identical guard for why.
      let stats: Record<string, TurnAggregate> = {};
      try {
        stats = finalizeMatch(nextTurnLog, activePlayer);
      } catch (err) {
        console.error("Klarte ikke å lagre statistikk ved kampslutt:", err);
      }
      setWinnerStats(stats);
      setWinner(activePlayer);
      setScreen("winner");
      return;
    }

    haptics.confirm();
    setTurnToken((t) => t + 1);

    const nextPlayer = rewound ? players[currentIdx] ?? null : players[(currentIdx + 1) % players.length] ?? null;
    playPlayerSound(nextPlayer);

    if (rewound) {
      setRewound(null);
      setRewoundTurnIndex(null);
      return;
    }
    setCurrentIdx((idx) => (idx + 1) % players.length);
  }

  function abortGame() {
    // Leaving the game screen must never depend on stats persistence succeeding —
    // a bad turnLog entry or a Supabase hiccup inside finalizeMatch must not leave
    // the player stuck looking at a "Pause spillet?" dialog that does nothing.
    try {
      finalizeMatch(turnLog);
    } catch (err) {
      console.error("Klarte ikke å lagre statistikk ved avbrytelse:", err);
    }
    setScreen("setup");
    setPlayers([]);
  }

  function playAgain() {
    setScreen("setup");
    setPlayers([]);
  }

  if (screen === "setup") {
    return <SetupScreen onStart={startGame} />;
  }

  if (screen === "winner" && winner) {
    return <WinnerScreen winner={winner} players={players} stats={winnerStats} throwsByPlayer={matchThrows} onHome={playAgain} />;
  }

  const dartsThrown: Record<string, number> = {};
  players.forEach((p) => {
    dartsThrown[p] = (turnCounters[p] ?? 0) * DARTS_PER_TURN;
  });

  const pendingByStep: Partial<Record<Step, number>> = {};
  pendingHits.forEach((h) => {
    pendingByStep[h.step] = (pendingByStep[h.step] ?? 0) + 1;
  });

  return (
    <>
      {scoliaEnabled && <ScoliaStatusBadge state={scolia.state} />}
      {activeBotLevel && rewound === null && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full text-sm shadow-panel"
          style={{ background: "var(--color-surface)", color: "var(--color-teal)", border: "1px solid var(--color-border)" }}
        >
          🤖 {activePlayer} kaster …
        </div>
      )}
      <GameScreen
        players={players}
        progress={progress}
        activePlayer={activePlayer}
        turnToken={turnToken}
        dartsThrown={dartsThrown}
        pendingByStep={pendingByStep}
        turnShots={rewound === null ? turnShots : EMPTY_TURN_SHOTS}
        recentlyConfirmed={rewound === null ? recentlyConfirmed : null}
        rewound={rewound !== null}
        pendingCount={pendingHits.length}
        canUndo={pendingHits.length > 0 || history.length > 0}
        pendingChoice={rewound === null ? pendingAmbiguous[pendingAmbiguous.length - 1] ?? null : null}
        awaitingConfirmResolution={awaitingConfirmResolution}
        onResolvePendingChoice={resolvePendingChoice}
        onRegisterHit={activeBotLevel ? () => {} : registerHit}
        onUndo={undo}
        onConfirm={activeBotLevel ? () => {} : confirm}
        onAbort={abortGame}
      />
    </>
  );
}
