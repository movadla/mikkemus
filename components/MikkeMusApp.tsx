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
      const hit = step ? registerHit(step, crosses) : false;

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
  /** Returns whether the dart actually registered a cross (for the shot-indicator boxes). */
  function registerHit(step: Step, crosses: number = 1): boolean {
    if (!activePlayer) return false;
    const playerProgress = progress[activePlayer];
    const activeStep = currentStepFor(playerProgress);
    if (!isRegistrable(step, activeStep, playerProgress)) return false;

    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const newPendingHits: HitRecord[] = [];
    let count = playerProgress[step];
    for (let i = 0; i < crosses; i++) {
      const nextCount = applyHit(count);
      if (nextCount === count) break;
      newPendingHits.push({ player: activePlayer, step, prevCount: count, newCount: nextCount, turnIndex });
      count = nextCount;
    }
    if (newPendingHits.length === 0) return false;

    haptics.hit();
    setProgress((prev) => ({
      ...prev,
      [activePlayer]: { ...prev[activePlayer], [step]: count },
    }));
    setPendingHits((prev) => [...prev, ...newPendingHits]);
    return true;
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
    const activeStepNow = currentStepFor(progress[activePlayer]);
    const turn = summarizeTurn(pendingHits, activeStepNow);
    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const nextTurnLog = {
      ...turnLog,
      [activePlayer]: setTurnAt(turnLog[activePlayer] ?? [], turnIndex, turn),
    };
    setTurnLog(nextTurnLog);
    if (!rewound) {
      setTurnCounters((prev) => ({ ...prev, [activePlayer]: (prev[activePlayer] ?? 0) + 1 }));
    }

    if (pendingHits.length > 0) {
      setHistory((prev) => [...prev, ...pendingHits]);
      setPendingHits([]);
    }

    if (isFinished(progress[activePlayer])) {
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
        onRegisterHit={registerHit}
        onUndo={undo}
        onConfirm={confirm}
        onAbort={abortGame}
      />
    </>
  );
}
