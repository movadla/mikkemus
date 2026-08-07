"use client";

import { useState } from "react";
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
} from "@/lib/game";
import { playPlayerSound, recordMatchResult } from "@/lib/storage";
import { haptics } from "@/lib/haptics";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";

type Screen = "setup" | "game" | "winner";

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

  const activePlayer = rewound ?? players[currentIdx] ?? null;

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
    setScreen("game");
    playPlayerSound(startPlayers[0] ?? null);
  }

  function registerHit(step: Step) {
    if (!activePlayer) return;
    const playerProgress = progress[activePlayer];
    const activeStep = currentStepFor(playerProgress);
    if (!isRegistrable(step, activeStep, playerProgress)) return;

    const prevCount = playerProgress[step];
    const newCount = applyHit(prevCount);
    if (newCount === prevCount) return;

    haptics.hit();
    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;

    setProgress((prev) => ({
      ...prev,
      [activePlayer]: { ...prev[activePlayer], [step]: newCount },
    }));
    setPendingHits((prev) => [...prev, { player: activePlayer, step, prevCount, newCount, turnIndex }]);
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
    });
    return stats;
  }

  function confirm() {
    if (!activePlayer) return;
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
    return <WinnerScreen winner={winner} players={players} stats={winnerStats} onHome={playAgain} />;
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
    <GameScreen
      players={players}
      progress={progress}
      activePlayer={activePlayer}
      turnToken={turnToken}
      dartsThrown={dartsThrown}
      pendingByStep={pendingByStep}
      rewound={rewound !== null}
      pendingCount={pendingHits.length}
      canUndo={pendingHits.length > 0 || history.length > 0}
      onRegisterHit={registerHit}
      onUndo={undo}
      onConfirm={confirm}
      onAbort={abortGame}
    />
  );
}
