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
  meaningfulPending,
  remainingMarks,
  STEPS,
  summarizeTurn,
  type HitRecord,
  type PlayerProgress,
  type Step,
  type TurnAggregate,
  type TurnResult,
  type TurnShot,
  type PendingAmbiguous,
} from "@/lib/game";
import { playPlayerSound, recordAccuracyTotals, recordLuckTotals, recordMatchHistory, recordMatchResult, recordRingHits, type RingHits } from "@/lib/storage";
import { announce } from "@/lib/announcer";
import { reportError } from "@/lib/errorReporting";
import { clearActiveMatch, loadActiveMatch, saveActiveMatch } from "@/lib/activeMatch";
import { publishLiveMatch } from "@/lib/liveMatch";
import { luckForThrow, sectorAt, throwAccuracy } from "@/lib/dartboard";
import { haptics } from "@/lib/haptics";
import { playFanfare, playHitStreakSound, primeAudio } from "@/lib/fanfare";
import { classifyThrow, formatSectorLabel, parseSector } from "@/lib/scoliaMapping";
import { botChooseThrow, botDecideRedirect, solverFor } from "@/lib/botStrategy";
import { type BotLevel, type TeamMember } from "@/lib/botLevels";
import { useScolia } from "@/lib/useScolia";
import { extractImageUrls } from "@/lib/extractImageUrls";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";
import { ScoliaStatusBadge } from "./ScoliaStatusBadge";
import { TripleCelebration } from "./TripleCelebration";
import { CameraImages } from "./CameraImages";

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

/** Same per-section breakdown as lib/storage.ts's career luck record — one running xG total per step, not just one overall mean. */
function emptyLuckByStep(): Record<Step, { sum: number; count: number }> {
  const s = {} as Record<Step, { sum: number; count: number }>;
  STEPS.forEach((step) => (s[step] = { sum: 0, count: 0 }));
  return s;
}

/**
 * Normalizes a restored localStorage snapshot's winnerLuck into today's {sum, count}
 * shape. A snapshot saved before Expected Hits switched from a per-dart mean to a running
 * sum (see lib/storage.ts) stored {mean, count} instead — reading `.sum` on one of those
 * as `undefined` and calling .toFixed() on it in WinnerScreen crashes the whole screen on
 * restore. Reconstructs sum = mean * count for an old-shaped entry, and defaults anything
 * else missing/malformed to 0 rather than trusting untyped JSON from localStorage.
 */
function sanitizeWinnerLuck(raw: unknown): Record<string, Record<Step, { sum: number; count: number }>> {
  const out: Record<string, Record<Step, { sum: number; count: number }>> = {};
  const byPlayer = (raw ?? {}) as Record<string, Partial<Record<Step, { sum?: number; mean?: number; count?: number }>>>;
  Object.entries(byPlayer).forEach(([player, byStep]) => {
    const perStep = emptyLuckByStep();
    STEPS.forEach((step) => {
      const entry = byStep?.[step];
      const count = typeof entry?.count === "number" ? entry.count : 0;
      const sum = typeof entry?.sum === "number" ? entry.sum : typeof entry?.mean === "number" ? entry.mean * count : 0;
      perStep[step] = { sum, count };
    });
    out[player] = perStep;
  });
  return out;
}

type MikkeMusAppProps = {
  /** When set (and there's no in-progress match to resume), skips SetupScreen and starts a match
   *  with these players directly — used by tournament mode to play one scheduled match through
   *  this exact same engine, unchanged. */
  initialPlayers?: string[];
  initialBotLevels?: Record<string, BotLevel>;
  /** Per-team roster (name + bot status per member) for any of `initialPlayers` that's a team —
   *  lets the engine know who's physically up next within that team's turn (see teamMemberIdx). */
  initialTeamRosters?: Record<string, TeamMember[]>;
  /** When set, the winner screen's home button reports the result here instead of resetting to
   *  SetupScreen — the caller (tournament mode) decides what happens next. */
  onMatchComplete?: (result: { winner: string; placements: string[]; stats: Record<string, TurnAggregate> }) => void;
  /** Bails all the way back to the true home screen (AppRoot) — wired into SetupScreen's "← Hjem"
   *  and into aborting a tournament match (which would otherwise strand the player on the generic,
   *  disconnected SetupScreen instead of back where they actually came from). */
  onExitToHome?: () => void;
};

export function MikkeMusApp({ initialPlayers, initialBotLevels, initialTeamRosters, onMatchComplete, onExitToHome }: MikkeMusAppProps = {}) {
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
  // "Expected Hits" sum per player THIS MATCH, broken down per section (20-14, D, T,
  // BULL) rather than one overall number — set once, at finalizeMatch, same lifetime as
  // winnerStats. {sum: 0, count: 0} for a section with no real Scolia darts to judge.
  const [winnerLuck, setWinnerLuck] = useState<Record<string, Record<Step, { sum: number; count: number }>>>({});
  // Full finishing order (winner first), computed once at match end — for a 2-player match this
  // is just [winner, loser]; for a tournament group pod with 3+ players it ranks everyone else by
  // how close they were to finishing at that moment (see remainingMarks), not by playing it out.
  const [placements, setPlacements] = useState<string[]>([]);
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
  // Every physical dart's landing coordinate this match, per player — shown as a
  // heatmap on the winner screen and discarded after (not persisted; see
  // lib/dartboard.ts for the coordinate system these are in).
  const [matchThrows, setMatchThrows] = useState<Record<string, [number, number][]>>({});
  // Running MED/MHD/MVD sums this match, per player — a ref (not state) since it's
  // only ever read once, at match end, and shouldn't trigger a re-render per dart.
  const accuracyTotalsRef = useRef<Record<string, { distance: number; horizontal: number; vertical: number; throws: number }>>({});
  // Running "Expected Goals" sums this match, per player AND per section —
  // same ref-not-state reasoning as accuracyTotalsRef above. Only real
  // Scolia darts with an inferrable target contribute (see lib/dartboard.ts:
  // luckForThrow).
  const luckTotalsRef = useRef<Record<string, Record<Step, { sum: number; count: number }>>>({});
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
  // Mirrored into a ref for the same reason pendingAmbiguousRef exists: confirm()'s
  // setAwaitingConfirmResolution(true) and the immediately-following
  // resolvePendingChoice() call (when a bot's ambiguous hit is also the turn's 3rd
  // dart) happen in the same synchronous tick, so resolvePendingChoice reading the
  // state variable would see the pre-update value and never advance the turn.
  const [awaitingConfirmResolution, setAwaitingConfirmResolution] = useState(false);
  const awaitingConfirmResolutionRef = useRef(false);
  function updateAwaitingConfirmResolution(value: boolean) {
    awaitingConfirmResolutionRef.current = value;
    setAwaitingConfirmResolution(value);
  }
  // Which players in this match are bots, and at what difficulty — set once at
  // startGame from SetupScreen's picks. Bots are never written via ensurePlayer and
  // are excluded from finalizeMatch's persistence calls (see there).
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  // Per-team roster, set once at startGame — absent entirely for individual (non-team) matches.
  const [teamRosters, setTeamRosters] = useState<Record<string, TeamMember[]>>({});
  // One-off guests, set once at startGame from SetupScreen's picks — never ensurePlayer'd and,
  // like bots, excluded from finalizeMatch's persistence calls (see there).
  const [guestPlayers, setGuestPlayers] = useState<Record<string, true>>({});
  // Which member of a team's own roster throws NEXT time that team is up — advanced in
  // advanceTurn, independent of the overall players[]/currentIdx rotation.
  const [teamMemberIdx, setTeamMemberIdx] = useState<Record<string, number>>({});

  const activePlayer = rewound ?? players[currentIdx] ?? null;
  // For a team with a roster, the CURRENT thrower is a specific member (who may or may not be a
  // bot); for a plain individual participant there's no roster, so it falls through to the flat
  // botLevels lookup exactly as before.
  const activeRoster = activePlayer ? teamRosters[activePlayer] : undefined;
  const currentMember: TeamMember | null =
    activeRoster && activeRoster.length > 0 ? activeRoster[(teamMemberIdx[activePlayer as string] ?? 0) % activeRoster.length] : null;
  const activeBotLevel = currentMember
    ? currentMember.isBot
      ? currentMember.botLevel ?? null
      : null
    : activePlayer
      ? botLevels[activePlayer] ?? null
      : null;

  // Always-current mirrors of state/handlers the bot-turn effect below reads from
  // inside setTimeout callbacks, where a closure over this render's `progress`/
  // `activePlayer`/handlers would otherwise go stale between one simulated dart
  // and the next. The bot-turn effect (throwNext) is itself only re-created once
  // per turn (its useEffect dependencies don't change dart-to-dart), but
  // processDart/resolvePendingChoice/confirm are plain closures over this render's
  // `progress` — calling the SAME closure for all 3 darts of a turn would have
  // dart 2 and 3 read dart 1's pre-throw progress, silently overwriting a real
  // cross with a stale recomputation of the same number. Real Scolia throws never
  // hit this (each event always invokes useScolia's latest callback). Synced in an
  // effect (not assigned directly in the render body) since mutating a ref during
  // render is itself unsafe — hoisting makes referencing these functions here
  // valid even though they're declared further down in this component.
  const progressRef = useRef(progress);
  const activePlayerRef = useRef(activePlayer);
  const screenRef = useRef(screen);
  const processDartRef = useRef(processDart);
  const resolvePendingChoiceRef = useRef(resolvePendingChoice);
  const confirmRef = useRef(confirm);
  useEffect(() => {
    progressRef.current = progress;
    activePlayerRef.current = activePlayer;
    screenRef.current = screen;
    processDartRef.current = processDart;
    resolvePendingChoiceRef.current = resolvePendingChoice;
    confirmRef.current = confirm;
  });

  // Resume an in-progress match after a reload instead of dropping back to setup.
  // Deliberately not read during useState's initializer (which would run during
  // SSR/hydration too and mismatch the statically-prerendered "setup" markup) —
  // this runs client-only, once, after the first paint, hydrating this component's
  // state from an external source (localStorage) exactly like the docs' own
  // exception to "you might not need an effect" for synchronizing external systems.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time restore-from-localStorage on mount, not a render-loop */
  useEffect(() => {
    const restored = loadActiveMatch();
    // In tournament mode, only resume a saved match if it's actually THIS match (same two
    // players) — otherwise a stale leftover from an unrelated earlier match (e.g. a past
    // "Singel game") would hijack the tournament match the caller explicitly asked to start.
    const restoredMatchesRequested =
      !initialPlayers || (restored && restored.players.length === initialPlayers.length && initialPlayers.every((p) => restored.players.includes(p)));
    if (restored && restoredMatchesRequested) {
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
      setWinnerLuck(sanitizeWinnerLuck(restored.winnerLuck));
      setPlacements(restored.placements ?? []);
      setTurnToken(restored.turnToken);
      setTurnLog(restored.turnLog);
      setTurnCounters(restored.turnCounters);
      setBotLevels(restored.botLevels ?? {});
      setTeamRosters(restored.teamRosters ?? {});
      setTeamMemberIdx(restored.teamMemberIdx ?? {});
      setGuestPlayers(restored.guestPlayers ?? {});
    } else if (initialPlayers) {
      // Tournament mode: nothing to resume, so jump straight into the given match instead of
      // showing SetupScreen.
      startGame(initialPlayers, initialBotLevels ?? {}, initialTeamRosters ?? {});
    }
    setHydratedFromStorage(true);
    // initialPlayers/initialBotLevels are only meant to apply once, on the very first mount of a
    // fresh match (like the restored-match branch above) — re-running this on their identity
    // would restart a match that's already in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persists the in-progress match on every change, and clears it once the match
  // ends or is aborted (both routes back to screen "setup" — see abortGame/playAgain).
  // Also publishes a small live_match snapshot for a second "storskjerm" device to render
  // (see lib/liveMatch.ts) — same trigger, since both are "the match state just changed".
  useEffect(() => {
    if (!hydratedFromStorage) return;
    if (screen === "setup") {
      clearActiveMatch();
      publishLiveMatch(null);
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
      winnerLuck,
      placements,
      turnToken,
      turnLog,
      turnCounters,
      botLevels,
      teamRosters,
      teamMemberIdx,
      guestPlayers,
    });
    publishLiveMatch({
      screen,
      players,
      progress,
      activePlayer,
      turnToken,
      winner,
      botLevels,
      guestPlayers,
    });
  }, [
    hydratedFromStorage,
    screen,
    players,
    progress,
    currentIdx,
    activePlayer,
    pendingHits,
    history,
    rewound,
    rewoundTurnIndex,
    winner,
    winnerStats,
    winnerLuck,
    placements,
    turnToken,
    turnLog,
    turnCounters,
    botLevels,
    teamRosters,
    teamMemberIdx,
    guestPlayers,
  ]);

  /** Clears the shot boxes and the "just placed" mark highlight — see the call sites below for when. */
  function clearTurnDisplay() {
    setTurnShots(EMPTY_TURN_SHOTS);
    // Clears the heat GameScreen derives from this — the build belongs to one turn, and
    // clearing it here (rather than in an effect over there) keeps that view a pure
    // function of props with no state or timers of its own.
    setHitPulse(null);
  }

  // Counts physical darts Scolia has detected this turn (registrable or not) —
  // distinct from pendingHits, which only holds darts that actually scored a cross.
  const scoliaDartsRef = useRef(0);

  // How many darts in a row, counting from the FIRST dart of this turn, have all hit —
  // drives the escalating boom (see lib/fanfare.ts) and the matching screen shake/heat.
  // Reset to 0 at the start of each turn; the first miss freezes it below the current dart
  // index, which is what silences the sound for the rest of the turn (see processDart).
  const hitStreakRef = useRef(0);

  // Physical triples landing on whatever number was active at the time, this turn. Three of
  // them is the rarest turn there is and triggers TripleCelebration. Counted from where the
  // dart actually landed rather than from how the T/D-or-number choice is later resolved —
  // the achievement is hitting the triple you were aiming at, whatever it ends up scoring as.
  const activeTriplesRef = useRef(0);

  // Darts (not crosses) that have landed on each step during the current turn — see
  // registerHit for why the distinction matters. Reset when the turn ends.
  const dartsOnStepRef = useRef<Partial<Record<Step, number>>>({});

  // Steps closed by three separate darts inside one turn, per player. Rendered as a ring
  // with a dot instead of the ordinary crosses-and-circle (see Mark.tsx). Kept in state
  // rather than derived from `history`, because a redirected triple writes the same three
  // HitRecords a three-dart close does and the two would be indistinguishable afterwards.
  const [perfectCloses, setPerfectCloses] = useState<Record<string, Partial<Record<Step, true>>>>({});

  /** Drops the three-dart marker for a step an undo has just pulled back below 3/3. */
  function clearPerfectClose(player: string, step: Step) {
    setPerfectCloses((prev) => {
      if (!prev[player]?.[step]) return prev;
      const forPlayer = { ...prev[player] };
      delete forPlayer[step];
      return { ...prev, [player]: forPlayer };
    });
  }

  // Retriggerable signals for GameScreen's shake/heat and the closing-row slam. Tokens
  // rather than booleans so the same value twice in a row still reads as a new event.
  const [hitPulse, setHitPulse] = useState<{ token: number; streak: number } | null>(null);
  const [closedStep, setClosedStep] = useState<{ token: number; step: Step } | null>(null);
  const pulseTokenRef = useRef(0);

  // Set when a three-triple turn lands; the board photo it wants arrives a beat later (see
  // TripleCelebration), so the overlay opens first and picks the image up when it comes.
  const [tripleCelebration, setTripleCelebration] = useState(false);

  // Best-effort camera-image display (see lib/extractImageUrls.ts) — cleared wherever the
  // turn advances (below) so a stale image doesn't linger over the next player's throw.
  const [cameraImages, setCameraImages] = useState<string[]>([]);

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
      hitStreakRef.current = 0;
      activeTriplesRef.current = 0;
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

    // A physical triple or bullseye is dramatic regardless of whether the game currently
    // needed it — announce it the moment it lands, independent of how classifyThrow below
    // ends up scoring it.
    if (parsed.kind === "number" && parsed.ring === "T") {
      announce(`Trippel ${parsed.number}!`);
    } else if (parsed.kind === "bull" && parsed.ring === "inner") {
      announce("Bullseye!");
    }

    const classified = classifyThrow(parsed, activeStepAtThrow, progress[activePlayer]);
    const hitResult: HitRecord[] | null = classified.step ? registerHit(classified.step, classified.crosses) : null;
    if (classified.ambiguous && hitResult) {
      const created = hitResult[0];
      updatePendingAmbiguous((prev) => [
        ...prev,
        { key: ++pendingAmbiguousKeyRef.current, hitRecord: created, ...classified.ambiguous! },
      ]);
    }
    // A later plain hit on the same number used to silently discard the pending choice,
    // reading it as "still working this number, so the triple must have stayed on T". The
    // inference runs backwards: still working the number is exactly why you'd want the
    // triple to COMPLETE it. With 17 on 1/3 and T on 2/3, a T17 followed by a plain 17 then
    // filled T and left 17 on 2 — the opposite of what the throw was worth, decided without
    // asking. The choice now survives to Confirm, where it's presented with the numbers.
    const hit = hitResult !== null;
    // Escalating boom + screen shake + heat — only while every dart so far THIS turn (from
    // dart 1) has hit. hitStreakRef.current === dartIndex means the streak is still
    // unbroken going into this dart; any miss (here or earlier) permanently desyncs the
    // two for the rest of the turn, which is exactly what silences dart 2/3 after a miss.
    if (hit && hitStreakRef.current === dartIndex) {
      hitStreakRef.current += 1;
      if (hitStreakRef.current <= 3) {
        const streak = hitStreakRef.current as 1 | 2 | 3;
        playHitStreakSound(streak);
        setHitPulse({ token: ++pulseTokenRef.current, streak });
      }
    }

    // A row reaching 3/3 gets its own slam — see the step-slam animation in globals.css.
    const closed = hitResult?.find((h) => h.newCount >= 3 && h.prevCount < 3);
    if (closed) setClosedStep({ token: ++pulseTokenRef.current, step: closed.step });

    // Three triples on the active number, in one turn.
    if (
      parsed.kind === "number" &&
      parsed.ring === "T" &&
      activeStepAtThrow !== null &&
      !Number.isNaN(Number(activeStepAtThrow)) &&
      parsed.number === Number(activeStepAtThrow)
    ) {
      activeTriplesRef.current += 1;
      if (activeTriplesRef.current === 3) setTripleCelebration(true);
    }

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
    const luck = luckForThrow(payload.coordinates, activeStepAtThrow, progress[activePlayer]);
    if (luck !== null) {
      const luckByStep = luckTotalsRef.current[activePlayer] ?? emptyLuckByStep();
      const stepTotals = luckByStep[luck.step];
      luckTotalsRef.current = {
        ...luckTotalsRef.current,
        [activePlayer]: { ...luckByStep, [luck.step]: { sum: stepTotals.sum + luck.xg, count: stepTotals.count + 1 } },
      };
    }

    // registerHit's setProgress/setPendingHits have not flushed to a render yet inside this
    // same synchronous call, so `progress` and `pendingHits` still describe the board as it
    // was BEFORE this dart. Every path below that ends the turn has to be handed these
    // by-hand values instead — the same pattern resolvePendingChoice already uses.
    //
    // Getting this wrong is not cosmetic: the third dart of a turn is the one that triggers
    // the auto-confirm just below, so a bare confirm() summarised the turn from a pendingHits
    // that was missing that very dart. Every full turn silently lost its last cross from
    // turnLog — and therefore from hit percentage, per-step stats and the career totals in
    // Supabase, while `progress` (and so the game itself) stayed correct. A 30-dart clean
    // sweep reported 21 crosses and 70%.
    const lastHit = hitResult?.[hitResult.length - 1];
    const finalProgress = lastHit
      ? { ...progress, [activePlayer]: { ...progress[activePlayer], [lastHit.step]: lastHit.newCount } }
      : progress;
    const finalPendingHits = hitResult ? [...pendingHits, ...hitResult] : pendingHits;

    // Won the leg on this exact dart — end the turn right now instead of waiting for
    // the rest of this turn's physical darts (or a takeout) to trickle in. Mirrors how
    // the bot's own throwNext loop above already stops early on a mid-turn finish.
    if (hitResult && pendingAmbiguousRef.current.length === 0 && isFinished(finalProgress[activePlayer])) {
      scoliaDartsRef.current = 0;
      advanceTurn(finalProgress, finalPendingHits);
      return;
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
      confirm(finalProgress, finalPendingHits);
    }
  }

  // Also enabled on the setup screen so the status badge is visible before starting a
  // match — real throw/takeout events arriving there are already harmless no-ops,
  // since processDart/confirm all bail out immediately when activePlayer is null
  // (always true on setup, since `players` is empty).
  const scoliaEnabled = screen === "game" || screen === "setup";
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
    onCameraImages: (payload) => {
      setCameraImages(extractImageUrls(payload));
    },
  });

  // Otherwise a dropped relay only shows up as a small badge color change (see
  // ScoliaStatusBadge) that's easy to miss mid-match — speak it instead, but only while a
  // game is actually running, so nobody hears it while just sitting on the setup screen.
  const prevRelayRef = useRef(scolia.state.relay);
  useEffect(() => {
    const prevRelay = prevRelayRef.current;
    prevRelayRef.current = scolia.state.relay;
    if (screen !== "game" || prevRelay === scolia.state.relay) return;
    if (scolia.state.relay === "stale") announce("Kontakten med brettet er brutt.");
    else if (prevRelay === "stale" && scolia.state.relay === "live") announce("Brettet er tilbake.");
  }, [scolia.state.relay, screen]);

  function startGame(
    startPlayers: string[],
    startBotLevels: Record<string, BotLevel> = {},
    startTeamRosters: Record<string, TeamMember[]> = {},
    startGuestPlayers: Record<string, true> = {}
  ) {
    // Called synchronously from a real button tap (SetupScreen/tournament) — the
    // narrow window where the browser actually allows unlocking audio playback, well
    // before a win-fanfare or hit-streak sound needs to fire from a Scolia/Supabase
    // event later. See lib/fanfare.ts's primeAudio for why this matters.
    primeAudio();
    const prog: PlayerProgress = {};
    startPlayers.forEach((p) => (prog[p] = emptyProgress()));
    setPlayers(startPlayers);
    setProgress(prog);
    setCurrentIdx(0);
    setCameraImages([]);
    setPendingHits([]);
    setHistory([]);
    setRewound(null);
    setRewoundTurnIndex(null);
    setWinner(null);
    setPlacements([]);
    setTurnLog({});
    setTurnCounters({});
    setTurnToken(0);
    setTurnShots(EMPTY_TURN_SHOTS);
    setMatchThrows({});
    accuracyTotalsRef.current = {};
    luckTotalsRef.current = {};
    ringHitsRef.current = {};
    updatePendingAmbiguous([]);
    updateAwaitingConfirmResolution(false);
    setBotLevels(startBotLevels);
    setTeamRosters(startTeamRosters);
    setGuestPlayers(startGuestPlayers);
    setTeamMemberIdx({});
    scoliaDartsRef.current = 0;
    setScreen("game");
    if (!startBotLevels[startPlayers[0]]) playPlayerSound(startPlayers[0] ?? null);

    // Building a level's solver the first time it's used is a fairly heavy synchronous
    // computation (see lib/botStrategy.ts) — kick it off now, during idle time right as the
    // match screen appears, rather than letting it block the UI exactly when that bot's first
    // turn comes up. solverFor caches by level, so this is a no-op if already warmed this session.
    const levelsToWarm = new Set<BotLevel>();
    Object.values(startBotLevels).forEach((level) => levelsToWarm.add(level));
    Object.values(startTeamRosters).forEach((roster) =>
      roster.forEach((member) => {
        if (member.isBot && member.botLevel) levelsToWarm.add(member.botLevel);
      })
    );
    if (typeof window !== "undefined" && levelsToWarm.size > 0) {
      const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 0));
      levelsToWarm.forEach((level) => schedule(() => solverFor(level)));
    }
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
    if (screen !== "game" || rewound || !activePlayer || !activeBotLevel) return;
    // Reassigned to a non-nullable local: activeBotLevel is `BotLevel | null` at the type level,
    // and TS doesn't carry the null-check narrowing above into the nested throwNext() closure.
    const level: BotLevel = activeBotLevel;

    const player = activePlayer;
    let cancelled = false;

    function throwNext() {
      if (cancelled || screenRef.current !== "game" || activePlayerRef.current !== player) return;
      const currentProgress = progressRef.current[player];
      if (isFinished(currentProgress)) {
        // Won mid-turn on an earlier simulated dart — stop and let confirm() close it out.
        scoliaDartsRef.current = 0;
        confirmRef.current();
        return;
      }

      const coordinates = botChooseThrow(level, progressRef.current, player, botLevels);
      processDartRef.current({ sector: sectorAt(coordinates), bounceout: false, coordinates });

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
        resolvePendingChoiceRef.current(redirect ? "redirect" : "keep");
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
  }, [screen, activePlayer, turnToken, botLevels, rewound, activeBotLevel]);

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

    // Darts, not crosses — one call is one dart, however many crosses it carries. That
    // distinction is the whole rule: three separate darts on the same number close it "the
    // hard way", while a single triple closing it in one throw does not (see
    // isPerfectClose's marker in Mark.tsx). Counting HitRecords instead would make the two
    // indistinguishable, since a redirected triple also writes three of them.
    const dartsOnStep = (dartsOnStepRef.current[step] ?? 0) + 1;
    dartsOnStepRef.current[step] = dartsOnStep;
    // Three darts each worth one cross, ending on 3, can only have started from 0.
    if (dartsOnStep === 3 && count >= 3) {
      const player = activePlayer;
      setPerfectCloses((prev) => ({ ...prev, [player]: { ...prev[player], [step]: true } }));
    }

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

    // Filtered against finalProgress, not `progress` — this same choice may have just
    // filled the number, which is exactly what makes a sibling choice on that number moot
    // (see meaningfulPending), and the state won't reflect it until the next render.
    const remaining = meaningfulPending(
      pendingAmbiguousRef.current.filter((p) => p.key !== item.key),
      finalProgress[activePlayer]
    );
    updatePendingAmbiguous(remaining);

    if (remaining.length === 0 && awaitingConfirmResolutionRef.current) {
      updateAwaitingConfirmResolution(false);
      advanceTurn(finalProgress, finalPendingHits);
    }
  }

  function undo() {
    haptics.undo();
    // Any held "just placed" highlight can go stale the instant progress is rewound
    // (most obviously on a second, cascading undo) — simplest correct move is to
    // always drop it here rather than try to reconcile it with the rollback below.
    if (pendingHits.length > 0) {
      const last = pendingHits[pendingHits.length - 1];
      setProgress((prev) => ({
        ...prev,
        [last.player]: { ...prev[last.player], [last.step]: last.prevCount },
      }));
      setPendingHits((prev) => prev.slice(0, -1));
      clearPerfectClose(last.player, last.step);
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
      clearPerfectClose(last.player, last.step);
      setRewound(last.player);
      setRewoundTurnIndex(last.turnIndex);
    }
  }

  function finalizeMatch(finalTurnLog: Record<string, TurnResult[]>, winnerName: string | null = null) {
    const stats: Record<string, TurnAggregate> = {};
    // A bot's darts are a simulated Monte Carlo plan, not a physical throw —
    // "luck" doesn't mean anything for one, and would just look like a bug on
    // the winner screen ("Bot 3: +12.4"). Unlike the KASTSPREDNING heatmap
    // (matchThrows), which is a neutral visualization of where darts landed,
    // this panel makes a judgment call about the thrower, so bots are
    // excluded here — team rosters and guests are real humans and stay in.
    // Broken down per section (see lib/dartboard.ts's luckForThrow) as a running
    // SUM, not a mean — a sum is what's directly comparable to the actual crosses
    // landed (an xG-style "forventet vs faktisk" read), which a per-dart average
    // can't give you.
    const luckByPlayer: Record<string, Record<Step, { sum: number; count: number }>> = {};
    players.forEach((p) => {
      const luckByStep = botLevels[p] ? null : luckTotalsRef.current[p];
      const perStep = {} as Record<Step, { sum: number; count: number }>;
      STEPS.forEach((step) => {
        const totals = luckByStep?.[step];
        perStep[step] = { sum: totals?.sum ?? 0, count: totals?.count ?? 0 };
      });
      luckByPlayer[p] = perStep;
    });
    players.forEach((p) => {
      const aggregate = aggregateTurns(finalTurnLog[p] ?? []);
      stats[p] = aggregate;
      // A bot's darts aren't real play — never let them land in a human player's career stats
      // (bots are never ensurePlayer'd into the roster to begin with), a team's name has no
      // individual Supabase player record either, and a guest was never ensurePlayer'd either
      // (see SetupScreen's addPlayer) — so results only ever count for a real, saved individual.
      if (botLevels[p] || teamRosters[p] || guestPlayers[p]) return;
      const dartsUsed = aggregate.hits + aggregate.misses;
      // A match aborted before this player ever threw a dart isn't a match they played — without
      // this guard, quitting instantly (or a tournament match started and immediately abandoned)
      // still counted as a full "kamp" in their career matchesPlayed, with nothing to show for it.
      if (dartsUsed === 0) return;
      recordMatchResult(p, aggregate, p === winnerName);
      const accuracy = accuracyTotalsRef.current[p];
      if (accuracy) recordAccuracyTotals(p, accuracy);
      const luckTotals = luckTotalsRef.current[p];
      if (luckTotals) recordLuckTotals(p, luckTotals);
      const ringHits = ringHitsRef.current[p];
      if (ringHits) recordRingHits(p, ringHits.triple, ringHits.double);

      recordMatchHistory(p, {
        date: new Date().toISOString(),
        won: p === winnerName,
        dartsUsed,
        hitPct: Math.round((aggregate.hits / dartsUsed) * 100),
        med: accuracy && accuracy.throws > 0 ? accuracy.distance / accuracy.throws : null,
        mhd: accuracy && accuracy.throws > 0 ? accuracy.horizontal / accuracy.throws : null,
        mvd: accuracy && accuracy.throws > 0 ? accuracy.vertical / accuracy.throws : null,
      });
    });
    return { stats, luckByPlayer };
  }

  /**
   * The overrides exist for one caller: the auto-confirm fired by a turn's third dart, from
   * inside the very handler that registered it. At that moment `progress`/`pendingHits`
   * state has not flushed, so without them the turn gets summarised without its last dart.
   * Every other caller (the Bekreft button, a takeout, the bot's own loop) runs a tick or
   * more later, with state settled, and passes nothing.
   */
  function confirm(progressOverride?: PlayerProgress, pendingHitsOverride?: HitRecord[]) {
    if (!activePlayer) return;
    scoliaDartsRef.current = 0;
    const effectiveProgress = progressOverride ?? progress;
    // Reads the ref, not the pendingAmbiguous state — see pendingAmbiguousRef's
    // comment above for why the state can be stale right here.
    const pending = meaningfulPending(pendingAmbiguousRef.current, effectiveProgress[activePlayer]);
    if (pending.length !== pendingAmbiguousRef.current.length) updatePendingAmbiguous(pending);
    if (pending.length > 0) {
      // Handing off to the choice dialog. By the time resolvePendingChoice runs, state has
      // settled, so it reads pendingHits itself rather than needing these passed along.
      updateAwaitingConfirmResolution(true);
      return;
    }
    advanceTurn(progressOverride, pendingHitsOverride);
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
    dartsOnStepRef.current = {};
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
      // Rotate this team's own "who throws next" pointer independent of the overall players[]
      // turn order — so next time this exact team is up, the next member in line is current.
      const roster = teamRosters[activePlayer];
      if (roster && roster.length > 0) {
        setTeamMemberIdx((prev) => ({ ...prev, [activePlayer]: ((prev[activePlayer] ?? 0) + 1) % roster.length }));
      }
    }

    if (effectivePendingHits.length > 0) {
      setHistory((prev) => [...prev, ...effectivePendingHits]);
      setPendingHits([]);
    }

    if (isFinished(effectiveProgress[activePlayer])) {
      haptics.win();
      playFanfare();
      // Reaching the winner screen must never depend on stats persistence succeeding —
      // see abortGame's identical guard for why.
      let stats: Record<string, TurnAggregate> = {};
      let luckByPlayer: Record<string, Record<Step, { sum: number; count: number }>> = {};
      try {
        ({ stats, luckByPlayer } = finalizeMatch(nextTurnLog, activePlayer));
      } catch (err) {
        console.error("Klarte ikke å lagre statistikk ved kampslutt:", err);
        reportError("Kunne ikke lagre kampresultatet.", { key: "finalize-match" });
      }
      setWinnerStats(stats);
      setWinnerLuck(luckByPlayer);
      setWinner(activePlayer);
      // Ranks everyone by how close they were to finishing at this exact moment — for a normal
      // 2-player match this is trivially [winner, loser]; for a tournament pod with 3+ players it
      // approximates 2nd/3rd place without playing the match out further (see remainingMarks).
      setPlacements([...players].sort((a, b) => remainingMarks(effectiveProgress[a]) - remainingMarks(effectiveProgress[b])));
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
    setCameraImages([]);
  }

  function abortGame() {
    // A match that's abandoned before anyone wins never persists any stats —
    // only a match that actually finishes counts as a "kamp", same principle
    // Bull-duell was built with from the start (see lib/bullDuel.ts).
    clearActiveMatch();
    setScreen("setup");
    setPlayers([]);
    // A tournament match (onMatchComplete set) has nowhere sensible to land on the generic,
    // disconnected SetupScreen — bail straight home instead; the tournament itself lives on in
    // Supabase regardless, so "Fortsett turnering" picks it back up later.
    if (onMatchComplete) onExitToHome?.();
  }

  function playAgain() {
    if (onMatchComplete && winner) {
      onMatchComplete({ winner, placements, stats: winnerStats });
      return;
    }
    setScreen("setup");
    setPlayers([]);
  }

  /** Same roster, fresh match — bot levels/team rosters/guest flags all still reflect the match
   *  that just finished, so this is just startGame with today's already-known values instead of
   *  sending the host back through SetupScreen to re-enter everyone. Tournament mode has its own
   *  "Til turnering" flow via playAgain/onMatchComplete, so this is never offered there (see the
   *  WinnerScreen call site below). */
  function rematch() {
    startGame(players, botLevels, teamRosters, guestPlayers);
  }

  if (screen === "setup") {
    // Tournament matches skip SetupScreen entirely (see the restore-from-localStorage effect
    // above) — but this branch can still render for one tick before that effect's startGame call
    // takes effect, so keep it as a harmless fallback rather than special-casing it away.
    return (
      <>
        <ScoliaStatusBadge state={scolia.state} />
        <SetupScreen onStart={startGame} onHome={onExitToHome} />
      </>
    );
  }

  if (screen === "winner" && winner) {
    return (
      <WinnerScreen
        winner={winner}
        players={players}
        stats={winnerStats}
        luckByPlayer={winnerLuck}
        throwsByPlayer={matchThrows}
        onHome={playAgain}
        homeLabel={onMatchComplete ? "Til turnering" : "Hjem"}
        onPlayAgain={onMatchComplete ? undefined : rematch}
      />
    );
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
      <CameraImages images={cameraImages} />
      {activeBotLevel && rewound === null && (
        <div
          className="turn-toast fixed top-16 z-40 px-3 py-1.5 rounded-full text-sm shadow-panel"
          style={{ background: "var(--color-surface)", color: "var(--color-teal)", border: "1px solid var(--color-border)" }}
        >
          {currentMember ? currentMember.name : activePlayer} kaster …
        </div>
      )}
      {/* A mixed team's human member up now — the column only shows the team's name, so this is
          the only way the physical players know who should actually pick up the darts. */}
      {!activeBotLevel && currentMember && rewound === null && (
        <div
          className="turn-toast fixed top-16 z-40 px-3 py-1.5 rounded-full text-sm shadow-panel"
          style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
        >
          {currentMember.name} sin tur
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
        rewound={rewound !== null}
        pendingCount={pendingHits.length}
        canUndo={pendingHits.length > 0 || history.length > 0}
        pendingChoice={rewound === null ? pendingAmbiguous[pendingAmbiguous.length - 1] ?? null : null}
        awaitingConfirmResolution={awaitingConfirmResolution}
        hitPulse={hitPulse}
        closedStep={closedStep}
        perfectCloses={perfectCloses}
        onResolvePendingChoice={resolvePendingChoice}
        onRegisterHit={activeBotLevel ? () => {} : registerHit}
        onUndo={activeBotLevel ? () => {} : undo}
        onConfirm={activeBotLevel ? () => {} : confirm}
        onAbort={abortGame}
      />
      {tripleCelebration && <TripleCelebration images={cameraImages} onDismiss={() => setTripleCelebration(false)} />}
    </>
  );
}
