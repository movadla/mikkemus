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
import { playPlayerSound, recordAccuracyTotals, recordMatchResult } from "@/lib/storage";
import { clearActiveMatch, loadActiveMatch, saveActiveMatch } from "@/lib/activeMatch";
import { throwAccuracy } from "@/lib/dartboard";
import { haptics } from "@/lib/haptics";
import { formatSectorLabel, parseSector, stepForSector } from "@/lib/scoliaMapping";
import { useScolia } from "@/lib/useScolia";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";
import { ScoliaStatusBadge } from "./ScoliaStatusBadge";

type Screen = "setup" | "game" | "winner";

const EMPTY_TURN_SHOTS: (TurnShot | null)[] = [null, null, null];

/** How long a turn's 3 shots stay on screen after the round switches, before clearing for the next player. */
const SHOT_DISPLAY_HOLD_MS = 900;

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
  // reset (after a short hold, see the turnToken effect below) whenever the turn advances.
  const [turnShots, setTurnShots] = useState<(TurnShot | null)[]>(EMPTY_TURN_SHOTS);
  // Every physical dart's landing coordinate this match, per player — shown as a
  // heatmap on the winner screen and discarded after (not persisted; see
  // lib/dartboard.ts for the coordinate system these are in).
  const [matchThrows, setMatchThrows] = useState<Record<string, [number, number][]>>({});
  // Running MED/MHD/MVD sums this match, per player — a ref (not state) since it's
  // only ever read once, at match end, and shouldn't trigger a re-render per dart.
  const accuracyTotalsRef = useRef<Record<string, { distance: number; horizontal: number; vertical: number; throws: number }>>({});
  // Flips true after the one-time localStorage restore below has had its chance to
  // run — the save effect must not fire before that, or it would see the plain
  // "setup" initial state and wipe a saved match before it's even restored.
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);
  // Triple/double-on-active-number hits still undecided between staying on T/D or
  // redirecting to complete the number (see PendingAmbiguous). Resolved in LIFO
  // order — only the most recent one is ever live/shown.
  const [pendingAmbiguous, setPendingAmbiguous] = useState<PendingAmbiguous[]>([]);
  const pendingAmbiguousKeyRef = useRef(0);
  // True once Confirm has been requested but is blocked on resolving pendingAmbiguous.
  const [awaitingConfirmResolution, setAwaitingConfirmResolution] = useState(false);

  const activePlayer = rewound ?? players[currentIdx] ?? null;

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
  ]);

  // Counts physical darts Scolia has detected this turn (registrable or not) —
  // distinct from pendingHits, which only holds darts that actually scored a cross.
  const scoliaDartsRef = useRef(0);
  const scoliaEnabled = screen === "game";
  const scolia = useScolia(scoliaEnabled, {
    onThrow: (payload) => {
      if (!activePlayer) return;
      const dartIndex = scoliaDartsRef.current;
      scoliaDartsRef.current += 1;

      // What the player was working on right before this dart lands — used both to
      // resolve the throw itself and, below, as the MED/MHD/MVD target (see
      // lib/dartboard.ts: for a miss, this is still the meaningful "how far off
      // from what you were aiming at" reference, not just a no-op).
      const activeStepAtThrow = currentStepFor(progress[activePlayer]);

      const parsed = parseSector(payload.sector, payload.bounceout);
      const { step, crosses } = stepForSector(parsed);

      /**
       * A triple/double landing on the number the player is actively working
       * banks normally to T/D (unchanged) — but if that ring still has room, the
       * dart could just as easily have been meant to finish the number itself
       * (a triple/double is worth 3x/2x there), so it's flagged as undecided
       * rather than silently locked to T/D. If the ring is already full, there's
       * no ambiguity — it can only go to the number, at its multiplier value.
       */
      let hitResult: HitRecord[] | null;
      if (
        parsed.kind === "number" &&
        (parsed.ring === "D" || parsed.ring === "T") &&
        activeStepAtThrow !== null &&
        !Number.isNaN(Number(activeStepAtThrow)) &&
        parsed.number === Number(activeStepAtThrow)
      ) {
        const ringStep = parsed.ring;
        const numberStep = activeStepAtThrow;
        const ringFull = (progress[activePlayer][ringStep] ?? 0) >= 3;
        const multiplier: 2 | 3 = ringStep === "T" ? 3 : 2;
        if (ringFull) {
          hitResult = registerHit(numberStep, multiplier);
        } else {
          hitResult = registerHit(ringStep, crosses);
          if (hitResult) {
            const created = hitResult[0];
            setPendingAmbiguous((prev) => [
              ...prev,
              { key: ++pendingAmbiguousKeyRef.current, hitRecord: created, ringStep, number: numberStep, multiplier },
            ]);
          }
        }
      } else {
        hitResult = step ? registerHit(step, crosses) : null;
        // A plain hit landing on a number with an undecided redirect signals "still
        // working this number" — resolve that ambiguity toward "keep on T/D" now,
        // instead of waiting for Confirm to ask.
        if (step !== null && !Number.isNaN(Number(step))) {
          setPendingAmbiguous((prev) => prev.filter((p) => p.number !== step));
        }
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
    },
    onTakeoutStarted: () => {
      // Player started collecting darts before the 3rd was thrown (e.g. they checked out early).
      if (scoliaDartsRef.current > 0) {
        scoliaDartsRef.current = 0;
        confirm();
      }
    },
  });

  function startGame(startPlayers: string[]) {
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
    setMatchThrows({});
    accuracyTotalsRef.current = {};
    setPendingAmbiguous([]);
    setAwaitingConfirmResolution(false);
    scoliaDartsRef.current = 0;
    setScreen("game");
    playPlayerSound(startPlayers[0] ?? null);
  }

  // Keeps a finished turn's 3 shots on screen for a moment after the round switches —
  // long enough to see the final dart's box, short enough that they're cleared well
  // before the next player's first throw — so a miss-everything round still reads
  // clearly as "new round, nothing thrown yet" instead of looking frozen/unclear.
  useEffect(() => {
    const timer = setTimeout(() => setTurnShots(EMPTY_TURN_SHOTS), SHOT_DISPLAY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [turnToken]);

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
    const item = pendingAmbiguous[pendingAmbiguous.length - 1];
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

    const remaining = pendingAmbiguous.filter((p) => p.key !== item.key);
    setPendingAmbiguous(remaining);

    if (remaining.length === 0 && awaitingConfirmResolution) {
      setAwaitingConfirmResolution(false);
      advanceTurn(finalProgress, finalPendingHits);
    }
  }

  function undo() {
    haptics.undo();
    if (pendingHits.length > 0) {
      const last = pendingHits[pendingHits.length - 1];
      setProgress((prev) => ({
        ...prev,
        [last.player]: { ...prev[last.player], [last.step]: last.prevCount },
      }));
      setPendingHits((prev) => prev.slice(0, -1));
      // If the undone dart was still awaiting a T/D-or-number choice, that choice is moot now.
      setPendingAmbiguous((prev) => prev.filter((p) => p.hitRecord !== last));
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
      recordMatchResult(p, aggregate, p === winnerName);
      const accuracy = accuracyTotalsRef.current[p];
      if (accuracy) recordAccuracyTotals(p, accuracy);
    });
    return stats;
  }

  function confirm() {
    if (!activePlayer) return;
    scoliaDartsRef.current = 0;
    if (pendingAmbiguous.length > 0) {
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
    }

    if (isFinished(effectiveProgress[activePlayer])) {
      haptics.win();
      setWinnerStats(finalizeMatch(nextTurnLog, activePlayer));
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
    finalizeMatch(turnLog);
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
      <GameScreen
        players={players}
        progress={progress}
        activePlayer={activePlayer}
        turnToken={turnToken}
        dartsThrown={dartsThrown}
        pendingByStep={pendingByStep}
        turnShots={rewound === null ? turnShots : EMPTY_TURN_SHOTS}
        rewound={rewound !== null}
        pendingCount={pendingHits.length}
        canUndo={pendingHits.length > 0 || history.length > 0}
        pendingChoice={rewound === null ? pendingAmbiguous[pendingAmbiguous.length - 1] ?? null : null}
        awaitingConfirmResolution={awaitingConfirmResolution}
        onResolvePendingChoice={resolvePendingChoice}
        onRegisterHit={registerHit}
        onUndo={undo}
        onConfirm={confirm}
        onAbort={abortGame}
      />
    </>
  );
}
