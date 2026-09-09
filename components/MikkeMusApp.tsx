"use client";

import { useEffect, useRef, useState } from "react";
import {
  aggregateTurns,
  ambiguousBlockingRing,
  chainCrosses,
  currentStepFor,
  DARTS_PER_TURN,
  emptyProgress,
  isRegistrable,
  isFinished,
  meaningfulPending,
  progressLogMismatch,
  remainingMarks,
  removeOneCross,
  STEPS,
  summarizeTurn,
  totalMarks,
  type HitRecord,
  type PlayerProgress,
  type Progress,
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
import { coordinatesForSector, luckForThrow, sectorAt, throwAccuracy } from "@/lib/dartboard";
import { getRules, setGameVariant, type GameVariant } from "@/lib/rules";
import { haptics } from "@/lib/haptics";
import { playFanfare, playHitStreakSound, playWinBoom, primeAudio } from "@/lib/fanfare";
import { classifyThrow, formatSectorLabel, parseSector } from "@/lib/scoliaMapping";
import {
  applyDartToBoard,
  replayDiscardedSingles,
  type DartAction,
  type TapAction,
  type TurnAction,
  type TurnStart,
} from "@/lib/turnResolution";

/** A dart in the running turn, with what the component needs on top of the serialisable action:
 *  the records it created (for re-parking a ring dart — see replayAfterRedirect) and what xH made
 *  of it (to take back if it turns out to have been aimed elsewhere). */
type LiveDart = DartAction & { luck: { step: Step; xg: number } | null; records: HitRecord[] };
type LiveAction = LiveDart | TapAction;
import { botChooseThrow, botDecideRedirect, solverFor } from "@/lib/botStrategy";
import { type BotLevel, type TeamMember } from "@/lib/botLevels";
import { useScolia } from "@/lib/useScolia";
import { extractImageUrls } from "@/lib/extractImageUrls";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";
import { WinDive } from "./WinDive";
import { ScoliaStatusBadge, summarizeScolia } from "./ScoliaStatusBadge";
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

/**
 * The live_match snapshot is one Supabase write, and it used to go out on every single state
 * change — every dart, every tap, every pending-hit edit, hundreds of round trips a match from
 * a phone. The storskjerm view polls on its own schedule anyway, so nothing there notices a
 * write coalesced with the ones around it. Only the trailing state matters.
 */
const LIVE_PUBLISH_DEBOUNCE_MS = 700;

/** Pause between a bot's simulated darts — purely cosmetic pacing, so the shot
 *  boxes/marks visibly animate in one at a time instead of all landing at once. */
const BOT_THROW_DELAY_MS = 900;

/** How long a finished bot turn stays on screen. Its third dart ends the turn in the same tick
 *  it lands, so without a hold that dart is never drawn at all — see scheduleBotDisplayClear.
 *  Longer than a bot throw interval, so the next thrower is what replaces it, not a timer. */
const BOT_DISPLAY_HOLD_MS = 1600;

/** Longest a bot will wait for your darts to come out of the board before throwing anyway.
 *  Generous enough to walk to the board and back; short enough that a lost takeout event is
 *  an annoyance rather than a stopped match. */
const TAKEOUT_WAIT_MAX_MS = 12_000;

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
  /** Which game the tournament plays — see lib/rules.ts. Standard when absent. */
  initialVariant?: GameVariant;
  /** When set, the winner screen's home button reports the result here instead of resetting to
   *  SetupScreen — the caller (tournament mode) decides what happens next. */
  onMatchComplete?: (result: { winner: string; placements: string[]; stats: Record<string, TurnAggregate> }) => void;
  /** Bails all the way back to the true home screen (AppRoot) — wired into SetupScreen's "← Hjem"
   *  and into aborting a tournament match (which would otherwise strand the player on the generic,
   *  disconnected SetupScreen instead of back where they actually came from). */
  onExitToHome?: () => void;
};

export function MikkeMusApp({ initialPlayers, initialBotLevels, initialTeamRosters, initialVariant, onMatchComplete, onExitToHome }: MikkeMusAppProps = {}) {
  const [screen, setScreen] = useState<Screen>("setup");
  // Which game this match is (see lib/rules.ts). The module-wide rules are set alongside it in
  // startGame and on restore; this copy is what gets saved, published and shown.
  const [variant, setVariant] = useState<GameVariant>("standard");
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
  // Declared up here, not down with the render values, because the fallback timer below needs
  // it in its dependency list — a const referenced before its own declaration is a TDZ error.
  const dartsThisTurn = turnShots.filter(Boolean).length;
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
  // The same totals flattened across steps, as state rather than a ref, purely so the landscape
  // side panel can show them while the match is still running.
  const [luckLive, setLuckLive] = useState<Record<string, { sum: number; count: number }>>({});
  /**
   * D and T crosses banked while the player was on a DIFFERENT number — slengere, in other words.
   *
   * xH judges every dart as an attempt at the active step, so a pre-banked triple on 6 while on
   * 20 is a miss at 20, and its T cross is luck outside the accounting. For the "forventet /
   * faktisk" reading to stay honest, the faktisk side has to leave those same crosses out: what
   * the T row compares against is the crosses won as attempts at T, i.e. total minus pre-banked.
   * A triple on the player's OWN number that stays on the ring is not a slenger: it is booked as
   * an attempt at T, judged as one (worth 1), and counts (see HitRecord.ownNumberRing). Numbers
   * and BULL can only ever score while active, so they need no such correction.
   *
   * Ref mirrored synchronously, same reasoning as progressRef: it is adjusted inside the same
   * handlers that create and roll back the records it counts.
   */
  /**
   * Everything that has happened in the current turn, in order (see TurnAction). This is what
   * Angre and "correct that dart" operate on: rewind to turnStartRef, play the list back minus
   * the last action (or with one dart swapped). Darts carry two live extras — the records they
   * created and what xH made of them — for the redirect replay (replayAfterRedirect). Reset when
   * the turn ends. Mirrored into state as a count, so the buttons that depend on "is there a
   * turn to edit" re-render when it changes.
   */
  const turnActionsRef = useRef<LiveAction[]>([]);
  const [turnActionCount, setTurnActionCount] = useState(0);
  function writeTurnActions(next: LiveAction[]) {
    turnActionsRef.current = next;
    setTurnActionCount(next.length);
  }
  const turnDarts = () => turnActionsRef.current.filter((a): a is LiveDart => a.kind === "dart");
  /** Where the current turn started from — set by the turn's first action, cleared when it ends. */
  const turnStartRef = useRef<TurnStart | null>(null);
  /** True while actions are being played back: the darts are real, the fanfare is not. */
  const replayingRef = useRef(false);
  /** A turn found mid-way in the restored snapshot, waiting for the player to be mounted. */
  const pendingReplayRef = useRef<{ start: TurnStart; actions: TurnAction[] } | null>(null);
  /** Dev only: behave as if a board were online and going to report takeouts. */
  const devTakeoutRef = useRef(false);
  const preBankedRef = useRef<Record<string, { D: number; T: number }>>({});
  const [preBanked, setPreBanked] = useState<Record<string, { D: number; T: number }>>({});
  function bumpPreBanked(player: string, ring: "D" | "T", delta: number) {
    const cur = preBankedRef.current[player] ?? { D: 0, T: 0 };
    const next = { ...preBankedRef.current, [player]: { ...cur, [ring]: Math.max(0, cur[ring] + delta) } };
    preBankedRef.current = next;
    setPreBanked(next);
  }
  /** A D/T record counts as pre-banked when that row was not the active step at the time. */
  function isPreBank(step: Step, activeBefore: Step | null): step is "D" | "T" {
    return (step === "D" || step === "T") && activeBefore !== step;
  }
  // Pending live_match write — see LIVE_PUBLISH_DEBOUNCE_MS.
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (publishTimerRef.current) clearTimeout(publishTimerRef.current); }, []);
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
  /**
   * A bot is actually taking its turn right now — which is when the human's controls must be
   * inert, so a stray tap can't score into a turn being auto-played.
   *
   * Not the same as "the active player is a bot". Undo with nothing pending walks back into the
   * previous turn and makes its owner active, so undoing on your own turn right after a bot
   * threw made the BOT active. Gating on activeBotLevel alone then killed Angre, Bekreft and
   * the board at once, while the bot's own effect below bails out on `rewound` — nothing could
   * advance from either side, and the game was stuck. A rewound turn is a manual edit, bot or
   * not, so the controls have to stay live.
   */
  const botIsThrowing = activeBotLevel !== null && rewound === null;

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
  const pendingHitsRef = useRef(pendingHits);
  const activePlayerRef = useRef(activePlayer);
  const screenRef = useRef(screen);
  const processDartRef = useRef(processDart);
  const resolvePendingChoiceRef = useRef(resolvePendingChoice);
  const confirmRef = useRef(confirm);
  const flushMatchResultsRef = useRef(flushMatchResults);
  /**
   * Every write to the board and to this turn's records goes through these two, and they
   * update the ref BEFORE the setState. That ordering is the point.
   *
   * Both values are read back inside the same synchronous handler that just wrote them — the
   * bot throws and resolves a triple/double in one tick, a dart's third throw auto-confirms
   * from inside its own handler. React state is a render behind at those moments, and two of
   * these functions write the whole list rather than appending to it, so a stale read didn't
   * just miss an update, it erased one. That is what drove the board and the turn log apart.
   * Reading progressRef/pendingHitsRef instead makes the staleness impossible rather than
   * something each call site has to remember.
   */
  function writeProgress(next: PlayerProgress) {
    progressRef.current = next;
    setProgress(next);
  }

  function writePendingHits(next: HitRecord[]) {
    pendingHitsRef.current = next;
    setPendingHits(next);
  }

  useEffect(() => {
    activePlayerRef.current = activePlayer;
    screenRef.current = screen;
    processDartRef.current = processDart;
    // Dev-only: lets a throw be fed in from the console (`__mikkeDart("S16", [x, y])`) without a
    // board or a row in scolia_events — which is shared with the real board, so a test dart put
    // there would land in whatever match is being played on it.
    if (process.env.NODE_ENV === "development") {
      const dev = window as unknown as { __mikkeDart?: unknown; __mikkeCoords?: unknown; __mikkeTakeout?: unknown; __mikkeExpectTakeout?: unknown };
      // Coordinates default to the middle of the sector's bed, so xH and the heatmap see a
      // plausible dart rather than one at the bull.
      dev.__mikkeDart = (sector: string, coordinates: [number, number] = coordinatesForSector(sector)) =>
        processDart({ sector, bounceout: sector === "None", coordinates });
      dev.__mikkeCoords = coordinatesForSector;
      // The board's takeout, as the relay would report it: the hand reaching in, then the darts out.
      dev.__mikkeTakeout = (phase: "started" | "finished" | "both" = "both") => {
        if (phase !== "finished") handleTakeoutStarted();
        if (phase !== "started") handleTakeoutFinished({ falseTakeout: false });
      };
      dev.__mikkeExpectTakeout = (on: boolean) => {
        devTakeoutRef.current = on;
      };
    }
    resolvePendingChoiceRef.current = resolvePendingChoice;
    confirmRef.current = confirm;
    flushMatchResultsRef.current = flushMatchResults;
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
      // Before the board is put back: every rule the render below reads comes from this.
      setGameVariant(restored.variant);
      setVariant(restored.variant ?? "standard");
      setScreen(restored.screen);
      setPlayers(restored.players);
      writeProgress(restored.progress);
      setCurrentIdx(restored.currentIdx);
      writePendingHits(restored.pendingHits);
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
      // The match's statistics, back into the refs they live in. Absent in older snapshots.
      setMatchThrows(restored.matchThrows ?? {});
      luckTotalsRef.current = restored.luckTotals ?? {};
    preBankedRef.current = restored.preBanked ?? {};
    setPreBanked(preBankedRef.current);
      accuracyTotalsRef.current = restored.accuracyTotals ?? {};
      ringHitsRef.current = restored.ringHits ?? {};
      writePerfectCloses(restored.perfectCloses ?? {});
      // A turn caught mid-way. It cannot be replayed here — the player it belongs to is not
      // mounted until the state above has rendered — so it is parked for the effect below.
      // A bot's half-turn is dropped instead: the bot effect starts its turn over anyway.
      if (restored.turnStart && restored.turnActions && restored.turnActions.length > 0 && !(restored.botLevels ?? {})[restored.turnStart.player]) {
        pendingReplayRef.current = { start: restored.turnStart, actions: restored.turnActions };
      }
      // The flat per-player total the landscape panel reads, rebuilt from the per-step totals
      // rather than stored twice — two copies of one number is a chance for them to disagree.
      setLuckLive(
        Object.fromEntries(
          Object.entries(restored.luckTotals ?? {}).map(([player, byStep]) => [
            player,
            Object.values(byStep).reduce(
              (acc, s) => ({ sum: acc.sum + s.sum, count: acc.count + s.count }),
              { sum: 0, count: 0 },
            ),
          ]),
        ),
      );
    } else if (initialPlayers) {
      // Tournament mode: nothing to resume, so jump straight into the given match instead of
      // showing SetupScreen.
      startGame(initialPlayers, initialBotLevels ?? {}, initialTeamRosters ?? {}, {}, initialVariant ?? "standard");
    }
    setHydratedFromStorage(true);
    // initialPlayers/initialBotLevels are only meant to apply once, on the very first mount of a
    // fresh match (like the restored-match branch above) — re-running this on their identity
    // would restart a match that's already in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The second half of the restore above: once the mid-turn player is the active one, put the
  // board back to where their turn started and play the turn's actions through the ordinary
  // paths. That rebuilds the dart counter, the shot boxes and any open triple/double choice —
  // the things a reload used to lose, leaving a parked cross on the ring with no question and a
  // turn that ended a dart early. (Still inside the set-state-in-effect exemption opened above.)
  useEffect(() => {
    const job = pendingReplayRef.current;
    if (!job || screen !== "game" || activePlayer !== job.start.player) return;
    pendingReplayRef.current = null;
    turnStartRef.current = job.start;
    // Placeholders so rewindTurn knows how many darts to take back off the heatmap.
    writeTurnActions(job.actions.map((a): LiveAction => (a.kind === "dart" ? { ...a, luck: null, records: [] } : a)));
    if (rewindTurn()) replayActions(job.actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the handlers it calls are re-created every render; only the gate matters
  }, [screen, activePlayer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persists the in-progress match on every change, and clears it once the match
  // ends or is aborted (both routes back to screen "setup" — see abortGame/playAgain).
  // Also publishes a small live_match snapshot for a second "storskjerm" device to render
  // (see lib/liveMatch.ts) — same trigger, since both are "the match state just changed".
  useEffect(() => {
    if (!hydratedFromStorage) return;
    if (screen === "setup") {
      clearActiveMatch();
      // Not debounced: "the match is over" is the one snapshot a second screen must not be
      // left waiting for, and it happens once.
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      publishLiveMatch(null);
      return;
    }
    saveActiveMatch({
      screen,
      variant,
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
      // Read straight off the refs. Safe because this effect already reruns on every dart —
      // progress and matchThrows both change — so what is read here is always current.
      matchThrows,
      luckTotals: luckTotalsRef.current,
      preBanked: preBankedRef.current,
      accuracyTotals: accuracyTotalsRef.current,
      ringHits: ringHitsRef.current,
      perfectCloses: perfectClosesRef.current,
      // The turn in progress, without its live extras (records are identities, rebuilt by replay).
      turnStart: turnStartRef.current,
      turnActions: turnActionsRef.current.map((a): TurnAction =>
        a.kind === "dart"
          ? { kind: "dart", dartIndex: a.dartIndex, sector: a.sector, bounceout: a.bounceout, scored: a.scored, coordinates: a.coordinates }
          : a,
      ),
    });
    const snapshot = { screen, players, progress, activePlayer, turnToken, winner, botLevels, guestPlayers, variant };
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    publishTimerRef.current = setTimeout(() => publishLiveMatch(snapshot), LIVE_PUBLISH_DEBOUNCE_MS);
  }, [
    hydratedFromStorage,
    screen,
    variant,
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
    // The stats above are read off refs, which can't trigger this. This is the one state value
    // that changes on the same beat they do, so it stands in for all of them.
    matchThrows,
  ]);

  /** Clears the shot boxes and the "just placed" mark highlight — see the call sites below for when. */
  function clearTurnDisplay() {
    cancelBotDisplayClear();
    setTurnShots(EMPTY_TURN_SHOTS);
    // Clears the heat GameScreen derives from this — the build belongs to one turn, and
    // clearing it here (rather than in an effect over there) keeps that view a pure
    // function of props with no state or timers of its own.
    setHitPulse(null);
    // Same reasoning, and it was missing: closedStep drives the gold flash on a row's label
    // when it reaches 3/3, but nothing ever cleared it. The last row closed kept its label
    // gold indefinitely — and since startGame didn't reset it either, it carried into the NEXT
    // match, where a freshly started board showed a gold 14 nobody had closed.
    setClosedStep(null);
  }

  /**
   * Leaves a finished bot turn on screen just long enough to read its last dart, then clears.
   *
   * Cancelled by clearTurnDisplay, which every new turn's first dart calls — so if the next
   * player throws before this fires, their display replaces the bot's rather than being wiped
   * by a timer left over from it.
   */
  function scheduleBotDisplayClear() {
    cancelBotDisplayClear();
    botDisplayTimerRef.current = setTimeout(() => {
      botDisplayTimerRef.current = null;
      setTurnShots(EMPTY_TURN_SHOTS);
      setHitPulse(null);
      setClosedStep(null);
    }, BOT_DISPLAY_HOLD_MS);
  }

  function cancelBotDisplayClear() {
    if (botDisplayTimerRef.current) {
      clearTimeout(botDisplayTimerRef.current);
      botDisplayTimerRef.current = null;
    }
  }

  // Counts physical darts Scolia has detected this turn (registrable or not) —
  // distinct from pendingHits, which only holds darts that actually scored a cross.
  const scoliaDartsRef = useRef(0);

  // Consecutive scoring darts, right now — drives how big the boom is (see lib/fanfare.ts)
  // and the matching shake and heat. Reset at the start of a turn and by any miss, but a miss
  // no longer silences what follows: the next hit sounds again from level one.
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
  // Mirrored synchronously, like progressRef: the turn-start snapshot reads it in the same
  // handler that is about to change it.
  const perfectClosesRef = useRef<Record<string, Partial<Record<Step, true>>>>({});
  function writePerfectCloses(next: Record<string, Partial<Record<Step, true>>>) {
    perfectClosesRef.current = next;
    setPerfectCloses(next);
  }
  function markPerfectClose(player: string, step: Step) {
    writePerfectCloses({ ...perfectClosesRef.current, [player]: { ...perfectClosesRef.current[player], [step]: true } });
  }

  /** Drops the three-dart marker for a step an undo has just pulled back below 3/3. */
  function clearPerfectClose(player: string, step: Step) {
    const prev = perfectClosesRef.current;
    if (!prev[player]?.[step]) return;
    const forPlayer = { ...prev[player] };
    delete forPlayer[step];
    writePerfectCloses({ ...prev, [player]: forPlayer });
  }

  // Retriggerable signals for GameScreen's shake/heat and the closing-row slam. Tokens
  // rather than booleans so the same value twice in a row still reads as a new event.
  const [hitPulse, setHitPulse] = useState<{ token: number; streak: number } | null>(null);
  const [closedStep, setClosedStep] = useState<{ token: number; step: Step } | null>(null);
  // True from the winning dart until WinDive lands in the bull — see the winner branch below.
  const [diving, setDiving] = useState(false);
  // Same animation at the other end of a match: the intro when a game starts.
  const [introDiving, setIntroDiving] = useState(false);
  // One drift report per match — see the check in advanceTurn.
  const mismatchReportedRef = useRef(false);
  const botDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True between a human confirming their turn and their darts actually leaving the board.
  // A bot holds off while it is set — see the takeout handler and the bot effect.
  const [awaitingTakeout, setAwaitingTakeout] = useState(false);
  const takeoutWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Manual registrations this turn — the only dart-ish count available off Scolia. Reset per
  // turn in advanceTurn; see the dart count there for the narrow case it is used in.
  const manualTapsRef = useRef(0);
  // The finished match, waiting to be accepted — see flushMatchResults.
  const pendingResultRef = useRef<{ turnLog: Record<string, TurnResult[]>; winnerName: string | null } | null>(null);
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
    // The triple/double choice is still open. finishTurn zeroed the dart counter and returned
    // without advancing, so anything arriving now would be scored as dart 1 of a new turn —
    // onto the same player, wiping the shot boxes, with the unanswered choice still queued.
    // A phantom bounce-out is enough to trigger it. Refuse the dart instead and say why; it
    // can be tapped in by hand after the choice, which is far better than scoring it wrong.
    if (awaitingConfirmResolutionRef.current) {
      reportError("Velg trippel eller dobbel før neste pil — denne ble ikke registrert.", { key: "dart-during-choice" });
      return;
    }
    // Three darts are in and the turn is waiting for the takeout that confirms it (see the
    // third-dart branch below). A fourth dart can only be the NEXT player's first, with the
    // takeout event lost somewhere between the board and here. Confirm what is finished, then
    // hand this dart back in on the next tick — `activePlayer` in this closure is still the
    // player who just finished, and only a render moves it on.
    if (scoliaDartsRef.current >= DARTS_PER_TURN) {
      scoliaDartsRef.current = 0;
      finishTurn();
      setTimeout(() => processDartRef.current(payload), 0);
      return;
    }
    ensureTurnStart();
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

    // The board right before this dart — from the ref, not the `progress` state, because a
    // replayed turn (see replayActions) runs its darts back to back in one tick and each must
    // see the one before it. What the player was working on is used both to resolve the throw
    // and, below, as the MED/MHD/MVD target (see lib/dartboard.ts: for a miss, this is still
    // the meaningful "how far off from what you were aiming at" reference, not just a no-op).
    const boardBefore = progressRef.current[activePlayer];
    const activeStepAtThrow = currentStepFor(boardBefore);

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

    // No spoken call-out for a triple or a bullseye. The synthesized voice reading "trippel
    // femten" over the boom was worse than the boom alone — the throw already announces itself
    // with the escalating hit sound, the shot box and the mark going down. Speech is kept for
    // the board dropping out and coming back (see the relay watcher below), which is the one
    // thing you need to hear when you are not looking at the phone.

    const classified = classifyThrow(parsed, activeStepAtThrow, boardBefore);
    // A parked, still-undecided triple/double must not be the reason this dart finds its row
    // full — see ambiguousBlockingRing in lib/game.ts.
    const candidate = classified.step ? ambiguousBlockingRing(pendingAmbiguousRef.current, classified.step, boardBefore) : null;
    // Belt and braces on top of advanceTurn clearing these: only ever un-park a dart whose
    // cross is still un-confirmed. Once its record has moved to history the turn log owns it,
    // and rolling it back here would take it off the board and leave it in the stats.
    const parked = candidate && pendingHitsRef.current.includes(candidate.hitRecord) ? candidate : null;
    // A double/triple on the player's own active number that stays on the ring — parked as a
    // choice, or kept outright by the one-cross-left rule. Judged and booked as an attempt at
    // the ring, not as a slenger; if it is redirected later, resolvePendingChoice re-judges it.
    const ownNumberRing =
      parsed.kind === "number" &&
      (parsed.ring === "D" || parsed.ring === "T") &&
      String(parsed.number) === activeStepAtThrow &&
      classified.step === parsed.ring;
    const applied = classified.step
      ? parked
        ? freeRingAndRegister(parked, classified.step, classified.crosses)
        : applyPlainHit(classified.step, classified.crosses, ownNumberRing)
      : null;
    const hitResult: HitRecord[] | null = applied?.hits ?? null;
    if (classified.ambiguous && hitResult) {
      const created = hitResult[0];
      updatePendingAmbiguous((prev) => [
        ...prev,
        { key: ++pendingAmbiguousKeyRef.current, hitRecord: created, dartIndex, ...classified.ambiguous! },
      ]);
    }
    // A later plain hit on the same number used to silently discard the pending choice,
    // reading it as "still working this number, so the triple must have stayed on T". The
    // inference runs backwards: still working the number is exactly why you'd want the
    // triple to COMPLETE it. With 17 on 1/3 and T on 2/3, a T17 followed by a plain 17 then
    // filled T and left 17 on 2 — the opposite of what the throw was worth, decided without
    // asking. The choice now survives to Confirm, where it's presented with the numbers.
    const hit = hitResult !== null;
    // Every hit gets a boom. What the streak changes is how big it is.
    //
    // This used to go silent for the rest of the turn after a single miss — the streak had to
    // be unbroken from dart one, so a miss then two hits made no sound at all. A dart that
    // scores should always be heard; the escalation is the reward for stringing them together,
    // and three in a row is the one that really lands (see BOT_DISPLAY_HOLD_MS's neighbour,
    // boomForStreak, and the 1300ms tremor in GameScreen).
    if (hit) {
      hitStreakRef.current += 1;
      const streak = Math.min(3, hitStreakRef.current) as 1 | 2 | 3;
      // A replayed dart already had its boom the first time round.
      if (!replayingRef.current) {
        playHitStreakSound(streak);
        setHitPulse({ token: ++pulseTokenRef.current, streak });
      }
    } else {
      // A miss breaks the run, but only the run — the next hit still sounds, from the bottom.
      hitStreakRef.current = 0;
    }

    // A row reaching 3/3 gets its own slam — see the step-slam animation in globals.css.
    const closed = hitResult?.find((h) => h.newCount >= getRules().target && h.prevCount < getRules().target);
    if (closed && !replayingRef.current) setClosedStep({ token: ++pulseTokenRef.current, step: closed.step });

    // Three triples on the active number, in one turn.
    if (
      parsed.kind === "number" &&
      parsed.ring === "T" &&
      activeStepAtThrow !== null &&
      !Number.isNaN(Number(activeStepAtThrow)) &&
      parsed.number === Number(activeStepAtThrow)
    ) {
      activeTriplesRef.current += 1;
      if (activeTriplesRef.current === 3 && !replayingRef.current) setTripleCelebration(true);
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
    // A ring hit on the own number is judged as the ring attempt it is booked as (worth one
    // cross there); everything else against the active step. Redirecting it later re-judges it
    // against the number — so three T17s in a turn read as 1+1+1 until one becomes 17×3, and
    // the sum always matches the crosses they actually brought.
    const luck = luckForThrow(payload.coordinates, ownNumberRing ? (parsed.ring as Step) : activeStepAtThrow, boardBefore);
    if (luck !== null) {
      const luckByStep = luckTotalsRef.current[activePlayer] ?? emptyLuckByStep();
      const stepTotals = luckByStep[luck.step];
      // Mirrored into state as a flat total as well: the landscape side panel shows this live,
      // and a ref alone would leave it stale — refs don't re-render, and reading one during
      // render is exactly what the React Compiler is free to memoize away.
      setLuckLive((prev) => {
        const running = prev[activePlayer] ?? { sum: 0, count: 0 };
        return { ...prev, [activePlayer]: { sum: running.sum + luck.xg, count: running.count + 1 } };
      });
      luckTotalsRef.current = {
        ...luckTotalsRef.current,
        [activePlayer]: { ...luckByStep, [luck.step]: { sum: stepTotals.sum + luck.xg, count: stepTotals.count + 1 } },
      };
    }

    writeTurnActions([
      ...turnActionsRef.current,
      {
        kind: "dart",
        dartIndex,
        sector: payload.sector,
        bounceout: payload.bounceout,
        coordinates: payload.coordinates,
        scored: hit,
        luck,
        records: hitResult ?? [],
      },
    ]);

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
    const finalProgress = applied?.progress ?? progressRef.current;
    const finalPendingHits = applied?.pendingHits ?? pendingHitsRef.current;

    // Won the leg on this exact dart — end the turn right now instead of waiting for
    // the rest of this turn's physical darts (or a takeout) to trickle in. Mirrors how
    // the bot's own throwNext loop above already stops early on a mid-turn finish.
    if (hitResult && pendingAmbiguousRef.current.length === 0 && isFinished(finalProgress[activePlayer])) {
      scoliaDartsRef.current = 0;
      advanceTurn(finalProgress, finalPendingHits, dartIndex + 1);
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
      // With a live board, the turn ends the way it does in real darts: when the darts come
      // out. Until then it stays open — the third dart can be undone, a misread box corrected,
      // the choice dialog answered — and the takeout confirms it (see handleTakeoutStarted).
      // Confirming on the third dart instead closed the turn before the player could see what
      // the board made of it. Without a board to report the takeout (manual play, a bot, the
      // board offline) there is nothing to wait for, so the turn ends here as before.
      if (expectsTakeout()) {
        // The triple/double question, though, is asked now — the player is standing there
        // looking at the dart, not at the takeout. Answering it does not end the turn (see
        // resolvePendingChoice); the takeout still does.
        const pending = meaningfulPending(pendingAmbiguousRef.current, finalProgress[activePlayer]);
        if (pending.length !== pendingAmbiguousRef.current.length) updatePendingAmbiguous(pending);
        if (pending.length > 0) updateAwaitingConfirmResolution(true);
        return;
      }
      scoliaDartsRef.current = 0;
      finishTurn(finalProgress, finalPendingHits, dartIndex + 1);
    }
  }

  // Also enabled on the setup screen so the status badge is visible before starting a
  // match — real throw/takeout events arriving there are already harmless no-ops,
  // since processDart/confirm all bail out immediately when activePlayer is null
  // (always true on setup, since `players` is empty).
  const scoliaEnabled = screen === "game" || screen === "setup";

  /**
   * Whether a takeout event is coming to end this turn: a live board, a human throwing. Same
   * test the bot's own wait uses. `devTakeoutRef` lets the dev console pretend the board is
   * there (see the __mikke* hooks) so the deferred path can be exercised without one.
   */
  function expectsTakeout(): boolean {
    if (activeBotLevel !== null) return false;
    return devTakeoutRef.current || (scoliaEnabled && scolia.state.boardStatus === "Ready");
  }

  /** The hand reaching for the darts. Ends the turn — three darts in, or fewer on an early checkout. */
  function handleTakeoutStarted() {
    if (activeBotLevel !== null) return;
    if (scoliaDartsRef.current > 0) {
      scoliaDartsRef.current = 0;
      confirm();
    }
  }

  function handleTakeoutFinished(payload: { falseTakeout: boolean }) {
    // If the "started" event never arrived, this is the confirmation instead. Before the bot
    // gate below is released, so advanceTurn's own setAwaitingTakeout(true) is overtaken by
    // the release in the same tick — the darts are demonstrably out.
    if (!payload.falseTakeout && activeBotLevel === null && scoliaDartsRef.current > 0) {
      scoliaDartsRef.current = 0;
      confirm();
    }
    // Released BEFORE the bot guard below, and that order is the whole point: by the time
    // your darts come out it is already the bot's turn, so a guard that bails on an active
    // bot would never clear the very gate it is waiting on. That deadlocked the match.
    if (!payload.falseTakeout) setAwaitingTakeout(false);
    if (activeBotLevel !== null) return;
    // The real signal the shot boxes/highlight are held for: darts are physically
    // out of the board now. A "false" takeout means nothing was actually pulled.
    if (!payload.falseTakeout) {
      clearTurnDisplay();
    }
  }

  const scolia = useScolia(scoliaEnabled, {
    // Ignored while a bot is active — a bot's turn has no physical darts to detect,
    // and gating this here (rather than toggling `enabled`) avoids tearing down and
    // re-establishing the realtime/polling connection on every turn switch.
    onThrow: (payload) => {
      if (activeBotLevel !== null) return;
      processDart(payload);
    },
    onTakeoutStarted: handleTakeoutStarted,
    onTakeoutFinished: handleTakeoutFinished,
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
    startGuestPlayers: Record<string, true> = {},
    startVariant: GameVariant = "standard"
  ) {
    // First, before anything reads a rule: the target, the active step and what a throw means
    // all come from here for the rest of the match.
    setGameVariant(startVariant);
    setVariant(startVariant);
    // Called synchronously from a real button tap (SetupScreen/tournament) — the
    // narrow window where the browser actually allows unlocking audio playback, well
    // before a win-fanfare or hit-streak sound needs to fire from a Scolia/Supabase
    // event later. See lib/fanfare.ts's primeAudio for why this matters.
    primeAudio();
    // Same dive as the win, as an intro. Doubles as an audio check you get for free: it plays
    // straight off the tap that unlocked the context, so if you hear the boom here the sound
    // is working for the rest of the match — including, on AirPlay, whether it went to the TV.
    playWinBoom();
    setIntroDiving(true);
    const prog: PlayerProgress = {};
    startPlayers.forEach((p) => (prog[p] = emptyProgress()));
    setPlayers(startPlayers);
    writeProgress(prog);
    setCurrentIdx(0);
    setCameraImages([]);
    writePendingHits([]);
    setHistory([]);
    setRewound(null);
    setRewoundTurnIndex(null);
    setWinner(null);
    setPlacements([]);
    setTurnLog({});
    setTurnCounters({});
    setTurnToken(0);
    setTurnShots(EMPTY_TURN_SHOTS);
    setHitPulse(null);
    setClosedStep(null);
    setMatchThrows({});
    accuracyTotalsRef.current = {};
    luckTotalsRef.current = {};
    setLuckLive({});
    preBankedRef.current = {};
    setPreBanked({});
    // Never reset before, so a row closed the hard way kept its ring-with-a-dot into the next match.
    writePerfectCloses({});
    writeTurnActions([]);
    turnStartRef.current = null;
    pendingReplayRef.current = null;
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
  //
  // Restarted by every dart, not just by the turn starting. Keyed to turnToken alone it fired
  // 20s into the turn no matter what, so a turn that took longer than that — walking to the
  // board, pulling the last player's darts — wiped the boxes with darts still to throw.
  useEffect(() => {
    const timer = setTimeout(clearTurnDisplay, TURN_DISPLAY_FALLBACK_MS);
    return () => clearTimeout(timer);
    // clearTurnDisplay is a fresh closure every render; listing it would restart this timer on
    // every one of them, which is the opposite of a 20-second fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnToken, dartsThisTurn]);

  // Auto-plays a bot's whole turn — three paced, simulated darts, each scored
  // through the exact same processDart path a real Scolia throw would use.
  // Re-runs whenever the active player or turn changes; the `cancelled` flag plus
  // the activePlayerRef/screenRef guards inside throwNext stop a stale chain the
  // instant the real turn moves on (see their own comments for why refs are
  // needed here rather than the closed-over `player`/`screen` values going stale).
  useEffect(() => {
    if (screen !== "game" || rewound || !activePlayer || !activeBotLevel) return;
    // A bot used to start throwing the instant a human confirmed, with their darts still in
    // the board. Wait for the takeout. Only ever set when Scolia is actually live, so manual
    // play — where that signal never comes — is not gated on something that will never arrive.
    if (awaitingTakeout) return;
    // Nothing about waiting for a takeout is worth a stalled match. If the signal never turns
    // up — a missed event, a relay hiccup, darts left in the board — the bot goes anyway.
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

      // Deferred by a tick, and that tick is load-bearing. processDart's state writes have not
      // been applied yet at this point, so resolving here ran against the board as it was
      // BEFORE the dart that just landed — and resolvePendingChoice writes pendingHits as a
      // whole list, not an append, so it quietly dropped that dart's records while its cross
      // stayed on the board. The turn log and the board then disagreed by one for the rest of
      // the match. A human never hit this: answering the dialog is a separate click, which is
      // already a later tick. Everything below reads refs that are current by then.
      setTimeout(() => {
        if (cancelled || activePlayerRef.current !== player) return;
        const pending = pendingAmbiguousRef.current;
        if (pending.length === 0) return;
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
      }, 0);

      if (!cancelled && scoliaDartsRef.current < DARTS_PER_TURN) {
        setTimeout(throwNext, BOT_THROW_DELAY_MS);
      }
    }

    const timer = setTimeout(throwNext, BOT_THROW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screen, activePlayer, turnToken, botLevels, rewound, activeBotLevel, awaitingTakeout]);

  /**
   * Registers `crosses` marks on `step` (crosses > 1 for a Scolia-detected inner bull).
   * Chains the prevCount->newCount sequence up front so multiple crosses from a single
   * dart stack correctly — calling registerHit(step) twice in a row would instead apply
   * the same prevCount->newCount delta twice, since `progress` in this closure doesn't
   * reflect the first call's setProgress until the next render.
   */
  /** Returns the HitRecord(s) this dart created, or null if nothing registered (also used by GameScreen's manual taps, which ignore the return value). */
  function registerHit(step: Step, crosses: number = 1, ownNumberRing = false): HitRecord[] | null {
    if (!activePlayer) return null;
    // The ref, not the state: a replayed turn registers several hits in one tick, and each has
    // to see the one before it.
    const playerProgress = progressRef.current[activePlayer];
    const activeStep = currentStepFor(playerProgress);
    if (!isRegistrable(step, activeStep, playerProgress)) return null;

    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const newPendingHits: HitRecord[] = chainCrosses(playerProgress[step], crosses).map((d) => ({
      player: activePlayer,
      step,
      prevCount: d.prevCount,
      newCount: d.newCount,
      turnIndex,
      ...(ownNumberRing ? { ownNumberRing: true as const } : {}),
    }));
    if (newPendingHits.length === 0) return null;
    // A double or triple banked while working on a number is a slenger — see preBanked. The
    // exception is a ring hit on the number itself that stays on the ring: that is the player's
    // own call (or the one-cross-left rule) and counts as a real attempt at the ring.
    if (isPreBank(step, activeStep) && !ownNumberRing) bumpPreBanked(activePlayer, step, newPendingHits.length);
    const count = newPendingHits[newPendingHits.length - 1].newCount;

    // Darts, not crosses — one call is one dart, however many crosses it carries. That
    // distinction is the whole rule: three separate darts on the same number close it "the
    // hard way", while a single triple closing it in one throw does not (see
    // isPerfectClose's marker in Mark.tsx). Counting HitRecords instead would make the two
    // indistinguishable, since a redirected triple also writes three of them.
    const dartsOnStep = (dartsOnStepRef.current[step] ?? 0) + 1;
    dartsOnStepRef.current[step] = dartsOnStep;
    // Three darts each worth one cross, ending on 3, can only have started from 0.
    if (dartsOnStep === 3 && count >= 3) markPerfectClose(activePlayer, step);

    if (!replayingRef.current) haptics.hit();
    writeProgress({
      ...progressRef.current,
      [activePlayer]: { ...progressRef.current[activePlayer], [step]: count },
    });
    writePendingHits([...pendingHitsRef.current, ...newPendingHits]);
    return newPendingHits;
  }

  /**
   * What the board's own taps go through. registerHit's second parameter is a cross count, so
   * handing the function itself to a click handler would let an event arrive as one — the same
   * shape of mistake that froze Bekreft (see finishTurn/confirm). Taking only the step here
   * makes that impossible however the prop is wired later.
   */
  function registerHitFromUi(step: Step) {
    ensureTurnStart();
    manualTapsRef.current += 1;
    registerHit(step);
    writeTurnActions([...turnActionsRef.current, { kind: "tap", step }]);
  }

  /**
   * Takes one cross off a specific row — the long-press on a cell.
   *
   * Angre only walks backwards in order, so correcting a misread first dart after the third
   * had landed meant undoing all three and re-entering the two that were right. This goes
   * straight at the row.
   *
   * Limited to THIS turn on purpose. A cross from an earlier turn lives in the turn log as
   * well as on the board, and removing it here would leave the two disagreeing — the exact
   * drift advanceTurn now reports. Rewinding into that turn with Angre is the path for those,
   * and it rewrites the log properly.
   */
  function removeHitFromUi(step: Step) {
    if (!activePlayer) return;
    ensureTurnStart();
    const records = pendingHitsRef.current;
    let idx = -1;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].player === activePlayer && records[i].step === step) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      reportError("Ingen kryss fra denne turen å ta av der. Bruk Angre for tidligere turer.", {
        key: "remove-hit-none",
      });
      return;
    }
    const removed = records[idx];
    writeProgress({
      ...progressRef.current,
      [activePlayer]: {
        ...progressRef.current[activePlayer],
        [step]: removeOneCross(progressRef.current[activePlayer][step]),
      },
    });
    writePendingHits(records.filter((_, i) => i !== idx));
    if (!removed.ownNumberRing && isPreBank(removed.step, currentStepFor({ ...progressRef.current[activePlayer], [removed.step]: removed.prevCount }))) {
      bumpPreBanked(activePlayer, removed.step, -1);
    }
    clearPerfectClose(activePlayer, step);
    // A choice attached to the dart that just went away has nothing left to decide.
    updatePendingAmbiguous(pendingAmbiguousRef.current.filter((p) => p.hitRecord !== removed));
    writeTurnActions([...turnActionsRef.current, { kind: "untap", step }]);
    if (!replayingRef.current) haptics.undo();
  }

  /** The board as it stands after one dart — processDart needs these by hand, because the
   *  state the same synchronous handler just set has not flushed yet. */
  type DartApplication = { hits: HitRecord[] | null; progress: PlayerProgress; pendingHits: HitRecord[] };

  function applyPlainHit(step: Step, crosses: number, ownNumberRing = false): DartApplication {
    const hits = registerHit(step, crosses, ownNumberRing);
    // registerHit writes both refs before it returns, so these are already the board and the
    // records as they stand after this dart — no reconstruction needed.
    return { hits, progress: progressRef.current, pendingHits: pendingHitsRef.current };
  }

  /**
   * Pays out the singles that were thrown away because their number was not active YET — the
   * rule is replayDiscardedSingles in lib/turnResolution.ts; this is its bookkeeping. Each dart
   * it re-reads was recorded as a miss when it landed: the shot box goes green, xH is re-judged
   * against the number it turns out to have been thrown at, and the dart counts toward closing
   * that row the hard way. `afterDartIndex` is undefined for a choice restored from a snapshot
   * saved before it was tracked, which means no replay rather than a guess.
   */
  function replayAfterRedirect(
    player: string,
    board: Progress,
    afterDartIndex: number | undefined,
    turnIndex: number,
  ): { board: Progress; records: HitRecord[]; pending: PendingAmbiguous[] } {
    if (afterDartIndex === undefined) return { board, records: [], pending: [] };
    const darts = turnDarts();
    const replay = replayDiscardedSingles(board, darts, afterDartIndex);
    if (replay.added.length === 0 && replay.reopened.length === 0) return { board, records: [], pending: [] };

    const records: HitRecord[] = replay.added.map((d) => ({
      player,
      step: d.step,
      prevCount: d.prevCount,
      newCount: d.newCount,
      turnIndex,
    }));

    // Doubles/triples on the number that just became active: their ring cross stays put, but
    // the player now gets the same question a D16 thrown on 16 would have asked.
    const active = currentStepFor(board);
    const pending: PendingAmbiguous[] = [];
    for (const r of replay.reopened) {
      const dart = darts.find((t) => t.dartIndex === r.dartIndex);
      const record = dart?.records.find((h) => h.step === r.ring);
      if (!active || !record || !pendingHitsRef.current.includes(record)) continue;
      pending.push({ key: ++pendingAmbiguousKeyRef.current, hitRecord: record, ringStep: r.ring, number: active, multiplier: r.multiplier, dartIndex: r.dartIndex });
    }

    for (const d of replay.added) {
      const dart = darts.find((t) => t.dartIndex === d.dartIndex);
      if (!dart) continue;
      dart.scored = true;
      setTurnShots((prev) => {
        if (!prev[d.dartIndex]) return prev;
        const next = prev.slice();
        next[d.dartIndex] = { ...prev[d.dartIndex]!, hit: true };
        return next;
      });
      dartsOnStepRef.current[d.step] = (dartsOnStepRef.current[d.step] ?? 0) + 1;
      if (dartsOnStepRef.current[d.step] === 3 && d.newCount >= 3) markPerfectClose(player, d.step);

      // It was judged as a miss at the old number; judge it again as what it was — a dart at
      // the number it hit, on the board as it stood right before it.
      rejudgeDart(player, dart, d.step, { ...replay.board, [d.step]: d.prevCount });
    }

    return { board: replay.board, records, pending };
  }

  /**
   * Replaces what xH made of a dart. Used when a dart turns out to have been a different attempt
   * than it was booked as at the time: a single on the number that only became active
   * afterwards, or a ring hit on the own number that the player redirects onto the number.
   */
  function rejudgeDart(player: string, dart: LiveDart, activeStep: Step, board: Progress) {
    const rejudged = luckForThrow(dart.coordinates, activeStep, board);
    const old = dart.luck;
    const luckByStep = luckTotalsRef.current[player] ?? emptyLuckByStep();
    const adjusted = { ...luckByStep };
    if (old) adjusted[old.step] = { sum: adjusted[old.step].sum - old.xg, count: adjusted[old.step].count - 1 };
    if (rejudged) {
      adjusted[rejudged.step] = { sum: adjusted[rejudged.step].sum + rejudged.xg, count: adjusted[rejudged.step].count + 1 };
    }
    luckTotalsRef.current = { ...luckTotalsRef.current, [player]: adjusted };
    setLuckLive((prev) => {
      const running = prev[player] ?? { sum: 0, count: 0 };
      return {
        ...prev,
        [player]: {
          sum: running.sum - (old?.xg ?? 0) + (rejudged?.xg ?? 0),
          count: running.count - (old ? 1 : 0) + (rejudged ? 1 : 0),
        },
      };
    });
    dart.luck = rejudged;
  }

  /**
   * Snapshots where this turn starts from, the first time anything happens in it. Everything
   * Angre and editDart do is "back to here, then play the actions again" — see rewindTurn.
   */
  function ensureTurnStart() {
    if (!activePlayer || turnActionsRef.current.length > 0) return;
    turnStartRef.current = {
      player: activePlayer,
      progress: progressRef.current[activePlayer],
      pendingHits: pendingHitsRef.current,
      preBanked: preBankedRef.current,
      luckTotals: luckTotalsRef.current,
      accuracyTotals: accuracyTotalsRef.current,
      ringHits: ringHitsRef.current,
      dartsOnStep: { ...dartsOnStepRef.current },
      perfectCloses: { ...(perfectClosesRef.current[activePlayer] ?? {}) },
      manualTaps: manualTapsRef.current,
    };
  }

  /**
   * Puts the board and every running total back to where this turn started, and empties the
   * turn: no darts counted, no shot boxes, no open choice. The caller then replays whatever
   * part of the turn should stand. Returns false if there is nothing to rewind to.
   *
   * Angre used to take one cross off the board and nothing else. A dart the board had invented
   * kept its place in the dart count, its shot box, its xH and its spot on the heatmap — so the
   * turn ended after two real darts and the third landed on the opponent. Rebuilding the turn
   * from its start is the only way every one of those stays in step, and it means a bounce-out
   * the board made up can be undone too, which no cross-based undo could offer.
   */
  function rewindTurn(): boolean {
    const start = turnStartRef.current;
    if (!start || !activePlayer || start.player !== activePlayer) return false;
    const player = start.player;
    const dartCount = turnDarts().length;

    writeProgress({ ...progressRef.current, [player]: start.progress });
    writePendingHits(start.pendingHits);
    preBankedRef.current = start.preBanked;
    setPreBanked(start.preBanked);
    luckTotalsRef.current = start.luckTotals;
    setLuckLive(
      Object.fromEntries(
        Object.entries(start.luckTotals).map(([p, byStep]) => [
          p,
          Object.values(byStep).reduce((acc, s) => ({ sum: acc.sum + s.sum, count: acc.count + s.count }), { sum: 0, count: 0 }),
        ]),
      ),
    );
    accuracyTotalsRef.current = start.accuracyTotals;
    ringHitsRef.current = start.ringHits;
    if (dartCount > 0) {
      setMatchThrows((prev) => ({ ...prev, [player]: (prev[player] ?? []).slice(0, Math.max(0, (prev[player] ?? []).length - dartCount)) }));
    }
    dartsOnStepRef.current = { ...start.dartsOnStep };
    writePerfectCloses({ ...perfectClosesRef.current, [player]: start.perfectCloses });
    manualTapsRef.current = start.manualTaps;
    hitStreakRef.current = 0;
    activeTriplesRef.current = 0;
    updatePendingAmbiguous([]);
    updateAwaitingConfirmResolution(false);
    scoliaDartsRef.current = 0;
    clearTurnDisplay();
    writeTurnActions([]);
    return true;
  }

  /** Plays actions back through the same paths they first took, minus the noise. */
  function replayActions(actions: readonly TurnAction[]) {
    replayingRef.current = true;
    try {
      for (const a of actions) {
        if (a.kind === "dart") processDart({ sector: a.sector, bounceout: a.bounceout, coordinates: a.coordinates });
        else if (a.kind === "tap") registerHitFromUi(a.step);
        else removeHitFromUi(a.step);
      }
    } finally {
      replayingRef.current = false;
    }
  }

  /**
   * "That first dart was not a 5, it was T20": swaps one dart of the turn for what it actually
   * was and rebuilds the turn around it — the crosses, the choice it may now pose, the dart
   * count, the shot box, xH. The corrected dart gets the middle of its bed as its coordinate.
   */
  function editDart(dartIndex: number, sector: string) {
    const actions = turnActionsRef.current.map((a) =>
      a.kind === "dart" && a.dartIndex === dartIndex
        ? { ...a, sector, bounceout: sector === "None", coordinates: coordinatesForSector(sector) }
        : a,
    );
    if (!rewindTurn()) return;
    haptics.undo();
    replayActions(actions);
  }

  /**
   * Moves a parked, undecided triple/double off its ring so this dart can score there, then
   * registers this dart — see ambiguousBlockingRing in lib/game.ts for why that trade is free.
   *
   * Written as plain locals and set once, the same way resolvePendingChoice does it: this all
   * happens inside one handler, where `progress` still describes the board before the dart.
   */
  function freeRingAndRegister(parked: PendingAmbiguous, step: Step, crosses: number): DartApplication {
    if (!activePlayer) return { hits: null, progress: progressRef.current, pendingHits: pendingHitsRef.current };
    const player = activePlayer;
    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[player] ?? 0;
    // The rule itself lives in lib/turnResolution.ts — un-parking, the redirect and this
    // dart's own crosses, in order. All that is left here is turning them into records and
    // getting them into state.
    const { board, added } = applyDartToBoard(progressRef.current[player], step, crosses, parked);
    const records: HitRecord[] = added.map((d) => ({
      player,
      step: d.step,
      prevCount: d.prevCount,
      newCount: d.newCount,
      turnIndex,
    }));
    const kept = pendingHitsRef.current.filter((h) => h !== parked.hitRecord);
    // This dart's own crosses, as distinct from the parked one's payout — the caller uses these
    // for the streak sound and the closing slam, which belong to the throw that just happened.
    const hits = records.filter((r) => r.step === step);
    // The parked dart moves onto its number: un-bank it if it was a pre-banked slenger (a
    // reopened one — see replayAfterRedirect), and re-judge it as the attempt at the number it
    // now is. This dart's own ring crosses take its place on the ring, as a slenger.
    if (!parked.hitRecord.ownNumberRing) bumpPreBanked(player, parked.ringStep, -1);
    const parkedDart = parked.dartIndex === undefined ? undefined : turnDarts().find((t) => t.dartIndex === parked.dartIndex);
    if (parkedDart) rejudgeDart(player, parkedDart, parked.number, progressRef.current[player]);
    const activeBefore = currentStepFor(progressRef.current[player]);
    if (isPreBank(step, activeBefore)) bumpPreBanked(player, step, hits.length);

    // Darts, not crosses — same counting rule as registerHit, and the same marker: three
    // separate darts closing a row the hard way earns the ring-with-a-dot. This dart lands on
    // the ring like any other, so it counts toward that too.
    const dartsOnStep = (dartsOnStepRef.current[step] ?? 0) + 1;
    dartsOnStepRef.current[step] = dartsOnStep;
    if (dartsOnStep === 3 && board[step] >= 3) markPerfectClose(player, step);

    // Un-parking redirected the parked dart onto its number; if that filled it, the darts thrown
    // between it and this one may have been singles on the number that just became active.
    const replay = replayAfterRedirect(player, board, parked.dartIndex, turnIndex);
    const nextProgress = { ...progressRef.current, [player]: replay.board };
    const nextPending = [...kept, ...records, ...replay.records];
    writeProgress(nextProgress);
    writePendingHits(nextPending);
    updatePendingAmbiguous([...pendingAmbiguousRef.current.filter((p) => p.key !== parked.key), ...replay.pending]);
    if (records.length > 0 && !replayingRef.current) haptics.hit();
    return { hits: hits.length > 0 ? hits : null, progress: nextProgress, pendingHits: nextPending };
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

    let finalProgress = progressRef.current;
    let finalPendingHits = pendingHitsRef.current;
    // Ring darts on the number this redirect may have just opened — see replayAfterRedirect.
    let reopened: PendingAmbiguous[] = [];

    // Same guard as processDart's: a redirect rolls a cross back off the board, which is only
    // ever correct while that cross is still this turn's to move.
    if (choice === "redirect" && pendingHitsRef.current.includes(item.hitRecord)) {
      // One cross off, not a restore of item.hitRecord.prevCount — see removeOneCross.
      const rolledBack = {
        ...progressRef.current[activePlayer],
        [item.ringStep]: removeOneCross(progressRef.current[activePlayer][item.ringStep]),
      };
      finalPendingHits = pendingHitsRef.current.filter((h) => h !== item.hitRecord);
      // Off the ring and onto the number. A reopened slenger (see replayAfterRedirect) was
      // pre-banked and now isn't; a ring hit on the own number never was. Either way the dart
      // is now an attempt at the number, and xH re-judges it as such.
      if (!item.hitRecord.ownNumberRing) bumpPreBanked(activePlayer, item.ringStep, -1);
      const redirectedDart = item.dartIndex === undefined ? undefined : turnDarts().find((t) => t.dartIndex === item.dartIndex);
      if (redirectedDart) rejudgeDart(activePlayer, redirectedDart, item.number, rolledBack);

      // chainCrosses rather than registerHit: registerHit reads `progress` from this
      // component's state and would miss the rollback above until the next render.
      const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
      const newHits: HitRecord[] = chainCrosses(rolledBack[item.number], item.multiplier).map((d) => ({
        player: activePlayer,
        step: item.number,
        prevCount: d.prevCount,
        newCount: d.newCount,
        turnIndex,
      }));
      const count = newHits.length > 0 ? newHits[newHits.length - 1].newCount : rolledBack[item.number];
      // If that filled the number, the darts thrown after the parked one were aimed at a number
      // that is now, retroactively, the active one — see replayAfterRedirect.
      const replay = replayAfterRedirect(activePlayer, { ...rolledBack, [item.number]: count }, item.dartIndex, turnIndex);
      finalProgress = { ...progressRef.current, [activePlayer]: replay.board };
      finalPendingHits = [...finalPendingHits, ...newHits, ...replay.records];
      reopened = replay.pending;

      haptics.hit();
      writeProgress(finalProgress);
      writePendingHits(finalPendingHits);
    }

    // Filtered against finalProgress, not `progress` — this same choice may have just
    // filled the number, which is exactly what makes a sibling choice on that number moot
    // (see meaningfulPending), and the state won't reflect it until the next render.
    const remaining = meaningfulPending(
      [...pendingAmbiguousRef.current.filter((p) => p.key !== item.key), ...reopened],
      finalProgress[activePlayer]
    );
    updatePendingAmbiguous(remaining);

    if (remaining.length === 0 && awaitingConfirmResolutionRef.current) {
      updateAwaitingConfirmResolution(false);
      // Asked by the third dart rather than by Bekreft/takeout (which zero the dart counter
      // before asking): the turn stays open for the takeout to confirm, so the answer can still
      // be undone or a box corrected. The board and records were written above already.
      if (scoliaDartsRef.current >= DARTS_PER_TURN) return;
      advanceTurn(finalProgress, finalPendingHits);
    }
  }

  function undo() {
    haptics.undo();
    // This turn: the last ACTION goes — a whole dart with everything it brought, or a tap. See
    // rewindTurn for why it is rebuilt from the start rather than patched.
    if (turnActionsRef.current.length > 0) {
      const actions = turnActionsRef.current;
      if (rewindTurn()) {
        replayActions(actions.slice(0, -1));
        return;
      }
    }
    // Any held "just placed" highlight can go stale the instant progress is rewound
    // (most obviously on a second, cascading undo) — simplest correct move is to
    // always drop it here rather than try to reconcile it with the rollback below.
    // Cross-based fallback for records without a turn behind them (a snapshot from before
    // turns were recorded).
    if (pendingHitsRef.current.length > 0) {
      const last = pendingHitsRef.current[pendingHitsRef.current.length - 1];
      // prevCount is right here, unlike in the redirect path: this is the most recent record,
      // so by definition nothing has touched the step since it was written.
      writeProgress({
        ...progressRef.current,
        [last.player]: { ...progressRef.current[last.player], [last.step]: last.prevCount },
      });
      writePendingHits(pendingHitsRef.current.slice(0, -1));
      // Was this record a slenger when it was banked? Judged against the board as it stood
      // before it — a D/T cross made while some number was active, and not on that number.
      if (!last.ownNumberRing && isPreBank(last.step, currentStepFor({ ...progressRef.current[last.player], [last.step]: last.prevCount }))) {
        bumpPreBanked(last.player, last.step, -1);
      }
      clearPerfectClose(last.player, last.step);
      // If the undone dart was still awaiting a T/D-or-number choice, that choice is moot now.
      updatePendingAmbiguous((prev) => prev.filter((p) => p.hitRecord !== last));
      return;
    }
    if (history.length > 0) {
      const last = history[history.length - 1];
      writeProgress({
        ...progressRef.current,
        [last.player]: { ...progressRef.current[last.player], [last.step]: last.prevCount },
      });
      setHistory((prev) => prev.slice(0, -1));
      clearPerfectClose(last.player, last.step);
      if (!last.ownNumberRing && isPreBank(last.step, currentStepFor({ ...progressRef.current[last.player], [last.step]: last.prevCount }))) {
        bumpPreBanked(last.player, last.step, -1);
      }
      setRewound(last.player);
      setRewoundTurnIndex(last.turnIndex);
    }
  }

  /** Computes what the winner screen shows. Writing any of it to the players' career records is
   *  persistMatchResults' job, and happens later — see flushMatchResults. */
  function finalizeMatch(finalTurnLog: Record<string, TurnResult[]>) {
    const stats: Record<string, TurnAggregate> = {};
    // Bots included. They have real coordinates, and xH asks a question the coordinates can
    // answer on their own: given where this dart landed, how many crosses was that worth?
    // Nothing in it depends on a human having thrown it. Leaving them out only removed the
    // comparison that makes the number interesting in the first place — yours against theirs.
    // (An earlier note here argued they'd "look like a bug"; that was written when this
    // rendered as a signed delta, "+12.4", rather than today's forventet/faktisk.)
    //
    // Career stats are a different matter and stay bot-free — see the guard in the loop below,
    // which is independent of this and is what actually keeps Supabase clean.
    //
    // Broken down per section (see lib/dartboard.ts's luckForThrow) as a running
    // SUM, not a mean — a sum is what's directly comparable to the actual crosses
    // landed (an xG-style "forventet vs faktisk" read), which a per-dart average
    // can't give you.
    const luckByPlayer: Record<string, Record<Step, { sum: number; count: number }>> = {};
    players.forEach((p) => {
      const luckByStep = luckTotalsRef.current[p];
      const perStep = {} as Record<Step, { sum: number; count: number }>;
      STEPS.forEach((step) => {
        const totals = luckByStep?.[step];
        perStep[step] = { sum: totals?.sum ?? 0, count: totals?.count ?? 0 };
      });
      luckByPlayer[p] = perStep;
    });
    players.forEach((p) => {
      stats[p] = aggregateTurns(finalTurnLog[p] ?? []);
    });
    return { stats, luckByPlayer };
  }

  /**
   * Writes the match into the players' career records. Split out from finalizeMatch and held
   * back until the win is ACCEPTED — see flushMatchResults.
   */
  function persistMatchResults(finalTurnLog: Record<string, TurnResult[]>, winnerName: string | null) {
    // 1 treff is a different game; its matches stay out of the career records entirely.
    if (!getRules().countsForStats) return;
    players.forEach((p) => {
      const aggregate = aggregateTurns(finalTurnLog[p] ?? []);
      // A bot's darts aren't real play — never let them land in a human player's career stats
      // (bots are never ensurePlayer'd into the roster to begin with), a team's name has no
      // individual Supabase player record either, and a guest was never ensurePlayer'd either
      // (see SetupScreen's addPlayer) — so results only ever count for a real, saved individual.
      if (botLevels[p] || teamRosters[p] || guestPlayers[p]) return;
      const dartsUsed = aggregate.darts;
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
  }

  /**
   * Career stats are written when the win is accepted, not when it is detected.
   *
   * The winner screen has an Angre for a misread bounce-out, and writing on detection made that
   * button a half-truth: the match was already in the records, and winning again added a second
   * one. "Accepted" means leaving the winner screen — or leaving the app while it is up, which
   * the pagehide listener below covers, so a real win is never lost to a closed tab.
   *
   * Idempotent: whichever of those happens first clears the pending result.
   */
  function flushMatchResults() {
    const pending = pendingResultRef.current;
    if (!pending) return;
    pendingResultRef.current = null;
    persistMatchResults(pending.turnLog, pending.winnerName);
  }

  // Leaving the app counts as accepting the win. `pagehide` rather than `beforeunload`: iOS
  // Safari doesn't fire the latter, and backgrounding the tab is how a match on a phone
  // usually ends. Registered for the component's whole life so it can't miss the window.
  useEffect(() => {
    const flush = () => flushMatchResultsRef.current();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  /**
   * The overrides exist for one caller: the auto-confirm fired by a turn's third dart, from
   * inside the very handler that registered it. At that moment `progress`/`pendingHits`
   * state has not flushed, so without them the turn gets summarised without its last dart.
   * Every other caller (the Bekreft button, a takeout, the bot's own loop) runs a tick or
   * more later, with state settled, and passes nothing.
   *
   * Never hand this to an event handler directly — see `confirm` below.
   */
  function finishTurn(progressOverride?: PlayerProgress, pendingHitsOverride?: HitRecord[], dartsOverride?: number) {
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
    advanceTurn(progressOverride, pendingHitsOverride, dartsOverride);
  }

  /**
   * What every UI path and ref uses. Takes no arguments on purpose: GameScreen wires the
   * Bekreft button up as `onClick={onConfirm}`, so React hands the click event to whatever
   * sits here as the first argument. When that was finishTurn itself, the event arrived as
   * `progressOverride` and the turn was summarised against a MouseEvent instead of the
   * board — `effectiveProgress[activePlayer]` was undefined and Bekreft threw. TypeScript
   * can't catch it: a `() => void` prop happily accepts a function with optional parameters.
   */
  function confirm() {
    finishTurn();
  }

  /**
   * `progressOverride`/`pendingHitsOverride` let resolvePendingChoice hand in
   * values it just computed locally, for the one case (a redirect that was the
   * last undecided choice) where this needs to see a change from the very same
   * event that's calling it, before that change has made it back through a
   * render — reading `progress`/`pendingHits` here directly would still be the
   * pre-redirect snapshot at that point.
   */
  function advanceTurn(progressOverride?: PlayerProgress, pendingHitsOverride?: HitRecord[], dartsOverride?: number) {
    if (!activePlayer) return;
    dartsOnStepRef.current = {};
    writeTurnActions([]);
    turnStartRef.current = null;
    // Read before it is cleared for the next turn — the dart count below still needs it.
    const manualTapsThisTurn = manualTapsRef.current;
    manualTapsRef.current = 0;
    const effectiveProgress = progressOverride ?? progress;
    const effectivePendingHits = pendingHitsOverride ?? pendingHits;
    const activeStepNow = currentStepFor(effectiveProgress[activePlayer]);
    // Scolia fills turnShots per dart, so counting them gives the real length of the turn.
    //
    // Manual play has no such signal, and a turn is three darts by house rule — a player who
    // throws three and taps one mark did throw three. The one exception is the turn that wins
    // the leg: it demonstrably ended early, and billing three there is the case this exists to
    // fix. Their taps are the closest thing to a dart count we have, so that is what it uses,
    // with the honest caveat that it under-counts a winning turn that opened with misses.
    const finishedNow = isFinished(effectiveProgress[activePlayer]);
    const scoliaDarts = turnShots.filter(Boolean).length;
    const dartsForTurn =
      dartsOverride ?? (scoliaDarts || (finishedNow ? Math.max(1, manualTapsThisTurn) : DARTS_PER_TURN));
    const turn = summarizeTurn(effectivePendingHits, activeStepNow, dartsForTurn);
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
      writePendingHits([]);
    }

    // The board and the log are now both settled for this turn — check they agree. Reported
    // once per match so a real drift is visible without turning into a stream of toasts, and
    // the numbers go in the message: which row, and which way it went.
    if (!mismatchReportedRef.current) {
      const drift = progressLogMismatch(effectiveProgress[activePlayer], nextTurnLog[activePlayer] ?? [], []);
      if (drift.length > 0) {
        mismatchReportedRef.current = true;
        reportError(
          `Statistikken kom i utakt med brettet (${drift.map((d) => `${d.step}: brett ${d.board}, logg ${d.log}`).join(", ")}). Spillet er riktig, tallene kan være det ikke.`,
          { key: "progress-log-drift" },
        );
      }
    }

    // A parked triple/double belongs to the turn it was thrown in. Confirming the turn settles
    // it — the cross stays where it landed, which is the "keep" outcome. Nothing cleared this
    // before, so a leftover could still be found by a LATER turn and un-parked: its cross came
    // off the board while its HitRecord sat safely in history, and the turn log and the board
    // drifted apart by one. A bot-vs-bot match reproduced it within five turns.
    updatePendingAmbiguous([]);

    // A bot never pulls its darts, so the takeout signal the shot boxes normally wait for never
    // comes — its turn ending is the equivalent moment. But not this instant: the third dart
    // registers and finishes the turn inside one tick, so clearing here wiped that dart's shot
    // box and its hitPulse before either had been drawn. The bot's last throw simply vanished,
    // boom and all. Held for a beat instead, and cancelled the moment a new dart arrives.
    if (activeBotLevel !== null) scheduleBotDisplayClear();

    // A human just finished, with three darts still in the board. Any bot that is up next
    // holds until they are pulled — a bot firing off its whole turn while you are still
    // walking to the board is the opposite of how the game is played.
    //
    // Only when the BOARD is ready, not merely when the relay is answering. Those are not the
    // same thing — the relay can be live while the board is offline, which is exactly the state
    // the status badge reads as "Scolia: Offline". Gating on the relay meant waiting for a
    // takeout from a board that wasn't there, and the bot just sat still.
    if (activeBotLevel === null && scoliaEnabled && scolia.state.boardStatus === "Ready") {
      setAwaitingTakeout(true);
      // Released by the takeout signal, or by this, whichever comes first — a missed event
      // must never be able to leave a bot sitting there doing nothing.
      if (takeoutWaitTimerRef.current) clearTimeout(takeoutWaitTimerRef.current);
      takeoutWaitTimerRef.current = setTimeout(() => setAwaitingTakeout(false), TAKEOUT_WAIT_MAX_MS);
    }

    if (isFinished(effectiveProgress[activePlayer])) {
      haptics.win();
      // The boom lands now, on the frame the board slams into the dive; the fanfare waits for
      // the winner screen to burst out of the bull, so the two read as impact then announcement.
      playWinBoom();
      setDiving(true);
      // Reaching the winner screen must never depend on stats persistence succeeding —
      // see abortGame's identical guard for why.
      let stats: Record<string, TurnAggregate> = {};
      let luckByPlayer: Record<string, Record<Step, { sum: number; count: number }>> = {};
      try {
        ({ stats, luckByPlayer } = finalizeMatch(nextTurnLog));
        // Held, not written. flushMatchResults decides when — see there.
        pendingResultRef.current = { turnLog: nextTurnLog, winnerName: activePlayer };
      } catch (err) {
        console.error("Klarte ikke å regne ut kampstatistikken:", err);
        reportError("Kunne ikke regne ut kampresultatet.", { key: "finalize-match" });
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
    flushMatchResults();
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
    startGame(players, botLevels, teamRosters, guestPlayers, variant);
    flushMatchResults();
  }

  /**
   * "That wasn't in." Puts the match back on the board with the winning dart taken off.
   *
   * Reuses undo, so it lands in the same rewind mode a mis-scored turn always does — the leg
   * carries on and the turn can be re-entered correctly. Note what it can't take back: the
   * match result was written to the career stats the moment the win was detected, and winning
   * again records a second one. Moving that write to when the win is actually accepted is the
   * real fix and is a change of its own.
   */
  function undoWin() {
    setDiving(false);
    setScreen("game");
    // The whole point of the button: the win was never accepted, so it is never recorded.
    pendingResultRef.current = null;
    setWinner(null);
    setWinnerStats({});
    setWinnerLuck({});
    setPlacements([]);
    undo();
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
    // The dive plays first and hands over when it lands in the bull. Not rendered at all on a
    // restored match: reloading into a finished match should show the result, not replay the
    // celebration for a win that happened before the page existed.
    if (diving) {
      return (
        <WinDive
          onDone={() => {
            setDiving(false);
            playFanfare();
          }}
        />
      );
    }
    return (
      <WinnerScreen
        winner={winner}
        players={players}
        stats={winnerStats}
        luckByPlayer={winnerLuck}
        preBankedByPlayer={preBanked}
        throwsByPlayer={matchThrows}
        onHome={playAgain}
        homeLabel={onMatchComplete ? "Til turnering" : "Hjem"}
        onPlayAgain={onMatchComplete ? undefined : rematch}
        onUndoWin={history.length > 0 ? undoWin : undefined}
      />
    );
  }

  // Summed from the turns actually played rather than turns x 3 — a leg-winning or
  // taken-out turn is shorter, and now says so.
  const dartsThrown: Record<string, number> = {};
  players.forEach((p) => {
    dartsThrown[p] = aggregateTurns(turnLog[p] ?? []).darts;
  });

  const pendingByStep: Partial<Record<Step, number>> = {};
  pendingHits.forEach((h) => {
    pendingByStep[h.step] = (pendingByStep[h.step] ?? 0) + 1;
  });

  // Feeds the landscape side panel. Treff% is over COMPLETED turns only — the turn in progress
  // has no miss count until it is confirmed, so folding it in would read as a dip after every
  // first dart and recover by the third.
  const activeThrows = activePlayer ? matchThrows[activePlayer] ?? [] : [];
  const liveStats = (() => {
    if (!activePlayer) return null;
    const totals = aggregateTurns(turnLog[activePlayer] ?? []);
    const darts = totals.hits + totals.misses;
    const thrown = (turnCounters[activePlayer] ?? 0) * DARTS_PER_TURN + dartsThisTurn;
    const luck = luckLive[activePlayer];
    // Bots included here too, for the same reason as finalizeMatch: the coordinates are real
    // and the question xH asks is about the coordinates, not about who produced them.
    const judged = luck && luck.count > 0 ? luck : null;
    return {
      hitPct: darts > 0 ? Math.round((totals.hits / darts) * 100) : null,
      expected: judged ? judged.sum : null,
      // Only shown against a "faktisk" when every dart this match was judged. xH covers only
      // the darts Scolia gave coordinates for, so in mixed manual play the ratio would put an
      // expectation for some of the darts up against the crosses from all of them.
      actual:
        judged && judged.count === thrown && progress[activePlayer]
          // Crosses won while on the row they sit in — slengere on D/T are luck, not attempts.
        ? totalMarks() - remainingMarks(progress[activePlayer]) - (preBanked[activePlayer]?.D ?? 0) - (preBanked[activePlayer]?.T ?? 0)
          : null,
    };
  })();

  // The intro. Covers the board while it plays, then hands over to the game underneath —
  // the same component as the win, so the two moments are unmistakably the same gesture.
  if (introDiving) {
    return <WinDive onDone={() => setIntroDiving(false)} />;
  }

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
        matchThrows={activeThrows}
        dartsThisTurn={dartsThisTurn}
        liveStats={liveStats}
        scolia={scoliaEnabled ? summarizeScolia(scolia.state) : null}
        pendingByStep={pendingByStep}
        turnShots={rewound === null ? turnShots : EMPTY_TURN_SHOTS}
        rewound={rewound !== null}
        pendingCount={pendingHits.length}
        canUndo={turnActionCount > 0 || pendingHits.length > 0 || history.length > 0}
        shotsEditable={turnActionCount > 0 && !botIsThrowing}
        onEditShot={editDart}
        awaitingTakeoutToConfirm={turnActionCount > 0 && dartsThisTurn >= DARTS_PER_TURN && !awaitingConfirmResolution}
        pendingChoice={rewound === null ? pendingAmbiguous[pendingAmbiguous.length - 1] ?? null : null}
        pendingChoices={rewound === null ? pendingAmbiguous : []}
        awaitingConfirmResolution={awaitingConfirmResolution}
        hitPulse={hitPulse}
        closedStep={closedStep}
        perfectCloses={perfectCloses}
        onResolvePendingChoice={resolvePendingChoice}
        onRegisterHit={botIsThrowing ? () => {} : registerHitFromUi}
        onRemoveHit={botIsThrowing ? () => {} : removeHitFromUi}
        onUndo={botIsThrowing ? () => {} : undo}
        onConfirm={botIsThrowing ? () => {} : confirm}
        onAbort={abortGame}
      />
      {tripleCelebration && <TripleCelebration images={cameraImages} onDismiss={() => setTripleCelebration(false)} />}
    </>
  );
}
