"use client";

import { useRef, useState } from "react";
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
import { parseSector, stepForSector } from "@/lib/scoliaMapping";
import { useScolia } from "@/lib/useScolia";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";
import { ScoliaStatusBadge } from "./ScoliaStatusBadge";

const SCOLIA_SERIAL_NUMBER = process.env.NEXT_PUBLIC_SCOLIA_SERIAL_NUMBER;
const SCOLIA_ACCESS_TOKEN = process.env.NEXT_PUBLIC_SCOLIA_ACCESS_TOKEN;

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

  // Counts physical darts Scolia has detected this turn (registrable or not) —
  // distinct from pendingHits, which only holds darts that actually scored a cross.
  const scoliaDartsRef = useRef(0);
  const scoliaEnabled = screen === "game" && Boolean(SCOLIA_SERIAL_NUMBER && SCOLIA_ACCESS_TOKEN);
  const scolia = useScolia(SCOLIA_SERIAL_NUMBER, SCOLIA_ACCESS_TOKEN, scoliaEnabled, {
    onThrow: (payload) => {
      if (!activePlayer) return;
      scoliaDartsRef.current += 1;
      const { step, crosses } = stepForSector(parseSector(payload.sector, payload.bounceout));
      if (step) registerHit(step, crosses);
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
    scoliaDartsRef.current = 0;
    setScreen("game");
    playPlayerSound(startPlayers[0] ?? null);
  }

  /**
   * Registers `crosses` marks on `step` (crosses > 1 for a Scolia-detected inner bull).
   * Chains the prevCount->newCount sequence up front so multiple crosses from a single
   * dart stack correctly — calling registerHit(step) twice in a row would instead apply
   * the same prevCount->newCount delta twice, since `progress` in this closure doesn't
   * reflect the first call's setProgress until the next render.
   */
  function registerHit(step: Step, crosses: number = 1) {
    if (!activePlayer) return;
    const playerProgress = progress[activePlayer];
    const activeStep = currentStepFor(playerProgress);
    if (!isRegistrable(step, activeStep, playerProgress)) return;

    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const newPendingHits: HitRecord[] = [];
    let count = playerProgress[step];
    for (let i = 0; i < crosses; i++) {
      const nextCount = applyHit(count);
      if (nextCount === count) break;
      newPendingHits.push({ player: activePlayer, step, prevCount: count, newCount: nextCount, turnIndex });
      count = nextCount;
    }
    if (newPendingHits.length === 0) return;

    haptics.hit();
    setProgress((prev) => ({
      ...prev,
      [activePlayer]: { ...prev[activePlayer], [step]: count },
    }));
    setPendingHits((prev) => [...prev, ...newPendingHits]);
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
    <>
      {scoliaEnabled && <ScoliaStatusBadge state={scolia.state} onReconnect={scolia.reconnectWithForce} />}
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
    </>
  );
}
