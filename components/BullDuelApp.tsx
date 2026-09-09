"use client";

import { useEffect, useRef, useState } from "react";
import type { BotLevel, TeamMember } from "@/lib/botLevels";
import {
  activePlayerFor,
  advanceBullDuelTurn,
  botChooseBullThrow,
  isTurnComplete,
  registerBullDart,
  startBullDuel,
  type BullDuelState,
} from "@/lib/bullDuel";
import { sectorAt } from "@/lib/dartboard";
import { haptics } from "@/lib/haptics";
import { playFanfare } from "@/lib/fanfare";
import { recordBullDuelMatch } from "@/lib/storage";
import { useScolia } from "@/lib/useScolia";
import { BullDuelGameScreen } from "./BullDuelGameScreen";
import { BullDuelWinnerScreen } from "./BullDuelWinnerScreen";
import { BullDuelTargetScreen } from "./BullDuelTargetScreen";
import { ScoliaStatusBadge } from "./ScoliaStatusBadge";
import { SetupScreen } from "./SetupScreen";

type Screen = "setup" | "target" | "game" | "winner";

// Pause between a bot's simulated darts, same pacing as the main game's bots
// (see MikkeMusApp.tsx) — purely cosmetic, so the point total visibly ticks
// up one dart at a time instead of jumping straight to the result.
const BOT_THROW_DELAY_MS = 900;

/**
 * "Bull-duell": everyone throws only at bull, first to reach or pass a
 * chosen point target wins (2 for inner bull, 1 for outer). Deliberately
 * lighter-weight than MikkeMusApp — no numbers/T/D progression, no rewind,
 * no localStorage resume-on-refresh (an interrupted match is simply
 * abandoned, consistent with never persisting a match that didn't finish).
 */
export function BullDuelApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [screen, setScreen] = useState<Screen>("setup");
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const [guestPlayers, setGuestPlayers] = useState<Record<string, true>>({});
  const [teamRosters, setTeamRosters] = useState<Record<string, TeamMember[]>>({});
  const [pendingPlayers, setPendingPlayers] = useState<string[]>([]);
  const [duel, setDuel] = useState<BullDuelState | null>(null);

  // The single source of truth for the in-progress duel, updated synchronously
  // (not just via setState, which batches/re-renders asynchronously) so the
  // bot-throw loop below can always read the true latest state between darts —
  // same problem MikkeMusApp's ref-mirrored state solves, just with one ref
  // instead of several since this game's whole state is one small object.
  const duelRef = useRef<BullDuelState | null>(null);
  function setDuelState(next: BullDuelState | null) {
    duelRef.current = next;
    setDuel(next);
  }

  const activePlayer = duel ? activePlayerFor(duel) : null;
  const activeBotLevel = activePlayer ? botLevels[activePlayer] ?? null : null;

  function registerDart(sector: string, coords: [number, number] | null) {
    const current = duelRef.current;
    if (!current) return;
    setDuelState(registerBullDart(current, sector, coords));
  }

  function advanceTurn() {
    const current = duelRef.current;
    if (!current) return;
    setScoliaDartsThisTurn(0);
    setDuelState(advanceBullDuelTurn(current));
  }

  // Counts real Scolia throws (not manual taps) since the last advanceTurn, so a
  // takeout only auto-confirms a turn actually played on the board — manual entry
  // keeps its explicit Bekreft button. Plain state, not a ref: it's only ever read
  // from useScolia's own always-fresh callback (see useScolia.ts's callbacksRef),
  // never from a same-tick loop the way duelRef is, so there's no staleness risk
  // to guard against with a ref here.
  const [scoliaDartsThisTurn, setScoliaDartsThisTurn] = useState(0);

  // Real-throw detection, same pattern as MikkeMusApp — enabled on setup too
  // so the status badge is visible before starting, harmless there since
  // registerDart no-ops with no duel in progress.
  const scoliaEnabled = screen === "game" || screen === "setup";
  const scolia = useScolia(scoliaEnabled, {
    onThrow: (payload) => {
      if (screen !== "game" || activeBotLevel !== null) return;
      setScoliaDartsThisTurn((c) => c + 1);
      registerDart(payload.sector, payload.coordinates);
    },
    // Pulling the darts back out of the board means the player is done with
    // their turn — auto-advance instead of waiting for a manual Bekreft tap,
    // same real-world cue MikkeMusApp already relies on.
    onTakeoutStarted: () => {
      if (screen !== "game" || activeBotLevel !== null) return;
      if (scoliaDartsThisTurn > 0) advanceTurn();
    },
  });

  // Bot turn: throws its 3 darts (or fewer, if one of them wins the match)
  // with a short delay between each, then auto-advances the turn itself —
  // unlike a human's manual entry, a bot's throw is never a mis-tap that
  // needs reviewing before Confirm.
  useEffect(() => {
    if (screen !== "game") return;
    const start = duelRef.current;
    if (!start || start.winner) return;
    const player = activePlayerFor(start);
    const level = botLevels[player];
    if (!level) return;

    let cancelled = false;
    function throwNext() {
      if (cancelled) return;
      const state = duelRef.current;
      if (!state || state.winner || activePlayerFor(state) !== player) return;
      const coords = botChooseBullThrow(level);
      registerDart(sectorAt(coords), coords);

      const after = duelRef.current;
      if (cancelled || !after) return;
      if (!isTurnComplete(after)) {
        setTimeout(throwNext, BOT_THROW_DELAY_MS);
      } else if (!after.winner) {
        setTimeout(advanceTurn, BOT_THROW_DELAY_MS);
      }
    }
    const timer = setTimeout(throwNext, BOT_THROW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, duel?.activeIdx, duel?.winner, botLevels]);

  // The moment someone wins, persist career stats (never on abort — see
  // handleAbort) and haptically celebrate, once per match.
  const recordedWinnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!duel?.winner || recordedWinnerRef.current === duel.winner) return;
    recordedWinnerRef.current = duel.winner;
    haptics.win();
    playFanfare();
    duel.players.forEach((p) => {
      if (botLevels[p] || teamRosters[p] || guestPlayers[p]) return;
      const stats = duel.stats[p];
      if (stats.throws === 0) return;
      recordBullDuelMatch(p, {
        throws: stats.throws,
        points: stats.points,
        redHits: stats.redHits,
        greenHits: stats.greenHits,
        luckSum: stats.luckSum,
        luckCount: stats.luckCount,
      });
    });
    setScreen("winner");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.winner]);

  function handleStart(
    players: string[],
    startBotLevels: Record<string, BotLevel>,
    startTeamRosters: Record<string, TeamMember[]> = {},
    startGuestPlayers: Record<string, true> = {}
  ) {
    setPendingPlayers(players);
    setBotLevels(startBotLevels);
    setTeamRosters(startTeamRosters);
    setGuestPlayers(startGuestPlayers);
    setScreen("target");
  }

  function handleTargetChosen(target: number) {
    recordedWinnerRef.current = null;
    setScoliaDartsThisTurn(0);
    setDuelState(startBullDuel(pendingPlayers, target));
    setScreen("game");
  }

  function handleAbort() {
    // Deliberately does NOT call recordBullDuelMatch — an abandoned match
    // shouldn't count, unlike the main game's current (separately flagged)
    // behavior.
    setScoliaDartsThisTurn(0);
    setDuelState(null);
    setScreen("setup");
  }

  function handlePlayAgain() {
    recordedWinnerRef.current = null;
    setScoliaDartsThisTurn(0);
    if (duel) setDuelState(startBullDuel(duel.players, duel.target));
    setScreen("game");
  }

  return (
    <>
      {scoliaEnabled && <ScoliaStatusBadge state={scolia.state} />}
      {screen === "setup" && <SetupScreen onStart={handleStart} onHome={onExitToHome} title="Bull-duell" variantSelectable={false} />}
      {screen === "target" && <BullDuelTargetScreen onNext={handleTargetChosen} onBack={() => setScreen("setup")} />}
      {screen === "game" && duel && (
        <BullDuelGameScreen
          duel={duel}
          isActiveBot={activeBotLevel !== null}
          onManualHit={(sector) => registerDart(sector, null)}
          onConfirm={advanceTurn}
          onAbort={handleAbort}
        />
      )}
      {screen === "winner" && duel?.winner && <BullDuelWinnerScreen duel={duel} onHome={onExitToHome} onPlayAgain={handlePlayAgain} />}
    </>
  );
}
