"use client";

import { botDelayMs } from "@/lib/botSpeed";
import { useEffect, useRef, useState } from "react";
import type { BotLevel, TeamMember } from "@/lib/botLevels";
import {
  activePlayerFor,
  advanceBullDuelTurn,
  botChooseBullThrow,
  bustBullDuelTurn,
  finishStateFor,
  isTurnComplete,
  registerBullDart,
  soleLeader,
  startBullDuel,
  DEFAULT_BULL_DUEL_TARGET,
  type BullDuelMode,
  type BullDuelState,
} from "@/lib/bullDuel";
import { sectorAt } from "@/lib/dartboard";
import { announce } from "@/lib/announcer";
import { careerSound } from "@/lib/uiSound";
import { crowdForStreak, playCrowd, playFanfare, playHitStreakSound, playMatchDartSound, playStreakFanfare, playWalkOnTune, playWinBoom, primeAudio } from "@/lib/fanfare";
import { emitFx } from "@/lib/fxBus";
import { fxFlags, getFxLevel, useFxLevel } from "@/lib/fxLevel";
import { haptics } from "@/lib/haptics";
import { requestRecalibration } from "@/lib/scoliaCommands";
import { getPlayerRecord, playPlayerSound, recordBullDuelMatch } from "@/lib/storage";
import { useScolia } from "@/lib/useScolia";
import { BullDuelGameScreen } from "./BullDuelGameScreen";
import { BullDuelTargetScreen } from "./BullDuelTargetScreen";
import { BullDuelWinnerScreen } from "./BullDuelWinnerScreen";
import { FxStage } from "./FxStage";
import { LineupIntro, type LineupSide } from "./LineupIntro";
import { ScoliaStatusBadge, summarizeScolia } from "./ScoliaStatusBadge";
import { SetupScreen } from "./SetupScreen";
import { WinDive } from "./WinDive";

type Screen = "setup" | "target" | "game" | "winner";

// Pause between a bot's simulated darts, same pacing as the main game's bots
// (see MikkeMusApp.tsx) — purely cosmetic, so the point total visibly ticks
// up one dart at a time instead of jumping straight to the result.
/** How long a bot waits for a human's darts to come out of the board before it goes anyway (same as the main game). */
const TAKEOUT_WAIT_MAX_MS = 12_000;
/** The match in progress, kept so a reload does not lose it. */
const STORAGE_KEY = "mikke-mus-bullduel-active";
const UNDO_DEPTH_MAX = 60;

type Saved = {
  duel: BullDuelState;
  botLevels: Record<string, BotLevel>;
  guestPlayers: Record<string, true>;
  teamRosters: Record<string, TeamMember[]>;
  skipStats: boolean;
};

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s?.duel && Array.isArray(s.duel.players) && !s.duel.winner ? s : null;
  } catch {
    return null;
  }
}
function writeSaved(s: Saved | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode and the like: the match just is not resumable.
  }
}

/**
 * "Bull-duell": everyone throws only at bull, first to reach or pass a chosen point target wins (2 for inner bull,
 * 1 for outer). It has the main game's feel — sounds that build with a run, the shake and heat, the effects of the chosen
 * animation level, the line-up and the dives, Angre, matchdart, and a match that survives a reload — but not its
 * numbers/T/D progression.
 */
export function BullDuelApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [screen, setScreen] = useState<Screen>("setup");
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const [guestPlayers, setGuestPlayers] = useState<Record<string, true>>({});
  const [teamRosters, setTeamRosters] = useState<Record<string, TeamMember[]>>({});
  const [pendingPlayers, setPendingPlayers] = useState<string[]>([]);
  const [duel, setDuel] = useState<BullDuelState | null>(null);
  const fxLevel = useFxLevel();
  const fx = fxFlags(fxLevel);

  // The single source of truth for the in-progress duel, updated synchronously (not just via setState, which batches)
  // so the bot-throw loop below can always read the true latest state between darts.
  const duelRef = useRef<BullDuelState | null>(null);
  function setDuelState(next: BullDuelState | null) {
    duelRef.current = next;
    setDuel(next);
  }

  // Angre: every dart and every confirmed turn leaves the state before it here, newest last.
  const undoStackRef = useRef<BullDuelState[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  function pushUndo(state: BullDuelState) {
    const stack = undoStackRef.current;
    stack.push(state);
    if (stack.length > UNDO_DEPTH_MAX) stack.shift();
    setUndoDepth(stack.length);
  }
  function clearUndo() {
    undoStackRef.current = [];
    setUndoDepth(0);
  }

  const activePlayer = duel ? activePlayerFor(duel) : null;
  const activeBotLevel = activePlayer ? botLevels[activePlayer] ?? null : null;

  // A new turn is a new entrance for the thrower's bar, and a hit leaves a pulse the screen shakes and heats to.
  const [turnToken, setTurnToken] = useState(0);
  const [hitPulse, setHitPulse] = useState<{ token: number; streak: number } | null>(null);
  const pulseTokenRef = useRef(0);

  /** The sound and the picture of one dart, from the state before it to the state after. Bots' darts get them too. */
  function playDartEffects(before: BullDuelState, after: BullDuelState) {
    const player = activePlayerFor(before);
    const points = after.points[player] - before.points[player];
    const f = fxFlags(getFxLevel());
    if (points > 0) {
      haptics.hit();
      const run = after.stats[player].run;
      playHitStreakSound(Math.min(run, f.boomMaxStreak));
      // The crowd and the fanfare are built from hundreds of audio nodes: a moment after the boom, as in the main game.
      if (f.crowd && run >= 3) setTimeout(() => playCrowd(crowdForStreak(run)), 40);
      if (f.streakFanfare && run >= 3 && run % 3 === 0) setTimeout(() => playStreakFanfare(run), 20);
      if (points === 2) emitFx({ type: "bull" });
      // The heat belongs to the turn: how many darts have hit since the last miss in it.
      let trailing = 0;
      for (let i = after.turnShots.length - 1; i >= 0 && after.turnShots[i].points > 0; i--) trailing++;
      setHitPulse({ token: ++pulseTokenRef.current, streak: Math.min(3, trailing) });
    } else {
      setHitPulse(null);
      emitFx({ type: "miss" });
    }
    if (after.dartsThisTurn >= 3 && after.turnShots.every((s) => s.points > 0)) emitFx({ type: "perfect", run: after.stats[player].run });
  }

  function registerDart(sector: string, coords: [number, number] | null) {
    const current = duelRef.current;
    if (!current || current.winner) return;
    pushUndo(current);
    const next = registerBullDart(current, sector, coords);
    setDuelState(next);
    playDartEffects(current, next);
  }

  /** Bust: all the darts left in the turn missed, in one tap. The turn is then ready for Bekreft. */
  function bustTurn() {
    const current = duelRef.current;
    if (!current) return;
    pushUndo(current);
    const next = bustBullDuelTurn(current);
    setDuelState(next);
    setHitPulse(null);
    emitFx({ type: "miss" });
  }

  // Bots wait for a human's darts to come out of the board before they throw (Scolia only).
  const [awaitingTakeout, setAwaitingTakeout] = useState(false);
  const takeoutWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Counts real Scolia throws (not manual taps) since the last advanceTurn, so a takeout only auto-confirms a turn
  // actually played on the board — manual entry keeps its explicit Bekreft button.
  const [scoliaDartsThisTurn, setScoliaDartsThisTurn] = useState(0);

  const scoliaEnabled = screen === "game" || screen === "setup";

  function advanceTurn() {
    const current = duelRef.current;
    if (!current || current.winner) return;
    const wasBot = botLevels[activePlayerFor(current)] !== undefined;
    const next = advanceBullDuelTurn(current);
    // After a bot's turn there is nothing of the human's to take back.
    if (wasBot) clearUndo();
    else pushUndo(current);
    setDuelState(next);
    setScoliaDartsThisTurn(0);
    setHitPulse(null);
    setTurnToken((t) => t + 1);
    haptics.confirm();
    const nextPlayer = activePlayerFor(next);
    const f = fxFlags(getFxLevel());
    emitFx({ type: "walkOn", player: nextPlayer });
    if (botLevels[nextPlayer] === undefined) playPlayerSound(nextPlayer);
    // A team's or player's own walk-on tune, if one is chosen (Full party).
    if (f.walkOnTune) {
      const tune = getPlayerRecord(nextPlayer)?.walkOn;
      if (tune && tune !== "none") playWalkOnTune(tune);
    }
    // A human has just finished with darts still in the board, and a bot is up next: it waits for them to come out.
    if (!wasBot && scoliaDartsThisTurn > 0 && scolia.state.boardStatus === "Ready" && botLevels[nextPlayer] !== undefined) {
      setAwaitingTakeout(true);
      if (takeoutWaitTimerRef.current) clearTimeout(takeoutWaitTimerRef.current);
      takeoutWaitTimerRef.current = setTimeout(() => setAwaitingTakeout(false), TAKEOUT_WAIT_MAX_MS);
    }
  }

  function undo() {
    if (activeBotLevel !== null) return;
    const prev = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (!prev) return;
    haptics.undo();
    setDuelState(prev);
    setHitPulse(null);
    setScoliaDartsThisTurn((c) => Math.min(c, prev.dartsThisTurn));
  }

  // Real-throw detection, same pattern as MikkeMusApp — enabled on setup too so the status badge is visible before
  // starting, harmless there since registerDart no-ops with no duel in progress.
  const scolia = useScolia(scoliaEnabled, {
    onThrow: (payload) => {
      if (screen !== "game" || activeBotLevel !== null) return;
      setScoliaDartsThisTurn((c) => c + 1);
      registerDart(payload.sector, payload.coordinates);
    },
    // Pulling the darts back out of the board means the player is done with their turn — auto-advance instead of
    // waiting for a manual Bekreft tap, same real-world cue MikkeMusApp already relies on.
    onTakeoutStarted: () => {
      if (screen !== "game" || activeBotLevel !== null) return;
      if (scoliaDartsThisTurn > 0) advanceTurn();
    },
    onTakeoutFinished: (payload) => {
      if (payload.falseTakeout) return;
      if (screen === "game" && activeBotLevel === null && scoliaDartsThisTurn > 0) advanceTurn();
      setAwaitingTakeout(false);
    },
  });

  // Speaks the board dropping out and coming back — the one thing you need to hear when you are not looking at the phone.
  const prevRelayRef = useRef(scolia.state.relay);
  useEffect(() => {
    const prevRelay = prevRelayRef.current;
    prevRelayRef.current = scolia.state.relay;
    if (screen !== "game" || prevRelay === scolia.state.relay) return;
    if (scolia.state.relay === "stale") announce("Kontakten med brettet er brutt.");
    else if (prevRelay === "stale" && scolia.state.relay === "live") announce("Brettet er tilbake.");
  }, [scolia.state.relay, screen]);

  // Bot turn: throws its 3 darts (or fewer, if one of them wins the match) with a short delay between each, then
  // auto-advances the turn itself — unlike a human's manual entry, a bot's throw is never a mis-tap that needs reviewing.
  useEffect(() => {
    if (screen !== "game" || awaitingTakeout) return;
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
        setTimeout(throwNext, botDelayMs());
      } else if (!after.winner) {
        setTimeout(advanceTurn, botDelayMs());
      }
    }
    const timer = setTimeout(throwNext, botDelayMs());
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, duel?.activeIdx, duel?.winner, botLevels, awaitingTakeout]);

  // «Matchdart» / «out» for whoever is up, as in the main game, and the sound the moment anyone is one dart from winning.
  const finish = screen === "game" && duel && activePlayer ? finishStateFor(duel, activePlayer) : null;
  const matchDartOn = finish !== null;
  useEffect(() => {
    if (!finish) return;
    emitFx({ type: "matchdart", word: finish === "out" ? "OUT" : "MATCHDART" });
  }, [finish, turnToken, activePlayer]);
  const matchDartSeenRef = useRef<Record<string, boolean>>({});
  const matchDartBaselineRef = useRef(true);
  const leaderRef = useRef<string | null>(null);
  useEffect(() => {
    if (screen !== "game" || !duel) {
      matchDartSeenRef.current = {};
      matchDartBaselineRef.current = true;
      leaderRef.current = null;
      return;
    }
    const now: Record<string, boolean> = {};
    let fresh = false;
    for (const p of duel.players) {
      const one = finishStateFor(duel, p) === "matchdart";
      now[p] = one;
      if (one && !matchDartSeenRef.current[p]) fresh = true;
    }
    const baseline = matchDartBaselineRef.current;
    matchDartSeenRef.current = now;
    matchDartBaselineRef.current = false;
    if (fresh && !baseline && fxFlags(getFxLevel()).matchDart) playMatchDartSound();
    // The glint and the crown when someone takes the lead.
    const leader = soleLeader(duel);
    if (leader && leaderRef.current && leader !== leaderRef.current) emitFx({ type: "lead", name: leader });
    if (leader) leaderRef.current = leader;
  }, [duel, screen]);

  // The moment someone wins, persist career stats (never on abort — see handleAbort) and celebrate, once per match.
  const recordedWinnerRef = useRef<string | null>(null);
  // Set from the tick box under Start: a match played without a trace in the statistics.
  const skipStatsRef = useRef(false);
  const [diving, setDiving] = useState(false);
  useEffect(() => {
    if (!duel?.winner || recordedWinnerRef.current === duel.winner) return;
    recordedWinnerRef.current = duel.winner;
    haptics.win();
    writeSaved(null);
    clearUndo();
    duel.players.forEach((p) => {
      if (skipStatsRef.current) return;
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
    // As in the main game: the boom lands now, on the frame the board dives; the fanfare waits for the result to burst
    // out of the bull. Without the dive the win is announced on the spot.
    /* eslint-disable react-hooks/set-state-in-effect -- the result of the winning dart, once per match */
    if (fxFlags(getFxLevel()).dives) {
      playWinBoom();
      setDiving(true);
    } else {
      playFanfare();
      careerSound("cheer");
      setScreen("winner");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.winner]);

  // The match in progress survives a reload.
  useEffect(() => {
    if (screen !== "game" || !duel || duel.winner) return;
    writeSaved({ duel, botLevels, guestPlayers, teamRosters, skipStats: skipStatsRef.current });
  }, [screen, duel, botLevels, guestPlayers, teamRosters]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = readSaved();
    if (!saved) return;
    skipStatsRef.current = saved.skipStats;
    setBotLevels(saved.botLevels);
    setGuestPlayers(saved.guestPlayers);
    setTeamRosters(saved.teamRosters);
    setPendingPlayers(saved.duel.players);
    setDuelState(saved.duel);
    setScreen("game");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The board is told to recalibrate when a match starts, if it is up — and the request waits for the first status if it
  // has not reported in yet.
  const recalibrateWhenReadyRef = useRef(false);
  useEffect(() => {
    if (!recalibrateWhenReadyRef.current || scolia.state.boardStatus === null) return;
    recalibrateWhenReadyRef.current = false;
    if (scolia.state.boardStatus === "Ready") void requestRecalibration();
  }, [scolia.state.boardStatus]);

  // The line-up and the dive, Full party and Party as the chosen level allows (lib/fxLevel.ts).
  const [showLineup, setShowLineup] = useState(false);
  const [introDiving, setIntroDiving] = useState(false);

  function beginMatch(players: string[], target: number, mode: BullDuelMode = "first") {
    // Called synchronously from a real button tap — the narrow window where the browser allows unlocking audio.
    primeAudio();
    recordedWinnerRef.current = null;
    setScoliaDartsThisTurn(0);
    setAwaitingTakeout(false);
    clearUndo();
    setHitPulse(null);
    setTurnToken(0);
    setDiving(false);
    setDuelState(startBullDuel(players, target, mode));
    if (scolia.state.boardStatus === "Ready") void requestRecalibration();
    else if (scolia.state.boardStatus === null) recalibrateWhenReadyRef.current = true;
    const f = fxFlags(getFxLevel());
    if (f.dives) {
      playWinBoom();
      setIntroDiving(true);
    }
    setShowLineup(f.lineup && players.length >= 2);
    if (botLevels[players[0]] === undefined) playPlayerSound(players[0] ?? null);
    setScreen("game");
  }

  function handleStart(
    players: string[],
    startBotLevels: Record<string, BotLevel>,
    startTeamRosters: Record<string, TeamMember[]> = {},
    startGuestPlayers: Record<string, true> = {},
    _variant?: unknown,
    statsOff = false
  ) {
    skipStatsRef.current = statsOff;
    setPendingPlayers(players);
    setBotLevels(startBotLevels);
    setTeamRosters(startTeamRosters);
    setGuestPlayers(startGuestPlayers);
    setScreen("target");
  }

  function handleTargetChosen(target: number, mode: BullDuelMode) {
    beginMatch(pendingPlayers, target, mode);
  }

  function handleAbort() {
    // Deliberately does NOT call recordBullDuelMatch — an abandoned match shouldn't count.
    writeSaved(null);
    clearUndo();
    setScoliaDartsThisTurn(0);
    setDuelState(null);
    setScreen("setup");
  }

  function handlePlayAgain() {
    if (duel) beginMatch(duel.players, duel.mode === "best3" ? DEFAULT_BULL_DUEL_TARGET : duel.target, duel.mode ?? "first");
  }

  function exitHome() {
    writeSaved(null);
    onExitToHome();
  }

  const lineupSides: LineupSide[] = (duel?.players ?? []).map((p) => {
    const rec = getPlayerRecord(p);
    const bd = rec?.bullDuel;
    return {
      name: p,
      photo: rec?.photo ?? null,
      isBot: botLevels[p] !== undefined,
      hitPct: bd && bd.throws > 0 ? ((bd.redHits + bd.greenHits) / bd.throws) * 100 : null,
    };
  });

  if (introDiving) return <WinDive onDone={() => setIntroDiving(false)} />;
  if (diving)
    return (
      <WinDive
        onDone={() => {
          setDiving(false);
          playFanfare();
          careerSound("cheer");
          setScreen("winner");
        }}
      />
    );

  const expectsTakeout = scoliaEnabled && scolia.state.boardStatus === "Ready" && activeBotLevel === null && scoliaDartsThisTurn > 0;

  return (
    <>
      <FxStage matchDart={matchDartOn} />
      {showLineup && screen === "game" && <LineupIntro sides={lineupSides} onDone={() => setShowLineup(false)} />}
      {screen === "setup" && (
        <SetupScreen onStart={handleStart} onHome={exitHome} title="Bull-duell" variantSelectable={false} scolia={scoliaEnabled ? summarizeScolia(scolia.state) : null} />
      )}
      {screen === "target" && <BullDuelTargetScreen onNext={handleTargetChosen} onBack={() => setScreen("setup")} />}
      {screen === "game" && duel && activePlayer && (
        <>
          <BullDuelGameScreen
            duel={duel}
            isActiveBot={activeBotLevel !== null}
            thrower={{ name: activePlayer, photo: getPlayerRecord(activePlayer)?.photo ?? null, isBot: activeBotLevel !== null }}
            run={duel.stats[activePlayer].run}
            turnToken={turnToken}
            hitPulse={hitPulse}
            canUndo={undoDepth > 0}
            awaitingTakeout={expectsTakeout}
            animate={fxLevel !== "normal"}
            fxHeat={fx.heat}
            fxShake={fx.shake}
            fxFire={fx.fire}
            onManualHit={(sector) => registerDart(sector, null)}
            onBust={bustTurn}
            onConfirm={advanceTurn}
            onUndo={undo}
            onAbort={handleAbort}
          />
          {scoliaEnabled && <ScoliaStatusBadge state={scolia.state} />}
        </>
      )}
      {screen === "winner" && duel?.winner && <BullDuelWinnerScreen duel={duel} onHome={exitHome} onPlayAgain={handlePlayAgain} />}
    </>
  );
}
