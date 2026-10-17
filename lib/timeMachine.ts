import { STEPS, type Step, type TurnResult } from "./game";
import { finishState } from "./finishState";
import type { OddsSnapshot } from "./oddsLog";

/** The board and the odds after some number of turns, for stepping through a finished match. */
export type TimeFrame = {
  /** Turns played so far: 0 is before the first dart. */
  turn: number;
  /** Who the turn that led here belonged to (a team's name), and the person who threw it. Null at turn 0. */
  side: string | null;
  thrower: string | null;
  /** Crosses that turn gained. */
  gain: number;
  progress: Record<string, Record<Step, number>>;
  /** Crosses on the board per side, capped at what each row takes. */
  total: Record<string, number>;
  /** The chance each side had of winning, when the odds were kept; the last frame is the result. */
  chance: Record<string, number> | null;
};

export type TimeEvent = { turn: number; kind: "big" | "lead" | "matchdart" | "win"; text: string };

const zero = (): Record<Step, number> => {
  const p = {} as Record<Step, number>;
  STEPS.forEach((s) => (p[s] = 0));
  return p;
};

/** The side that is clearly ahead, or null while it is level. */
function leader(total: Record<string, number>): string | null {
  const entries = Object.entries(total).sort((a, b) => b[1] - a[1]);
  if (entries.length < 2 || entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

/**
 * Rebuilds a finished match turn by turn from what was kept: every side's confirmed turns (the
 * crosses each one gained) and what the odds said at the start of each turn. Sides throw in turn,
 * round after round, so the n-th turn of every side is one round. The big moments are found from the
 * frames: a big turn, the lead changing hands, a side one row from winning, and the win itself.
 */
export function buildTimeline(args: {
  players: string[];
  turnLog: Record<string, (TurnResult | undefined)[]>;
  snapshots: OddsSnapshot[];
  target: number;
  winner: string;
}): { frames: TimeFrame[]; events: TimeEvent[] } {
  const { players, turnLog, snapshots, target, winner } = args;
  const per = players.map((p) => (turnLog[p] ?? []).filter((t): t is TurnResult => !!t));
  const rounds = Math.max(0, ...per.map((x) => x.length));

  const progress: Record<string, Record<Step, number>> = {};
  players.forEach((p) => (progress[p] = zero()));
  const totalOf = () => Object.fromEntries(players.map((p) => [p, STEPS.reduce((s, st) => s + Math.min(target, progress[p][st]), 0)]));
  const snap = (progressNow: typeof progress) => Object.fromEntries(players.map((p) => [p, { ...progressNow[p] }])) as typeof progress;
  const haveOdds = snapshots.length >= 2;
  const chanceAt = (turn: number): Record<string, number> | null => {
    const s = snapshots[turn];
    if (!haveOdds || !s) return null;
    return Object.fromEntries(s.sides.map((x) => [x.name, x.p]));
  };

  const frames: TimeFrame[] = [{ turn: 0, side: null, thrower: null, gain: 0, progress: snap(progress), total: totalOf(), chance: chanceAt(0) }];
  let turn = 0;
  for (let r = 0; r < rounds; r++) {
    players.forEach((p, j) => {
      const t = per[j][r];
      if (!t) return;
      let gain = 0;
      for (const [step, n] of Object.entries(t.hitsByStep) as [Step, number][]) {
        progress[p][step] = Math.min(target, progress[p][step] + n);
        gain += n;
      }
      turn++;
      frames.push({ turn, side: p, thrower: t.thrower ?? null, gain, progress: snap(progress), total: totalOf(), chance: chanceAt(turn) });
    });
  }
  // The last frame is the result: the winner has won.
  const last = frames[frames.length - 1];
  if (haveOdds && players.includes(winner)) last.chance = Object.fromEntries(players.map((p) => [p, p === winner ? 1 : 0]));

  const events: TimeEvent[] = [];
  const warned = new Set<string>();
  const outSeen = new Set<string>();
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    const prev = frames[i - 1];
    const who = f.thrower ?? f.side ?? "";
    if (f.gain >= 4) events.push({ turn: i, kind: "big", text: `Storrunde: ${who} +${f.gain}` });
    const before = leader(prev.total);
    const now = leader(f.total);
    if (before && now && before !== now) events.push({ turn: i, kind: "lead", text: `Ledelsen bytter til ${now}` });
    for (const p of players) {
      // The same two moments the board announces: the bull is all that is left, or the rest takes one turn.
      const state = finishState(f.progress[p], target);
      if (state === "matchdart" && !warned.has(p)) {
        warned.add(p);
        events.push({ turn: i, kind: "matchdart", text: `Matchdart: ${p}` });
      } else if (state === "out" && !outSeen.has(p) && !warned.has(p)) {
        outSeen.add(p);
        events.push({ turn: i, kind: "matchdart", text: `Out: ${p}` });
      }
    }
  }
  if (frames.length > 1) events.push({ turn: frames.length - 1, kind: "win", text: `Seier: ${winner}` });
  return { frames, events };
}
