"use client";

import { botDelayMs } from "@/lib/botSpeed";
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
import { memberDeltas } from "@/lib/memberStats";
import { finishState } from "@/lib/finishState";
import { computeOddsOffThread } from "@/lib/odds/client";
import { saveMatchArchive } from "@/lib/matchArchive";
import type { OddsMatch } from "@/lib/odds/match";
import { fairPrice } from "@/lib/bet/ledger";
import { groupBestWin } from "@/lib/bestWin";
import { chaseFraction, recordChase } from "@/lib/recordChase";
import { rowCosts } from "@/lib/rowCosts";
import { recordBestRun, ensureTeam, getPlayerRecord, playPlayerSound, recordAccuracyTotals, recordLuckTotals, recordMatchHistory, recordMatchResult, recordMemberStats, recordRating, recordRingHits, useRoster, useTeamRecords, meanEuclideanDistance, averagePct, type RingHits } from "@/lib/storage";
import { announce } from "@/lib/announcer";
import { reportError } from "@/lib/errorReporting";
import { clearActiveMatch, loadActiveMatch, saveActiveMatch } from "@/lib/activeMatch";
import { publishLiveMatch } from "@/lib/liveMatch";
import { addAimOffset, aimOffset, coordinatesForSector, luckForThrow, sectorAt, throwAccuracy } from "@/lib/dartboard";
import type { AimBias } from "@/lib/playerRows";
import { getRules, hasStandRule, isPerfectClose, setGameVariant, withStandRule, type GameVariant } from "@/lib/rules";
import { countingDarts, nextMemberIndex, standsAfterTurn, trailingRun } from "@/lib/teamTurn";
import { currentRun, longestRun, throwerStats } from "@/lib/turnStats";
import { emitFx } from "@/lib/fxBus";
import { FxStage } from "./FxStage";
import { LineupIntro } from "./LineupIntro";
import type { OddsRow } from "./OddsBar";
import { logOddsMatch, type OddsSnapshot } from "@/lib/oddsLog";
import { useShowOdds } from "@/lib/oddsSetting";
import { haptics } from "@/lib/haptics";
import { uiSound, winCheer } from "@/lib/uiSound";
import type { VenueId } from "@/lib/venues";
import { crowdForStreak, playCrowd, playHitStreakSound, playStreakFanfare, playMatchDartSound, playTapSound, playWalkOnTune, playWinBoom, primeAudio, warmAudio } from "@/lib/fanfare";
import { fxFlags, getFxLevel, useFxLevel } from "@/lib/fxLevel";
import { ChalkboardScreen } from "./ChalkboardScreen";
import { classifyThrow, formatSectorLabel, parseSector } from "@/lib/scoliaMapping";
import {
  applyDartToBoard,
  impliedRedirects,
  replayDiscardedSingles,
  type DartAction,
  type TapAction,
  type TurnAction,
  type TurnStart,
} from "@/lib/turnResolution";

/** A dart in the running turn, with what the component needs on top of the serialisable action:
 *  the records it created (for re-parking a ring dart — see replayAfterRedirect) and what xH made
 *  of it (to take back if it turns out to have been aimed elsewhere). */
type LiveDart = DartAction & {
  luck: { step: Step; xg: number } | null;
  records: HitRecord[];
  /** The row being worked when the dart was thrown (the one it counts against in «forsøk per rad»). Absent on a dart restored without it. */
  atStep?: Step | null;
};
type LiveAction = LiveDart | TapAction;

/**
 * Darts used per row for «forsøk per rad»: each dart counts once, against the row it was thrown at. A dart that stayed on
 * a double or triple while a number was being worked (a slenger) counts against that ring's row, not the number's — three
 * slengere on D are three darts spent on D — and a triple that closes a row is one dart, not three. Left out entirely
 * when any dart lacks its row.
 */
function dartsByRow(
  darts: LiveDart[],
  pending: HitRecord[],
): { dartsByStep: Partial<Record<Step, number>>; missesByStep: Partial<Record<Step, number>> } | Record<string, never> {
  const out: Partial<Record<Step, number>> = {};
  // Scolia sees every dart, so a miss belongs to the row that was being worked when it was thrown — not to wherever the
  // turn's last hit happened to land.
  const missed: Partial<Record<Step, number>> = {};
  for (const d of darts) {
    if (d.atStep === undefined) return {};
    if (d.atStep === null) continue;
    if (!d.scored) missed[d.atStep] = (missed[d.atStep] ?? 0) + 1;
    const kept = d.records.filter((r) => pending.includes(r));
    const onlyRing = kept.length > 0 && kept.every((r) => r.step === "D" || r.step === "T");
    // A dart that stayed on the ring is an attempt at THAT ring, whichever number was active: three slengere on D are three
    // darts spent filling D. It costs the number nothing.
    const row = onlyRing && !kept.some((r) => r.step === d.atStep) ? kept[0].step : d.atStep;
    out[row] = (out[row] ?? 0) + 1;
  }
  return { dartsByStep: out, missesByStep: missed };
}
import { botChooseThrow, botDecideRedirect, solverFor } from "@/lib/botStrategy";
import { type BotLevel, type TeamMember } from "@/lib/botLevels";
import { useScolia } from "@/lib/useScolia";
import { requestRecalibration } from "@/lib/scoliaCommands";
import { extractImageUrls } from "@/lib/extractImageUrls";
import { SetupScreen } from "./SetupScreen";
import { GameScreen } from "./GameScreen";
import { WinnerScreen } from "./WinnerScreen";
import { WinDive } from "./WinDive";
import { ScoliaStatusBadge, summarizeScolia } from "./ScoliaStatusBadge";
import { TripleCelebration } from "./TripleCelebration";
import { CameraImages } from "./CameraImages";
import type { Thrower, ThrowerTeam } from "./ThrowerBar";
import { assignKits, type Kit } from "@/lib/teamKit";
import { hasSeenRulesIntro } from "@/lib/rulesIntro";
import { RulesIntro } from "./RulesIntro";

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
  onMatchComplete?: (result: { winner: string; placements: string[]; stats: Record<string, TurnAggregate>; /** Crosses each player was still missing when it ended: what the placements were made from, and what a tie is told by. */ remaining?: Record<string, number> }) => void;
  /** Bails all the way back to the true home screen (AppRoot) — wired into SetupScreen's "← Hjem"
   *  and into aborting a tournament match (which would otherwise strand the player on the generic,
   *  disconnected SetupScreen instead of back where they actually came from). */
  onExitToHome?: () => void;
};

const RESULT_WRITTEN_KEY = "mikke-mus-result-written";
/** Whether this match's result has been written to the records already (kept on this device, which is where it is written from). */
function resultWritten(matchId: string): boolean {
  try {
    return !!matchId && localStorage.getItem(RESULT_WRITTEN_KEY) === matchId;
  } catch {
    return false;
  }
}
function markResultWritten(matchId: string): void {
  try {
    localStorage.setItem(RESULT_WRITTEN_KEY, matchId);
  } catch {
    // Without it a reload on the winner screen can write once more; nothing else is lost.
  }
}

export function MikkeMusApp({ initialPlayers, initialBotLevels, initialTeamRosters, initialVariant, onMatchComplete, onExitToHome }: MikkeMusAppProps = {}) {
  const [screen, setScreen] = useState<Screen>("setup");
  // How much happens on screen — see lib/fxLevel.ts. Read as a React value here for what the
  // render decides; the handlers read getFxLevel() fresh instead, so a change takes effect on
  // the very next dart without waiting for a render.
  const fxLevel = useFxLevel();
  const fx = fxFlags(fxLevel);
  // The rules introduction, shown over the first match started on a device (see lib/rulesIntro.ts).
  const [showRules, setShowRules] = useState(false);
  // The line-up with the count down, once, as a match starts (Full party).
  const [showLineup, setShowLineup] = useState(false);
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
  const accuracyTotalsRef = useRef<Record<string, { distance: number; horizontal: number; vertical: number; throws: number; sumSq?: number; byMember?: Record<string, { throws: number; sumR: number; sumR2: number }>; bias?: AimBias }>>({});
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
  /**
   * The turn that was confirmed last, kept whole: where it started, every action in it and what the confirming changed around it (the
   * count of turns, whose turn it is, the team's thrower). Angre after Bekreft opens that turn again exactly as it was, with its darts,
   * its shot boxes and its triple/double question, instead of patching the board one cross at a time as it did before — which is what
   * left darts counted twice and a question that could not be asked again.
   */
  const lastConfirmedRef = useRef<{
    player: string;
    turnIndex: number;
    idx: number;
    start: TurnStart;
    actions: LiveAction[];
    answeredChoice: boolean;
    turnLogBefore: TurnResult[];
    memberIdx: number | undefined;
    stood: boolean | undefined;
    lastTeam: { turnIndex: number; memberIdx: number; stood: boolean } | undefined;
  } | null>(null);
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
  // The stand rule's question is on the screen: "were all three darts good?" — see standQuestionDue.
  const [standQuestion, setStandQuestion] = useState(false);
  // Who led after the last turn, so that taking the lead can be announced (FxStage).
  const leaderRef = useRef<string | null>(null);
  // Whose personal record has already been announced in this match.
  const recordAnnouncedRef = useRef<Set<string>>(new Set());
  // The saved teams, for their shirts — see kitAssignment below.
  const teamRecords = useTeamRecords();
  // The odds on the match (lib/odds): worked out after every turn and when the match starts, from the
  // board, who throws next, and how well each of them throws — their records and tonight's darts.
  const rosterRecords = useRoster();
  // Vanlig leaves the odds out: they belong to Party and Full party.
  const showOdds = useShowOdds() && fxLevel !== "normal";
  const [odds, setOdds] = useState<OddsRow[] | null>(null);
  const oddsHistoryRef = useRef<OddsSnapshot[]>([]);
  // Which turn the odds on show were worked out for, and which match this is (for /bet).
  const [oddsTurn, setOddsTurn] = useState(-1);
  // The match does not count in the statistics: ticked under Start, or chosen on the winner screen after a match
  // that was tapped wrong. A ref as well as state, since the result is written from handlers that must see it now.
  const skipStatsRef = useRef(false);
  const [skipStats, setSkipStatsState] = useState(false);
  const setSkipStats = (v: boolean) => {
    skipStatsRef.current = v;
    setSkipStatsState(v);
  };
  // Advanced entry: every dart is keyed in by hand as the bed it hit (a miss included), so the match knows where all of them
  // landed. Chosen under Avanserte innstillinger before the start. A ref as well as state for the same reason as skipStats.
  const exactEntryRef = useRef(false);
  // The place of a single match, chosen under Avanserte innstillinger (Ly unless it is changed): its cup is on the winner screen.
  const [matchVenue, setMatchVenue] = useState<VenueId>("lu");
  const [exactEntry, setExactEntryState] = useState(false);
  const setExactEntry = (v: boolean) => {
    exactEntryRef.current = v;
    setExactEntryState(v);
  };
  const matchIdRef = useRef("");
  const [oddsHistory, setOddsHistory] = useState<OddsSnapshot[]>([]);
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
  // Per team: did its last turn end with the thrower standing ("stå ved 3 tellende")? Only so the
  // thrower bar can say why the same person is up again. Per team, not one flag for the match —
  // the other team's turn in between must not wipe it. Not persisted: it is a courtesy, and the
  // thrower itself (teamMemberIdx) is.
  const [stoodByTeam, setStoodByTeam] = useState<Record<string, boolean>>({});
  // Per team: its latest confirmed turn, who threw it and whether they stood. Lets a corrected
  // turn change the stand decision after the fact (see advanceTurn). In-memory only — after a
  // reload a correction simply leaves the pointer where it was.
  const lastTeamTurnRef = useRef<Record<string, { turnIndex: number; memberIdx: number; stood: boolean }>>({});

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

  /** Who is physically throwing: the team's current member, or the lone player.  */
  function whoThrows(): string {
    if (!activePlayer) return "";
    const roster = teamRosters[activePlayer];
    return roster && roster.length > 0 ? roster[(teamMemberIdx[activePlayer] ?? 0) % roster.length].name : activePlayer;
  }

  useEffect(() => {
    if (screen !== "game" || !hydratedFromStorage || players.length < 2 || rewound !== null || winner) return;
    // The odds of this turn are already up and a dart has been thrown: a change in the records (another phone saving)
    // must not price the turn again from a board that is half way through it, as if three darts were left.
    if (dartsThisTurn > 0 && oddsTurn === turnToken && odds !== null) return;
    // After the render, so the board it reads is the settled one — and never in the middle of a turn. The
    // calculation takes tens of milliseconds, several times that on a phone, so it is done in a thread of its
    // own (lib/odds/client.ts): a tap is never held up by it.
    let cancelled = false;
    const id = setTimeout(() => {
      const rules = getRules();
      // Only what the odds read of a record: the pictures in it would be copied to the thread for nothing.
      const roster = rosterRecords.map((r) => ({ name: r.name, kind: r.kind, matchHistory: r.matchHistory, accuracy: r.accuracy, memberStats: r.memberStats })) as unknown as OddsMatch["roster"];
      computeOddsOffThread(
        {
          rules: { target: rules.target, ringChoice: rules.ringOnOwnNumberIsChoice },
          players,
          currentIdx,
          progress,
          teamRosters,
          teamMemberIdx,
          botLevels,
          roster,
          live: accuracyTotalsRef.current,
        },
        variant,
      )
        .then((result) => {
          if (cancelled) return;
          const key = `${turnToken}|${currentIdx}`;
          const history = oddsHistoryRef.current;
          const last = history[history.length - 1];
          const sameTurn = last?.key === key;
          const before = sameTurn ? history[history.length - 2] : last;
          const sides = players.map((p) => {
            const o = result.find((r) => r.name === p)!;
            return { name: p, p: o.p, odds: fairPrice(o.p) };
          });
          oddsHistoryRef.current = sameTurn ? [...history.slice(0, -1), { key, sides }] : [...history, { key, sides }];
          setOddsHistory(oddsHistoryRef.current);
          setOddsTurn(turnToken);
          setOdds(
            players.map((p) => {
              const o = result.find((r) => r.name === p)!;
              return { name: p, odds: fairPrice(o.p), p: o.p, lo: o.lo, hi: o.hi, before: before?.sides.find((x) => x.name === p)?.p, active: p === activePlayer, margin: o.margin };
            }),
          );
        })
        .catch((err) => console.error("Kunne ikke regne ut odds:", err));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // Only at a turn boundary (or when the people or the records change) — not on every dart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnToken, currentIdx, screen, hydratedFromStorage, players.length, winner === null, rosterRecords]);

  // «Matchdart» when the bull is all that is left and an inner bull finishes it; «out» when the rest can
  // be taken with the three darts of one turn (a double or a triple, two or three on the last number, or a
  // double, a 25 and a bull). The same animation, a different word (lib/finishState.ts).
  const finish = screen === "game" && !!activePlayer && rewound === null ? finishState(progress[activePlayer], getRules().target) : null;
  const matchDartOn = finish !== null;
  useEffect(() => {
    if (!finish || !activePlayer) return;
    emitFx({ type: "matchdart", word: finish === "out" ? "OUT" : "MATCHDART" });
  }, [finish, turnToken, activePlayer]);

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
      matchIdRef.current = restored.matchId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      // Reloaded on the winner screen: the result was held, not written (unless it was, which the marker says),
      // so it is held again from the turn log the snapshot kept.
      if (restored.screen === "winner" && restored.winner && !resultWritten(matchIdRef.current)) {
        pendingResultRef.current = { turnLog: restored.turnLog, winnerName: restored.winner };
      }
      setScreen(restored.screen);
      setSkipStats(restored.skipStats ?? false);
      setExactEntry(restored.exactEntry ?? false);
      setMatchVenue(restored.venue ?? "lu");
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
      matchId: matchIdRef.current,
      skipStats,
      exactEntry,
      venue: matchVenue,
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
          ? { kind: "dart", dartIndex: a.dartIndex, sector: a.sector, bounceout: a.bounceout, scored: a.scored, coordinates: a.coordinates, ...(a.manual ? { manual: true as const } : {}) }
          : a,
      ),
    });
    const snapshot = { screen, players, progress, activePlayer, turnToken, winner, botLevels, guestPlayers, variant, odds: odds ? odds.map((o) => ({ name: o.name, odds: o.odds, p: o.p, ...(o.margin ? { margin: o.margin.map((v) => Math.round(v * 10000) / 10000) } : {}) })) : undefined, oddsTurn, matchId: matchIdRef.current, dartsInTurn: dartsThisTurn, rewound: rewound !== null, teams: Object.fromEntries(Object.entries(teamRosters).map(([t, members]) => [t, members.map((m) => m.name)])) };
    if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    // Not held back once a dart is in the air: /bet closes its market on the first dart of a turn, and a snapshot that
    // comes 700 ms late is a window in which someone at the board has seen the dart and still takes the old price.
    publishTimerRef.current = setTimeout(() => publishLiveMatch(snapshot), dartsThisTurn > 0 ? 0 : LIVE_PUBLISH_DEBOUNCE_MS);
  }, [
    hydratedFromStorage,
    screen,
    variant,
    skipStats,
    exactEntry,
    matchVenue,
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
    odds,
    oddsTurn,
    dartsThisTurn,
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
  // How many actions the turn had when the last triple/double choice was answered, or -1. Answering is not an action of its
  // own, so without this Angre straight after an answer would take the last DART off instead of re-opening the choice.
  const choiceAnsweredAtRef = useRef(-1);
  // The darts the player has said to keep on their ring, by dart index, for the turn in progress: a later dart further down
  // the line no longer puts them on their number (see impliedRedirects). Cleared when the turn ends.
  const forcedKeepRef = useRef<Set<number>>(new Set());
  // Set while a turn is played over from its start only to take one answer back: the third dart then must not end the turn
  // on the way, since the answer that caused the replay is still being worked out.
  const skipFinishRef = useRef(false);

  // Consecutive scoring darts, right now — drives how big the boom is (see lib/fanfare.ts)
  // and the matching shake and heat. Reset at the start of a turn and by any miss, but a miss
  // no longer silences what follows: the next hit sounds again from level one.
  const hitStreakRef = useRef(0);
  // Darts in a row that counted, per thrower, across turns: a boom that keeps growing with the run (lib/fanfare.ts).
  const runRef = useRef<Record<string, number>>({});

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
  function processDart(payload: { sector: string; bounceout: boolean; coordinates: [number, number]; manual?: boolean }) {
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

    // A dart on a number further down the line says what the earlier one was meant for: after a T20 on 20, a T19 or an S18
    // only makes sense if the 20 is closed. So the T20 goes on the 20 now — the board moves on, and this dart counts where
    // it landed, with its own sound and picture — and the question is still asked when the turn is over (see `redirected`
    // on PendingAmbiguous). A bot's darts land where they land, which says nothing about what it meant, so it is left out.
    const landed = parseSector(payload.sector, payload.bounceout);
    if (activeBotLevel === null && landed.kind === "number") {
      for (let guard = 0; guard < 8; guard++) {
        const picks = impliedRedirects(
          pendingAmbiguousRef.current,
          progressRef.current[activePlayer],
          landed.number,
          (p) => p.dartIndex === undefined || !forcedKeepRef.current.has(p.dartIndex),
        );
        if (picks.length === 0) break;
        let moved = false;
        for (const item of picks) {
          const done = redirectParked(item);
          if (!done) continue;
          moved = true;
          updatePendingAmbiguous(
            meaningfulPending(
              [...pendingAmbiguousRef.current.map((p) => (p.key === item.key ? { ...p, redirected: true as const } : p)), ...done.reopened],
              done.finalProgress[activePlayer],
            ),
          );
          // A number closed this way gets the slam it would have got from a single dart.
          if (done.finalProgress[activePlayer][item.number] >= getRules().target && !replayingRef.current) {
            setClosedStep({ token: ++pulseTokenRef.current, step: item.number });
          }
        }
        if (!moved) break;
      }
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
      const runKey = whoThrows();
      const run = (runRef.current[runKey] ?? 0) + 1;
      runRef.current[runKey] = run;
      // A replayed dart already had its boom the first time round. How big it gets, and whether
      // a crowd joins the third dart, is the chosen level's call (see lib/fxLevel.ts).
      if (!replayingRef.current) {
        const fx = fxFlags(getFxLevel());
        // The boom follows the run, not just the turn: dart 4, 5, 6 in a row hit harder and harder.
        playHitStreakSound(Math.min(run, fx.boomMaxStreak));
        // The crowd and the fanfare are built from hundreds of audio nodes: started a moment after the boom, so
        // the board has drawn the dart before the sound engine is busy with them.
        if (fx.crowd && run >= 3) setTimeout(() => playCrowd(crowdForStreak(run)), 40);
        // Every third dart in a row has a fanfare of its own, bigger the longer the run (Full party).
        if (fx.streakFanfare && run >= 3 && run % 3 === 0) setTimeout(() => playStreakFanfare(run), 20);
        setHitPulse({ token: ++pulseTokenRef.current, streak });
      }
    } else {
      // A miss breaks the run, but only the run — the next hit still sounds, from the bottom.
      hitStreakRef.current = 0;
      runRef.current[whoThrows()] = 0;
      // A real dart that did not score bounces off and falls (Full party).
      if (!replayingRef.current) emitFx({ type: "miss" });
    }

    // A row reaching 3/3 gets its own slam — see the step-slam animation in globals.css.
    const closed = hitResult?.find((h) => h.newCount >= getRules().target && h.prevCount < getRules().target);
    if (closed && !replayingRef.current) {
      setClosedStep({ token: ++pulseTokenRef.current, step: closed.step });
      haptics.close();
    }

    // A triple or double has landed: the word and the shockwave (Full party).
    if (hit && !replayingRef.current && parsed.kind === "number" && (parsed.ring === "T" || parsed.ring === "D")) {
      emitFx({ type: "ring", label: `${parsed.ring === "T" ? "TRIPPEL" : "DOBBEL"} ${parsed.number}` });
    }

    // The inner bull: a bullseye (Full party).
    if (hit && !replayingRef.current && parsed.kind === "bull" && parsed.ring === "inner") emitFx({ type: "bull" });

    // Three triples on the active number, in one turn.
    if (
      parsed.kind === "number" &&
      parsed.ring === "T" &&
      activeStepAtThrow !== null &&
      !Number.isNaN(Number(activeStepAtThrow)) &&
      parsed.number === Number(activeStepAtThrow)
    ) {
      activeTriplesRef.current += 1;
      if (activeTriplesRef.current === 3 && !replayingRef.current && fxFlags(getFxLevel()).tripleOverlay) setTripleCelebration(true);
    }

    if (!payload.manual) {
      setMatchThrows((prev) => ({
        ...prev,
        [activePlayer]: [...(prev[activePlayer] ?? []), payload.coordinates],
      }));
    }
    const accuracy = activeStepAtThrow && !payload.manual ? throwAccuracy(activeStepAtThrow, payload.coordinates) : null;
    if (accuracy) {
      const totals = accuracyTotalsRef.current[activePlayer] ?? { distance: 0, horizontal: 0, vertical: 0, throws: 0 };
      // Per thrower as well: in a team the match is booked on the team, but the odds need to know how
      // well each member throws (lib/odds). Squared distances are what the spread is estimated from.
      const who = whoThrows();
      const mine = totals.byMember?.[who] ?? { throws: 0, sumR: 0, sumR2: 0 };
      accuracyTotalsRef.current = {
        ...accuracyTotalsRef.current,
        [activePlayer]: {
          distance: totals.distance + accuracy.distance,
          horizontal: totals.horizontal + accuracy.horizontal,
          vertical: totals.vertical + accuracy.vertical,
          throws: totals.throws + 1,
          sumSq: (totals.sumSq ?? 0) + accuracy.distance ** 2,
          // Which way the dart missed its aim — the coach reads this (lib/coach.ts).
          bias: addAimOffset(totals.bias, aimOffset(activeStepAtThrow as Step, payload.coordinates)),
          byMember: { ...totals.byMember, [who]: { throws: mine.throws + 1, sumR: mine.sumR + accuracy.distance, sumR2: mine.sumR2 + accuracy.distance ** 2 } },
        },
      };
    }
    // A ring hit on the own number is judged as the ring attempt it is booked as (worth one
    // cross there); everything else against the active step. Redirecting it later re-judges it
    // against the number — so three T17s in a turn read as 1+1+1 until one becomes 17×3, and
    // the sum always matches the crosses they actually brought.
    const luck = payload.manual ? null : luckForThrow(payload.coordinates, ownNumberRing ? (parsed.ring as Step) : activeStepAtThrow, boardBefore);
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
        ...(payload.manual ? { manual: true as const } : {}),
        scored: hit,
        luck,
        records: hitResult ?? [],
        atStep: activeStepAtThrow,
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
      advanceTurn(finalProgress, finalPendingHits, Math.min(DARTS_PER_TURN, Math.max(dartIndex + 1, finalPendingHits.length)));
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
      if (skipFinishRef.current) return;
      // With a live board, the turn ends the way it does in real darts: when the darts come
      // out. Until then it stays open — the third dart can be undone, a misread box corrected,
      // the choice dialog answered — and the takeout confirms it (see handleTakeoutStarted).
      // Confirming on the third dart instead closed the turn before the player could see what
      // the board made of it. Without a board to report the takeout (manual play, a bot, the
      // board offline) there is nothing to wait for, so the turn ends here as before.
      // Keyed-in darts (advanced entry) wait the same way, for Bekreft instead of a takeout, so the last dart can still be undone.
      if (expectsTakeout() || exactEntryRef.current) {
        // The triple/double question, though, is asked now — the player is standing there
        // looking at the dart, not at the takeout. Answering it does not end the turn (see
        // resolvePendingChoice); the takeout still does.
        const pending = meaningfulPending(pendingAmbiguousRef.current, finalProgress[activePlayer]);
        if (pending.length !== pendingAmbiguousRef.current.length) updatePendingAmbiguous(pending);
        if (pending.length > 0) updateAwaitingConfirmResolution(true);
        return;
      }
      scoliaDartsRef.current = 0;
      finishTurn(finalProgress, finalPendingHits, Math.min(DARTS_PER_TURN, Math.max(dartIndex + 1, finalPendingHits.length)));
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
    if (activeBotLevel !== null || exactEntryRef.current) return false;
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

  const recalibrateWhenReadyRef = useRef(false);
  useEffect(() => {
    if (!recalibrateWhenReadyRef.current || scolia.state.boardStatus === null) return;
    recalibrateWhenReadyRef.current = false;
    if (scolia.state.boardStatus === "Ready") void requestRecalibration();
  }, [scolia.state.boardStatus]);

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

  // The sound engine is built while the board comes up and the browser is idle, not on the first tap (see warmAudio).
  useEffect(() => {
    if (screen !== "game") return;
    const idle = typeof requestIdleCallback === "function";
    const id = idle ? requestIdleCallback(warmAudio, { timeout: 2000 }) : window.setTimeout(warmAudio, 500);
    return () => (idle ? cancelIdleCallback(id) : clearTimeout(id));
  }, [screen]);

  // "Matchdart": the moment someone — a player or a team — is one cross from winning, a held-breath
  // sound tells the table. Watched on the board itself rather than hooked into each way a cross can
  // land, so it covers darts, taps, redirects and Angre alike. It fires when the state BECOMES
  // true: staying there turn after turn is silent, and undoing out of it and back in sounds again
  // because it is true again. The first look after a match opens or is restored is a baseline,
  // not an event — resuming a match that is already at one to go must not announce it.
  const matchDartSeenRef = useRef<Record<string, boolean>>({});
  const matchDartBaselineRef = useRef(true);
  useEffect(() => {
    if (screen !== "game") {
      matchDartSeenRef.current = {};
      matchDartBaselineRef.current = true;
      return;
    }
    const now: Record<string, boolean> = {};
    let fresh = false;
    for (const p of players) {
      const board = progress[p];
      const oneToGo = !!board && finishState(board, getRules().target) === "matchdart";
      now[p] = oneToGo;
      if (oneToGo && !matchDartSeenRef.current[p]) fresh = true;
    }
    const baseline = matchDartBaselineRef.current;
    matchDartSeenRef.current = now;
    matchDartBaselineRef.current = false;
    if (fresh && !baseline) playMatchDartSound();
  }, [progress, screen, players]);

  function startGame(
    startPlayers: string[],
    startBotLevels: Record<string, BotLevel> = {},
    startTeamRosters: Record<string, TeamMember[]> = {},
    startGuestPlayers: Record<string, true> = {},
    startVariant: GameVariant = "standard",
    startStatsOff = false,
    startExactEntry = false,
    startVenue: VenueId = "lu"
  ) {
    setSkipStats(startStatsOff);
    setExactEntry(startExactEntry);
    setMatchVenue(startVenue);
    // A new match starts with a freshly calibrated board. It used to be done by hand with «Kalibrer» before every match: the
    // board can still be part-way through the last visit (a match is won on the first or second dart), and would then count the
    // first throws of the next match against it. Only with a board that is up, so nothing is sent to one that is not.
    // When the status isn't known yet (a tournament match starts straight from mount, before the board has reported in),
    // the request waits in recalibrateWhenReadyRef and goes out the moment the board says Ready.
    if (scolia.state.boardStatus === "Ready") void requestRecalibration();
    else if (scolia.state.boardStatus === null) recalibrateWhenReadyRef.current = true;
    // First, before anything reads a rule: the target, the active step and what a throw means
    // all come from here for the rest of the match.
    setGameVariant(startVariant);
    setStandQuestion(false);
    leaderRef.current = null;
    recordAnnouncedRef.current = new Set();
    oddsHistoryRef.current = [];
    setOddsHistory([]);
    setOdds(null);
    setOddsTurn(-1);
    matchIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    runRef.current = {};
    setVariant(startVariant);
    // Called synchronously from a real button tap (SetupScreen/tournament) — the
    // narrow window where the browser actually allows unlocking audio playback, well
    // before a win-fanfare or hit-streak sound needs to fire from a Scolia/Supabase
    // event later. See lib/fanfare.ts's primeAudio for why this matters.
    primeAudio();
    // Same dive as the win, as an intro. Doubles as an audio check you get for free: it plays
    // straight off the tap that unlocked the context, so if you hear the boom here the sound
    // is working for the rest of the match — including, on AirPlay, whether it went to the TV.
    // Vanlig skips it: the game starts straight on the board.
    if (fxFlags(getFxLevel()).dives) {
      playWinBoom();
      setIntroDiving(true);
    }
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
    setStoodByTeam({});
    lastTeamTurnRef.current = {};
    scoliaDartsRef.current = 0;
    forcedKeepRef.current = new Set();
    setScreen("game");
    setShowLineup(fxFlags(getFxLevel()).lineup && startPlayers.length >= 2);
    if (!hasSeenRulesIntro()) setShowRules(true);
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
        setTimeout(throwNext, botDelayMs());
      }
    }

    const timer = setTimeout(throwNext, botDelayMs());
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
    if (isPerfectClose(dartsOnStep, count)) markPerfectClose(activePlayer, step);

    if (!replayingRef.current) haptics.hit();
    writeProgress({
      ...progressRef.current,
      [activePlayer]: { ...progressRef.current[activePlayer], [step]: count },
    });
    writePendingHits([...pendingHitsRef.current, ...newPendingHits]);
    return newPendingHits;
  }

  /**
   * Advanced entry: one dart keyed in by hand as the bed it hit ("T20", "D5", "S17", "25", "Bull", "None" for a miss). It goes
   * through processDart like a measured dart does, so the rows, the triple/double question, the runs and the turn all work the
   * same — only what is read off coordinates (xH, spread, the heatmap) is left out, since the coordinates are made up.
   */
  function enterDartFromUi(sector: string) {
    setStandQuestion(false);
    processDart({ sector, bounceout: sector === "None", coordinates: coordinatesForSector(sector), manual: true });
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
    const hits = registerHit(step);
    writeTurnActions([...turnActionsRef.current, { kind: "tap", step }]);
    if (replayingRef.current || !hits) return;
    // The click under the finger — every tap that registers, rising with each dart of the turn.
    // Nothing else of the per-dart effects: those ride on real throws (see lib/fxLevel.ts).
    primeAudio();
    playTapSound(Math.min(DARTS_PER_TURN, turnActionsRef.current.filter((a) => a.kind === "tap").length));
    // A row closed by hand gets the same slam a Scolia dart gives it, which does not depend on
    // how fast anyone taps.
    const closed = hits.find((h) => h.newCount >= getRules().target && h.prevCount < getRules().target);
    if (closed) {
      setClosedStep({ token: ++pulseTokenRef.current, step: closed.step });
      haptics.close();
    }
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
      // It counted at the number it turned out to be thrown at, which is where the dart belongs now.
      dart.atStep = d.step;
      setTurnShots((prev) => {
        if (!prev[d.dartIndex]) return prev;
        const next = prev.slice();
        next[d.dartIndex] = { ...prev[d.dartIndex]!, hit: true };
        return next;
      });
      dartsOnStepRef.current[d.step] = (dartsOnStepRef.current[d.step] ?? 0) + 1;
      if (isPerfectClose(dartsOnStepRef.current[d.step] ?? 0, d.newCount)) markPerfectClose(player, d.step);

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
    if (dart.manual) return; // no measured landing to judge
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
    // Only the measured darts went onto the heatmap; a keyed-in one never did.
    const dartCount = turnDarts().filter((d) => !d.manual).length;

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
    choiceAnsweredAtRef.current = -1;
    return true;
  }

  /** Plays actions back through the same paths they first took, minus the noise. */
  function replayActions(actions: readonly TurnAction[]) {
    replayingRef.current = true;
    try {
      for (const a of actions) {
        if (a.kind === "dart") processDart({ sector: a.sector, bounceout: a.bounceout, coordinates: a.coordinates, manual: a.manual });
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
    if (isPerfectClose(dartsOnStep, board[step])) markPerfectClose(player, step);

    // Un-parking redirected the parked dart onto its number; if that filled it, the darts thrown
    // between it and this one may have been singles on the number that just became active.
    const replay = replayAfterRedirect(player, board, parked.dartIndex, turnIndex);
    const nextProgress = { ...progressRef.current, [player]: replay.board };
    const nextPending = [...kept, ...records, ...replay.records];
    writeProgress(nextProgress);
    writePendingHits(nextPending);
    updatePendingAmbiguous([...pendingAmbiguousRef.current.filter((p) => p.key !== parked.key), ...replay.pending]);
    if (records.length > 0 && !replayingRef.current) {
      haptics.hit();
      uiSound("record");
    }
    return { hits: hits.length > 0 ? hits : null, progress: nextProgress, pendingHits: nextPending };
  }

  /**
   * Puts a parked triple/double on its number: its ring cross comes off, the number gets its crosses, and the darts thrown
   * after it are re-read against the number that may now be the active one. Shared by the answer «redirect» and by a later
   * dart further down the line (see impliedRedirects). Null when the dart is no longer this turn's to move.
   */
  function redirectParked(item: PendingAmbiguous): { finalProgress: PlayerProgress; finalPendingHits: HitRecord[]; reopened: PendingAmbiguous[] } | null {
    if (!activePlayer) return null;
    // A redirect rolls a cross back off the board, which is only ever correct while that cross is still this turn's to move.
    if (!pendingHitsRef.current.includes(item.hitRecord)) return null;
    // One cross off, not a restore of item.hitRecord.prevCount — see removeOneCross.
    const rolledBack = {
      ...progressRef.current[activePlayer],
      [item.ringStep]: removeOneCross(progressRef.current[activePlayer][item.ringStep]),
    };
    let finalPendingHits = pendingHitsRef.current.filter((h) => h !== item.hitRecord);
    // Off the ring and onto the number. A reopened slenger (see replayAfterRedirect) was pre-banked and now isn't; a ring hit
    // on the own number never was. Either way the dart is now an attempt at the number, and xH re-judges it as such.
    if (!item.hitRecord.ownNumberRing) bumpPreBanked(activePlayer, item.ringStep, -1);
    const redirectedDart = item.dartIndex === undefined ? undefined : turnDarts().find((t) => t.dartIndex === item.dartIndex);
    if (redirectedDart) rejudgeDart(activePlayer, redirectedDart, item.number, rolledBack);

    // chainCrosses rather than registerHit: registerHit reads `progress` from this component's state and would miss the
    // rollback above until the next render.
    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    const newHits: HitRecord[] = chainCrosses(rolledBack[item.number], item.multiplier).map((d) => ({
      player: activePlayer,
      step: item.number,
      prevCount: d.prevCount,
      newCount: d.newCount,
      turnIndex,
    }));
    const count = newHits.length > 0 ? newHits[newHits.length - 1].newCount : rolledBack[item.number];
    // If that filled the number, the darts thrown after the parked one were aimed at a number that is now, retroactively,
    // the active one — see replayAfterRedirect.
    const replay = replayAfterRedirect(activePlayer, { ...rolledBack, [item.number]: count }, item.dartIndex, turnIndex);
    const finalProgress = { ...progressRef.current, [activePlayer]: replay.board };
    finalPendingHits = [...finalPendingHits, ...newHits, ...replay.records];

    if (!replayingRef.current) haptics.hit();
    writeProgress(finalProgress);
    writePendingHits(finalPendingHits);
    return { finalProgress, finalPendingHits, reopened: replay.pending };
  }

  /**
   * The answer «keep» to a dart that a later dart had put on its number: the turn is played over from its start with that dart
   * told to stay on its ring, so the later darts are read against the number the player was really on. Whatever the replay
   * leaves open is asked as usual; when nothing is, the turn goes on as after any other answer.
   */
  function flipRedirectedToKeep(item: PendingAmbiguous) {
    if (!activePlayer) return;
    if (item.dartIndex === undefined) {
      // Nothing to replay it from (a match resumed from before darts were numbered): the dart simply stays where it was put.
      updatePendingAmbiguous(pendingAmbiguousRef.current.filter((p) => p.key !== item.key));
      return;
    }
    forcedKeepRef.current.add(item.dartIndex);
    const actions = turnActionsRef.current;
    skipFinishRef.current = true;
    try {
      if (rewindTurn()) replayActions(actions);
    } finally {
      skipFinishRef.current = false;
    }
    choiceAnsweredAtRef.current = turnActionsRef.current.length;
    const keptIndex = item.dartIndex;
    const remaining = meaningfulPending(
      pendingAmbiguousRef.current.filter((p) => p.dartIndex !== keptIndex),
      progressRef.current[activePlayer],
    );
    updatePendingAmbiguous(remaining);
    if (remaining.length > 0) {
      updateAwaitingConfirmResolution(true);
      return;
    }
    updateAwaitingConfirmResolution(false);
    // Three darts are in and a takeout confirms the turn, as after any other answer.
    if (scoliaDartsRef.current >= DARTS_PER_TURN) return;
    advanceTurn(progressRef.current, pendingHitsRef.current);
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
    if (item.redirected && choice === "keep") {
      flipRedirectedToKeep(item);
      return;
    }
    choiceAnsweredAtRef.current = turnActionsRef.current.length;

    let finalProgress = progressRef.current;
    let finalPendingHits = pendingHitsRef.current;
    // Ring darts on the number this redirect may have just opened — see replayAfterRedirect.
    let reopened: PendingAmbiguous[] = [];

    if (choice === "redirect") {
      const done = redirectParked(item);
      if (done) {
        finalProgress = done.finalProgress;
        finalPendingHits = done.finalPendingHits;
        reopened = done.reopened;
      }
    }

    // Filtered against finalProgress, not `progress` — this same choice may have just
    // filled the number, which is exactly what makes a sibling choice on that number moot
    // (see meaningfulPending), and the state won't reflect it until the next render.
    // «Behold» on a dart a later one put on its number accepts the sequence as it stands: the others put there the same way
    // were part of the same reading of the turn, and are not asked again one by one.
    const acceptedWith = item.redirected && choice === "redirect";
    const remaining = meaningfulPending(
      [...pendingAmbiguousRef.current.filter((p) => p.key !== item.key && !(acceptedWith && p.redirected)), ...reopened],
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

  /**
   * Opens the turn that was confirmed last, as it was: the counts and the order of play go back to before it, its darts are taken off
   * the log and the history, and its actions are played again through the ordinary paths once its thrower is the one up. If a
   * triple/double question had been answered, the answer is the thing taken back (the turn comes back with the question open); if not,
   * the last action of the turn goes, as it does within a turn.
   */
  function reopenConfirmedTurn(c: NonNullable<typeof lastConfirmedRef.current>) {
    lastConfirmedRef.current = null;
    const replay = c.answeredChoice ? c.actions : c.actions.slice(0, -1);
    setHistory((prev) => prev.filter((h) => !(h.player === c.player && h.turnIndex === c.turnIndex)));
    setTurnLog((prev) => ({ ...prev, [c.player]: c.turnLogBefore }));
    setTurnCounters((prev) => ({ ...prev, [c.player]: c.turnIndex }));
    if (teamRosters[c.player]) {
      if (c.memberIdx !== undefined) setTeamMemberIdx((prev) => ({ ...prev, [c.player]: c.memberIdx! }));
      setStoodByTeam((prev) => ({ ...prev, [c.player]: !!c.stood }));
      if (c.lastTeam) lastTeamTurnRef.current[c.player] = c.lastTeam;
      else delete lastTeamTurnRef.current[c.player];
    }
    runRef.current[c.player] = currentRun(c.turnLogBefore, c.player, c.player);
    pendingReplayRef.current = { start: c.start, actions: replay };
    setTurnToken((t) => t + 1);
    setCurrentIdx(c.idx);
  }

  function undo() {
    uiSound("undo");
    haptics.undo();
    setStandQuestion(false);
    // This turn: the last ACTION goes — a whole dart with everything it brought, or a tap. See
    // rewindTurn for why it is rebuilt from the start rather than patched.
    if (turnActionsRef.current.length > 0) {
      const actions = turnActionsRef.current;
      // Nothing happened since a choice was answered: Angre takes the answer back (the turn is rebuilt with the choice open
      // again), not the dart the choice was about.
      const undoesChoice = choiceAnsweredAtRef.current === actions.length;
      // Taking an answer back also takes back an answer «keep» gave to a dart a later one had put on its number.
      if (undoesChoice) forcedKeepRef.current = new Set();
      if (rewindTurn()) {
        replayActions(undoesChoice ? actions : actions.slice(0, -1));
        return;
      }
    }
    // The turn was confirmed and nothing has happened since: Angre opens it again as it was.
    const confirmed = lastConfirmedRef.current;
    const lastHit = history[history.length - 1];
    if (
      confirmed &&
      rewound === null &&
      winner === null &&
      pendingHitsRef.current.length === 0 &&
      currentIdx === (confirmed.idx + 1) % players.length &&
      (turnCounters[confirmed.player] ?? 0) === confirmed.turnIndex + 1 &&
      (!lastHit || (lastHit.player === confirmed.player && lastHit.turnIndex === confirmed.turnIndex))
    ) {
      reopenConfirmedTurn(confirmed);
      return;
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
      // The rest of that turn's darts are still on the board. They come back as the turn's own darts, so that
      // confirming the turn again builds it from all of them and not from the new tap alone.
      const sameTurn = history.slice(0, -1).filter((h) => h.player === last.player && h.turnIndex === last.turnIndex);
      writePendingHits([...pendingHitsRef.current, ...sameTurn]);
      setHistory((prev) => prev.slice(0, -1).filter((h) => !(h.player === last.player && h.turnIndex === last.turnIndex)));
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
      // (bots are never ensurePlayer'd into the roster to begin with), and a guest was never
      // ensurePlayer'd either (see SetupScreen's addPlayer) — so results only ever count for a
      // real, saved individual, or for a team: a team has a record of its own (lib/playerRows.ts),
      // and its match goes there, not to its members. A team with a bot or a guest in it is left
      // out for the same reason as the bot or the guest.
      if (botLevels[p] || guestPlayers[p]) return;
      const roster = teamRosters[p];
      if (roster) {
        if (roster.some((m) => m.isBot || guestPlayers[m.name])) return;
      }
      const dartsUsed = aggregate.darts;
      // A match aborted before this player ever threw a dart isn't a match they played — without
      // this guard, quitting instantly (or a tournament match started and immediately abandoned)
      // still counted as a full "kamp" in their career matchesPlayed, with nothing to show for it.
      if (dartsUsed === 0) return;
      if (roster) ensureTeam(p, roster.map((m) => m.name));
      recordMatchResult(p, aggregate, p === winnerName);
      // The longest run of counting darts any thrower on this side had — the team's own, in a team.
      const bestRun = Math.max(0, ...throwerStats(finalTurnLog[p] ?? [], p).map((r) => longestRun(finalTurnLog[p] ?? [], r.name)));
      if (bestRun > 0) recordBestRun(p, bestRun);
      const accuracy = accuracyTotalsRef.current[p];
      if (accuracy) recordAccuracyTotals(p, accuracy);
      // In a team, each member's own numbers go on the team's record, next to the team's.
      if (roster) recordMemberStats(p, memberDeltas(finalTurnLog[p] ?? [], roster.map((m) => m.name), accuracy?.byMember));
      const luckTotals = luckTotalsRef.current[p];
      if (luckTotals) recordLuckTotals(p, luckTotals);
      const ringHits = ringHitsRef.current[p];
      if (ringHits) recordRingHits(p, ringHits.triple, ringHits.double);

      recordMatchHistory(p, {
        date: new Date().toISOString(),
        won: p === winnerName,
        dartsUsed,
        hitPct: aggregate.hits + aggregate.misses > 0 ? Math.round((aggregate.hits / (aggregate.hits + aggregate.misses)) * 100) : 0,
        // Crosses per dart, which the odds read the hit rate as (lib/odds/hitRate.ts); hitPct above is the one shown.
        cpd: Math.round((aggregate.hits / dartsUsed) * 100),
        med: accuracy && accuracy.throws > 0 ? accuracy.distance / accuracy.throws : null,
        mhd: accuracy && accuracy.throws > 0 ? accuracy.horizontal / accuracy.throws : null,
        mvd: accuracy && accuracy.throws > 0 ? accuracy.vertical / accuracy.throws : null,
        ...(accuracy?.bias && accuracy.bias.n + accuracy.bias.rn > 0 ? { bias: accuracy.bias } : {}),
        ...(accuracy && accuracy.throws > 0 ? { throws: accuracy.throws, sumR: accuracy.distance, sumR2: accuracy.sumSq ?? 0, ...(roster && accuracy.byMember ? { byMember: accuracy.byMember } : {}) } : {}),
        // What the match log needs to list this as one match among others, and its numbers row by row.
        matchId: matchIdRef.current,
        vs: players.filter((x) => x !== p),
        ...(progress[p] ? { left: remainingMarks(progress[p]) } : {}),
        steps: Object.fromEntries(STEPS.filter((s) => (aggregate.hitsByStep[s] ?? 0) + (aggregate.missesByStep[s] ?? 0) > 0).map((s) => [s, [aggregate.hitsByStep[s] ?? 0, aggregate.missesByStep[s] ?? 0]])),
        // Darts per row, for the chart under the player's statistics — the side's, and in a team each member's own.
        rowDarts: rowCosts(finalTurnLog[p] ?? []),
        ...(roster
          ? {
              rowDartsByMember: Object.fromEntries(
                roster.map((m) => [m.name, rowCosts((finalTurnLog[p] ?? []).filter((t): t is TurnResult => !!t && t.thrower === m.name))]),
              ),
            }
          : {}),
      });
    });
    // The rating (lib/rating.ts): only a match between two sides, both real, with something thrown by each.
    const loser = players.length === 2 && winnerName ? players.find((p) => p !== winnerName) : undefined;
    const real = (p: string) => !botLevels[p] && !guestPlayers[p] && !(teamRosters[p] ?? []).some((m) => m.isBot || guestPlayers[m.name]);
    if (winnerName && loser && real(winnerName) && real(loser) && (aggregateTurns(finalTurnLog[loser] ?? []).darts > 0)) recordRating(winnerName, loser);
    // The whole match, as the winner screen showed it, so that it can be opened again from the list of matches.
    if (winnerName) {
      void saveMatchArchive({
        id: matchIdRef.current,
        date: new Date().toISOString(),
        variant,
        winner: winnerName,
        players,
        teams: Object.fromEntries(Object.entries(teamRosters).map(([t, members]) => [t, members.map((m) => m.name)])),
        stats: winnerStats,
        luck: winnerLuck,
        preBanked,
        throws: matchThrows,
        turnLog: finalTurnLog,
        progress,
        odds: oddsHistoryRef.current,
      });
    }
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
    if (!pending || players.length === 0) return;
    pendingResultRef.current = null;
    // Written already (a flush on leaving the page, then Angre and a new win after a reload): once per match.
    if (resultWritten(matchIdRef.current)) return;
    // A match played for fun, or taken out of the statistics after the fact: nothing is written, and the odds
    // log (made of the same taps) is left alone too.
    if (skipStatsRef.current) return;
    // What the odds said, turn by turn, next to who won — so that they can be checked afterwards.
    if (pending.winnerName) void logOddsMatch({ winner: pending.winnerName, sides: players, snapshots: oddsHistoryRef.current, variant });
    persistMatchResults(pending.turnLog, pending.winnerName);
    markResultWritten(matchIdRef.current);
  }

  // Leaving the app counts as accepting the win. `pagehide` rather than `beforeunload`: iOS
  // Safari doesn't fire the latter, and backgrounding the tab is how a match on a phone
  // usually ends. Registered for the component's whole life so it can't miss the window.
  useEffect(() => {
    const flush = () => flushMatchResultsRef.current();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
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
  function finishTurn(progressOverride?: PlayerProgress, pendingHitsOverride?: HitRecord[], dartsOverride?: number, countedOverride?: number) {
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
    advanceTurn(progressOverride, pendingHitsOverride, dartsOverride, countedOverride);
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
    uiSound("confirm");
    if (standQuestionDue()) {
      setStandQuestion(true);
      return;
    }
    finishTurn();
  }

  /**
   * Whether Bekreft has to ask before the turn moves on. Under the stand rule a thrower keeps
   * their place when all three darts counted — and with manual entry a tap is a mark, not a
   * dart: three marks can be one single, one double and a miss, which is two darts. The board
   * knows its darts, so with Scolia there is nothing to ask; by hand, the thrower is asked.
   */
  function standQuestionDue(): boolean {
    if (!activePlayer || rewound !== null || botIsThrowing) return false;
    if (!getRules().standOnThree) return false;
    const roster = teamRosters[activePlayer];
    if (!roster || roster.length < 2) return false;
    if (turnShots.some(Boolean)) return false;
    return countingDarts(turnActionsRef.current) >= DARTS_PER_TURN;
  }

  /**
   * Switches the stand rule on or off in a match that is already going — for the one that was
   * started with it forgotten. The rule is part of the variant, so this changes the variant and
   * nothing else: it counts from the next confirmed turn, and what has been played stays as it was.
   */
  function toggleStandRule() {
    const next = withStandRule(variant, !hasStandRule(variant));
    setGameVariant(next);
    setVariant(next);
    setStandQuestion(false);
  }

  /**
   * Hands the turn to another member of the team that is up. For the first turn of a team that
   * should start with the other one, and for a slip of the finger later, without taking anything
   * back: only who is throwing changes — the turn in progress is recorded under them from here.
   */
  function switchThrower(name: string) {
    if (!activePlayer || rewound !== null) return;
    const roster = teamRosters[activePlayer];
    const idx = roster?.findIndex((m) => m.name === name) ?? -1;
    if (!roster || idx === -1) return;
    setTeamMemberIdx((prev) => ({ ...prev, [activePlayer]: idx }));
    // A stand carried over from the last turn belonged to the one who stood.
    setStoodByTeam((prev) => ({ ...prev, [activePlayer]: false }));
  }

  function answerStandQuestion(stood: boolean) {
    setStandQuestion(false);
    finishTurn(undefined, undefined, undefined, stood ? DARTS_PER_TURN : DARTS_PER_TURN - 1);
  }

  /**
   * `progressOverride`/`pendingHitsOverride` let resolvePendingChoice hand in
   * values it just computed locally, for the one case (a redirect that was the
   * last undecided choice) where this needs to see a change from the very same
   * event that's calling it, before that change has made it back through a
   * render — reading `progress`/`pendingHits` here directly would still be the
   * pre-redirect snapshot at that point.
   */
  function advanceTurn(progressOverride?: PlayerProgress, pendingHitsOverride?: HitRecord[], dartsOverride?: number, countedOverride?: number) {
    if (!activePlayer) return;
    // Read before the turn's action list is emptied just below: the stand rule is decided by
    // how many of this turn's darts counted — or by the thrower's own answer (see answerStandQuestion).
    // A turn put back for a correction has its earlier darts among the pending ones, with no actions left to count.
    const earlierDarts = rewound ? Math.min(DARTS_PER_TURN, (pendingHitsOverride ?? pendingHits).length) : 0;
    const countedDarts = countedOverride ?? Math.max(countingDarts(turnActionsRef.current), earlierDarts);
    // How the turn ended, in the order the darts landed — read before the actions are cleared below.
    const tailNow = trailingRun(turnActionsRef.current);
    const liveDarts = turnDarts();
    // The turn is kept whole for Angre (see lastConfirmedRef): a person's turn, in order, that has something in it to open again.
    lastConfirmedRef.current =
      !rewound && turnStartRef.current && turnStartRef.current.player === activePlayer && !botLevels[activePlayer] && turnActionsRef.current.length > 0
        ? {
            player: activePlayer,
            turnIndex: turnCounters[activePlayer] ?? 0,
            idx: currentIdx,
            start: turnStartRef.current,
            actions: turnActionsRef.current,
            answeredChoice: choiceAnsweredAtRef.current === turnActionsRef.current.length,
            turnLogBefore: turnLog[activePlayer] ?? [],
            memberIdx: teamMemberIdx[activePlayer],
            stood: stoodByTeam[activePlayer],
            lastTeam: lastTeamTurnRef.current[activePlayer],
          }
        : null;
    dartsOnStepRef.current = {};
    forcedKeepRef.current = new Set();
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
    // Keyed-in darts: a turn that did not win is three darts, so a Bekreft after two entries means one was not entered (a miss
    // that was forgotten), not a two-dart turn.
    const dartsForTurn =
      dartsOverride ?? (scoliaDarts ? (exactEntryRef.current && !finishedNow ? DARTS_PER_TURN : scoliaDarts) : finishedNow ? Math.max(1, manualTapsThisTurn) : DARTS_PER_TURN);
    const turnIndex = rewound ? rewoundTurnIndex ?? 0 : turnCounters[activePlayer] ?? 0;
    // Who threw it, for the per-member numbers afterwards: the team's current member, or — on a
    // re-confirmed turn, where the pointer has moved on — whoever the turn already says.
    const rosterNow = teamRosters[activePlayer];
    const throwerName = rewound
      ? turnLog[activePlayer]?.[turnIndex]?.thrower
      : rosterNow && rosterNow.length > 0
        ? rosterNow[(teamMemberIdx[activePlayer] ?? 0) % rosterNow.length].name
        : undefined;
    const summary = summarizeTurn(effectivePendingHits, activeStepNow, dartsForTurn);
    const rows = scoliaDarts > 0 && liveDarts.length === scoliaDarts ? dartsByRow(liveDarts, effectivePendingHits) : {};
    const turn: TurnResult = {
      ...summary,
      ...rows,
      // The turn's misses are the darts that really missed when every dart is known, so the total and the rows add up — a
      // triple and two misses is three crosses and two misses, not three crosses and none, which is what darts minus
      // crosses says. Without per-dart knowledge it stays the old reckoning (darts minus crosses).
      ...("missesByStep" in rows ? { misses: Object.values(rows.missesByStep).reduce((a, b) => a + (b ?? 0), 0) } : {}),
      counted: countedDarts,
      // Scolia saw every dart, so the counting ones the turn ended on can carry the run into the next turn.
      // By hand an unrecorded miss could be any of the darts, so only a turn of three counting darts carries.
      ...(scoliaDarts >= DARTS_PER_TURN && countedDarts < DARTS_PER_TURN ? { tail: tailNow } : {}),
      ...(throwerName ? { thrower: throwerName } : {}),
    };
    const nextTurnLog = {
      ...turnLog,
      [activePlayer]: setTurnAt(turnLog[activePlayer] ?? [], turnIndex, turn),
    };
    setTurnLog(nextTurnLog);
    if (!rewound) {
      // The run as the turn leaves it: three counting darts carry it on, so does a turn Scolia saw end on some
      // (a miss, a hit and a hit ends on two), and any other turn ends it. The boom of the next dart starts from here.
      const runNow = currentRun(nextTurnLog[activePlayer] ?? [], throwerName ?? activePlayer, throwerName ? undefined : activePlayer);
      runRef.current[throwerName ?? activePlayer] = runNow;
      // All three darts counted: the three lit darts, with the run so far when it is a long one.
      if (countedDarts >= DARTS_PER_TURN) {
        const run = runNow;
        emitFx({ type: "perfect", run });
        // A personal record: longer than the best this player or team has ever had (stored, and only
        // updated when the match is accepted), announced once per match.
        const held = getPlayerRecord(activePlayer);
        const hasBotOrGuest = botLevels[activePlayer] || guestPlayers[activePlayer] || (teamRosters[activePlayer] ?? []).some((m) => m.isBot || guestPlayers[m.name]);
        if (held?.bestRun && !hasBotOrGuest && run > held.bestRun && !recordAnnouncedRef.current.has(activePlayer)) {
          recordAnnouncedRef.current.add(activePlayer);
          emitFx({ type: "record", text: `${activePlayer}: lengste serie, ${run} piler` });
        }
      }
      // Who is ahead now — fewest crosses left, and alone on it. A change of leader is announced.
      if (players.length > 1) {
        const board = { ...progress, [activePlayer]: effectiveProgress[activePlayer] };
        const left = players.map((p) => ({ p, r: remainingMarks(board[p]) }));
        const best = Math.min(...left.map((x) => x.r));
        const ahead = left.filter((x) => x.r === best);
        const leader = ahead.length === 1 ? ahead[0].p : null;
        if (leader && leaderRef.current && leader !== leaderRef.current) emitFx({ type: "lead", name: leader });
        if (leader) leaderRef.current = leader;
      }
    }
    const roster = teamRosters[activePlayer];
    const stands = standsAfterTurn(getRules().standOnThree, countedDarts);
    if (!rewound) {
      setTurnCounters((prev) => ({ ...prev, [activePlayer]: (prev[activePlayer] ?? 0) + 1 }));
      // Rotate this team's own "who throws next" pointer independent of the overall players[]
      // turn order — so next time this exact team is up, the next member in line is current.
      // With the stand rule on, three counting darts keep the same thrower for the next turn.
      if (roster && roster.length > 0) {
        const thrower = teamMemberIdx[activePlayer] ?? 0;
        lastTeamTurnRef.current[activePlayer] = { turnIndex, memberIdx: thrower, stood: stands };
        setTeamMemberIdx((prev) => ({ ...prev, [activePlayer]: nextMemberIndex(prev[activePlayer] ?? 0, roster.length, stands) }));
        setStoodByTeam((prev) => ({ ...prev, [activePlayer]: stands && roster.length > 1 }));
      }
    } else if (roster && roster.length > 0) {
      // Re-confirming an edited turn. The pointer was moved when it was first confirmed; if the
      // edit changed whether three darts counted, the decision made then no longer holds. Only
      // the team's most recent turn can be corrected this way — once it has thrown again the
      // pointer has moved on from it, and what a correction to the older turn would mean for who
      // threw since is not something to guess at.
      const last = lastTeamTurnRef.current[activePlayer];
      if (last && last.turnIndex === turnIndex && last.stood !== stands) {
        lastTeamTurnRef.current[activePlayer] = { ...last, stood: stands };
        setStoodByTeam((prev) => ({ ...prev, [activePlayer]: stands && roster.length > 1 }));
        setTeamMemberIdx((prev) => ({ ...prev, [activePlayer]: nextMemberIndex(last.memberIdx, roster.length, stands) }));
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
      if (fxFlags(getFxLevel()).dives) {
        playWinBoom();
        setDiving(true);
      } else {
        // No dive to land from, so the win is announced on the spot, by the crowd (no fanfare).
        winCheer();
      }
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
    if (!rewound) emitFx({ type: "walkOn", player: players[(currentIdx + 1) % players.length] });

    const nextPlayer = rewound ? players[currentIdx] ?? null : players[(currentIdx + 1) % players.length] ?? null;
    playPlayerSound(nextPlayer);
    // A team's own walk-on tune, if it has chosen one (Full party).
    if (nextPlayer && !rewound && fxFlags(getFxLevel()).walkOnTune) {
      const tune = getPlayerRecord(nextPlayer)?.walkOn;
      if (tune && tune !== "none") playWalkOnTune(tune);
    }

    if (rewound) {
      setRewound(null);
      setRewoundTurnIndex(null);
      return;
    }
    setCurrentIdx((idx) => (idx + 1) % players.length);
    setCameraImages([]);
  }

  function abortGame() {
    setStandQuestion(false);
    // A match that's abandoned before anyone wins never persists any stats —
    // only a match that actually finishes counts as a "kamp", same principle
    // Bull-duell was built with from the start (see lib/bullDuel.ts).
    clearActiveMatch();
    publishLiveMatch(null);
    setScreen("setup");
    setPlayers([]);
    // A tournament match (onMatchComplete set) has nowhere sensible to land on the generic,
    // disconnected SetupScreen — bail straight home instead; the tournament itself lives on in
    // Supabase regardless, so "Fortsett turnering" picks it back up later.
    if (onMatchComplete) onExitToHome?.();
  }

  /** "Ny kamp": other people, through the setup screen. The result is written first — it used to
   *  be written only on a rematch or when the page was closed, so leaving through this button
   *  quietly dropped the match from the players' statistics. */
  function newMatch() {
    flushMatchResults();
    setScreen("setup");
    setPlayers([]);
  }

  /** "Hjem": the same, then out. The saved match is cleared by hand because this component is
   *  about to be unmounted — its own effect that clears it after a screen change would never run,
   *  and the finished match would be restored the next time Enkeltkamp is opened. */
  function goHome() {
    flushMatchResults();
    clearActiveMatch();
    publishLiveMatch(null);
    if (onExitToHome) {
      onExitToHome();
      return;
    }
    setScreen("setup");
    setPlayers([]);
  }

  function playAgain() {
    if (onMatchComplete && winner) {
      flushMatchResults();
      clearActiveMatch();
      onMatchComplete({ winner, placements, stats: winnerStats, remaining: Object.fromEntries(players.map((p) => [p, progress[p] ? remainingMarks(progress[p]) : 0])) });
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
    flushMatchResults();
    startGame(players, botLevels, teamRosters, guestPlayers, variant, skipStatsRef.current, exactEntryRef.current, matchVenue);
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
    // Already written (the page was left and came back): the corrected match is another result, not the first again.
    if (resultWritten(matchIdRef.current)) matchIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setWinner(null);
    setWinnerStats({});
    setWinnerLuck({});
    setPlacements([]);
    undo();
  }

  // The teams' shirts, by team name — a saved team's own two (lib/playerRows.ts), otherwise the
  // default for its people — and a team whose colours would clash with an earlier one's plays in
  // its away kit (lib/teamKit.ts). Read reactively: the records arrive after the first render.
  const kitAssignment = assignKits(
    players
      .filter((p) => teamRosters[p]?.length)
      .map((p) => ({ name: p, members: teamRosters[p].map((m) => m.name), kits: teamRecords.find((r) => r.name.toLowerCase() === p.toLowerCase())?.kits ?? null })),
  );
  const kits: Record<string, Kit> = Object.fromEntries(Object.entries(kitAssignment).map(([name, v]) => [name, v.kit]));

  if (screen === "setup") {
    // Tournament matches skip SetupScreen entirely (see the restore-from-localStorage effect
    // above) — but this branch can still render for one tick before that effect's startGame call
    // takes effect, so keep it as a harmless fallback rather than special-casing it away.
    return (
      <>
        <SetupScreen onStart={startGame} onHome={onExitToHome} scolia={summarizeScolia(scolia.state)} />
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
            winCheer();
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
        turnLogByPlayer={turnLog}
        progressByPlayer={progress}
        winnerKit={kits[winner] ?? null}
        oddsHistory={showOdds ? oddsHistory : []}
        venue={onMatchComplete ? undefined : matchVenue}
        onHome={onMatchComplete ? playAgain : goHome}
        homeLabel={onMatchComplete ? "Til turnering" : "Hjem"}
        onPlayAgain={onMatchComplete ? undefined : rematch}
        onNewMatch={onMatchComplete ? undefined : newMatch}
        onUndoWin={history.length > 0 ? undoWin : undefined}
        statsOff={skipStats}
        onToggleStats={() => setSkipStats(!skipStatsRef.current)}
      />
    );
  }

  // Who is throwing, for the thrower bar. A team's current thrower is a specific member (the
  // column only shows the team's name); a lone player is themselves. Photos come from the roster —
  // bots and guests have none. A rewound turn belongs to whoever threw it, which for a team is
  // not worked out here: the bar then shows the team, not a guess at the person.
  const toThrower = (name: string, isBot: boolean): Thrower => ({
    name,
    isBot,
    photo: isBot ? null : getPlayerRecord(name)?.photo ?? null,
  });
  let thrower: Thrower | null = null;
  let throwerTeam: ThrowerTeam | null = null;
  if (activePlayer) {
    if (activeRoster && activeRoster.length > 0) {
      const activeIdx = (teamMemberIdx[activePlayer] ?? 0) % activeRoster.length;
      const members = activeRoster.map((m) => toThrower(m.name, m.isBot));
      throwerTeam = { name: activePlayer, photo: getPlayerRecord(activePlayer)?.photo ?? null, members, activeIdx };
      thrower = rewound !== null ? { name: activePlayer, isBot: false, photo: null } : members[activeIdx];
    } else {
      thrower = toThrower(activePlayer, activeBotLevel !== null);
    }
  }

  // Darts in a row that counted for whoever is throwing: their unbroken run of three-counting turns
  // (3 darts each), plus the darts of this turn so far. By hand a tap is a dart that counted.
  // The turn in progress only extends the earlier run while it is unbroken: after a miss it is just the darts since
  // (hit, miss, hit is one in a row, not two), so the earlier run is dropped once a dart in this turn has missed.
  const turnBroken = turnActionsRef.current.some((a) => a.kind === "dart" && !a.scored);
  const throwerRun = thrower
    ? (turnBroken ? 0 : currentRun(turnLog[activePlayer ?? ""] ?? [], thrower.name, activeRoster ? undefined : thrower.name)) +
      (rewound === null ? trailingRun(turnActionsRef.current) : 0)
    : 0;

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

  // Full party: how many darts can still be wasted before the fewest-darts record is out of reach. The record is the group's —
  // the fewest any team has won on in a team match, any player in one played alone — not the side's own. Only for a real,
  // saved player or team whose match counts (the same test as the record banner), and only for the turn that is theirs.
  const recordChaseNow = (() => {
    if (!activePlayer || !fx.recordBar || skipStats || !getRules().countsForStats || rewound !== null || botIsThrowing) return null;
    if (botLevels[activePlayer] || guestPlayers[activePlayer] || (teamRosters[activePlayer] ?? []).some((m) => m.isBot || guestPlayers[m.name])) return null;
    const board = progress[activePlayer];
    if (!board) return null;
    const used = aggregateTurns(turnLog[activePlayer] ?? []).darts + dartsThisTurn;
    const group = groupBestWin(teamRosters[activePlayer] ? teamRecords : rosterRecords, teamRosters[activePlayer] ? "team" : "player");
    const chase = recordChase(group?.darts, used, board, getRules().target);
    return chase && group ? { record: chase.record, holder: group.who, slack: chase.slack, left: chase.left, fraction: chaseFraction(chase) } : null;
  })();

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
  // Enkel: the chalkboard, with none of the turns, darts or statistics above. A tournament match needs its result back, so
  // it plays as Vanlig.
  if (fxLevel === "simple" && !onMatchComplete) {
    return <ChalkboardScreen players={players} kits={kits} onExit={abortGame} />;
  }

  if (introDiving) {
    return <WinDive onDone={() => setIntroDiving(false)} />;
  }

  return (
    <>
      {showRules && <RulesIntro onDone={() => setShowRules(false)} />}
      {showLineup && !showRules && (
        <LineupIntro
          onDone={() => setShowLineup(false)}
          sides={players.map((p) => {
            const rec = getPlayerRecord(p);
            return {
              name: p,
              kit: kits[p] ?? null,
              photo: teamRosters[p] ? null : rec?.photo ?? null,
              isBot: !!botLevels[p],
              odds: showOdds ? odds?.find((o) => o.name === p)?.odds : undefined,
              chance: showOdds ? odds?.find((o) => o.name === p)?.p : undefined,
              members: teamRosters[p]?.map((m) => m.name),
              med: rec ? meanEuclideanDistance(rec) : null,
              hitPct: rec && rec.matchesPlayed > 0 ? averagePct(rec.overall) : null,
              wins: rec?.matchesWon ?? 0,
              played: rec?.matchesPlayed ?? 0,
              record: rec && rec.matchesPlayed > 0 ? `${rec.matchesWon} ${rec.matchesWon === 1 ? "seier" : "seire"} på ${rec.matchesPlayed} ${rec.matchesPlayed === 1 ? "kamp" : "kamper"}` : undefined,
            };
          })}
        />
      )}
      <FxStage matchDart={matchDartOn} />
      {/* On the board the status is the dot in the top row (its words are in the menu); the pill is for the screens around it. */}
      {scoliaEnabled && screen !== "game" && <ScoliaStatusBadge state={scolia.state} />}
      <CameraImages images={cameraImages} />
      <GameScreen
        thrower={thrower}
        throwerTeam={throwerTeam}
        throwerStood={!!activePlayer && rewound === null && stoodByTeam[activePlayer] === true}
        throwerRun={throwerRun}
        throwerAnimate={fxLevel !== "normal"}
        recordChase={recordChaseNow}
        fxHeat={fx.heat}
        fxShake={fx.shake}
        fxFire={fx.fire}
        odds={showOdds ? odds : null}
        kits={kits}
        choiceInteractive={!botIsThrowing}

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
        awaitingTakeoutToConfirm={turnActionCount > 0 && dartsThisTurn >= DARTS_PER_TURN && !awaitingConfirmResolution && !exactEntry}
        pendingChoice={rewound === null ? pendingAmbiguous[pendingAmbiguous.length - 1] ?? null : null}
        pendingChoices={rewound === null ? pendingAmbiguous : []}
        awaitingConfirmResolution={awaitingConfirmResolution}
        hitPulse={hitPulse}
        closedStep={closedStep}
        perfectCloses={perfectCloses}
        onResolvePendingChoice={resolvePendingChoice}
        standQuestion={standQuestion}
        onSwitchThrower={switchThrower}
        standAvailable={Object.values(teamRosters).some((r) => r.length > 1)}
        standOn={hasStandRule(variant)}
        onToggleStand={toggleStandRule}
        onAnswerStand={answerStandQuestion}
        // A mark added or taken away while the question is up changes what it is asking about.
        exactEntry={exactEntry}
        onEnterDart={botIsThrowing ? () => {} : enterDartFromUi}
        onRegisterHit={
          botIsThrowing || exactEntry
            ? () => {}
            : (s) => {
                setStandQuestion(false);
                registerHitFromUi(s);
              }
        }
        onRemoveHit={
          botIsThrowing || exactEntry
            ? () => {}
            : (s) => {
                setStandQuestion(false);
                removeHitFromUi(s);
              }
        }
        onUndo={botIsThrowing ? () => {} : undo}
        onConfirm={botIsThrowing ? () => {} : confirm}
        onAbort={abortGame}
      />
      {tripleCelebration && <TripleCelebration images={cameraImages} onDismiss={() => setTripleCelebration(false)} />}
    </>
  );
}
