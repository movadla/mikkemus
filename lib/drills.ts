/**
 * The drills of the training room: each has a level from 1 to 100 that gets harder as it goes up, and one is passed or not each time it is
 * thrown. A pass takes the drill a level up, and the room sets how far: every step of the room lets the player train ten levels further. The
 * level of a drill is its own (a count of what the player has mastered); only the treble 20 (lib/training.ts) also moves the level the
 * opponents are set from, since it is the one that measures how wide the player throws.
 *
 * Two kinds of drill make the foundation: "score" (rounds of three darts that are written in, passed by the average) and "hits" (a number of
 * darts at one target, passed by how many of them hit). Further drills (a leg of 501 against the clock, a round of Mikke Mus) are another
 * kind to add here, with the same level, cap and pass.
 */
import type { Career } from "./career";
import { book } from "./ledger";
import { climbPay, dailyPay } from "./gear";
import { trainCareer } from "./training";

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 100;

export type DrillId = "t20" | "tre20" | "bull9";

export type DrillProgress = { level: number; passes: number; tries: number };

type Base = { id: DrillId; name: string };
export type ScoreDrill = Base & { kind: "score"; rounds: number };
export type HitsDrill = Base & { kind: "hits"; target: string; /** Darts in one attempt. */ darts: number };
export type Drill = ScoreDrill | HitsDrill;

export const DRILLS: Drill[] = [
  { id: "t20", name: "Trippel 20", kind: "score", rounds: 15 },
  { id: "tre20", name: "Tre 20 på tre piler", kind: "hits", target: "20", darts: 3 },
  { id: "bull9", name: "Bull på ni piler", kind: "hits", target: "bull", darts: 9 },
];

/** The step of the room a drill is opened at: the treble 20 from the start, the others as the room is built. */
export const UNLOCK_ROOM: Record<DrillId, number> = { t20: 0, tre20: 1, bull9: 3 };

/** Whether the room has opened a drill. */
export const isDrillOpen = (career: Career, id: DrillId) => career.room >= UNLOCK_ROOM[id];

export const drillOf = (id: DrillId): Drill => DRILLS.find((d) => d.id === id) ?? DRILLS[0];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far the room lets a drill go: ten levels for each step of it. */
export const levelCap = (room: number) => clamp((room + 1) * 10, 10, LEVEL_MAX);

/** The level a drill is at (the first, until it has been thrown). */
export const drillLevel = (career: Career, id: DrillId) => clamp(career.drills?.[id]?.level ?? LEVEL_MIN, LEVEL_MIN, LEVEL_MAX);

/** What a level asks of the player, in numbers. */
export type Goal =
  | { kind: "score"; /** The average of a round that passes it. */ average: number; rounds: number }
  | { kind: "hits"; /** Hits needed in one attempt, out of the darts of it. */ need: number; darts: number; /** Attempts to get there. */ attempts: number };

/** The goal of a drill at a level. At level 1 it is gentle, and at 100 it asks for what a very good thrower does on a good day. */
export function goalOf(id: DrillId, level: number): Goal {
  const d = drillOf(id);
  const t = (clamp(level, LEVEL_MIN, LEVEL_MAX) - 1) / (LEVEL_MAX - 1);
  if (d.kind === "score") return { kind: "score", average: Math.round((20 + 55 * t) * 10) / 10, rounds: d.rounds };
  if (id === "tre20") return { kind: "hits", need: 3, darts: d.darts, attempts: Math.max(1, Math.round(10 - 9 * t)) };
  return { kind: "hits", need: clamp(Math.round(1 + 8 * Math.pow(t, 1.2)), 1, d.darts), darts: d.darts, attempts: 3 };
}

/** The goal in one line, for the list and for the top of the drill. */
export function goalLine(id: DrillId, level: number): string {
  const g = goalOf(id, level);
  if (g.kind === "score") return `Snitt ${g.average} per runde`;
  const d = drillOf(id) as HitsDrill;
  const what = d.target === "bull" ? "bull" : d.target;
  return `${g.need} ${what} på ${g.darts} piler · ${g.attempts} forsøk`;
}

/** What a drill that has been thrown shows: the rounds of a score drill, or the hits of each attempt of a hits drill. */
export type DrillResult = { id: DrillId; level: number; scores: number[] };

/** Whether a drill was passed at the level it was thrown. */
export function passed(r: DrillResult): boolean {
  const g = goalOf(r.id, r.level);
  if (g.kind === "score") return r.scores.length >= g.rounds && r.scores.slice(0, g.rounds).reduce((s, x) => s + x, 0) / g.rounds >= g.average;
  return r.scores.slice(0, g.attempts).some((hits) => hits >= g.need);
}

/** The reward for the drill of the day (a coach can double it: dailyReward). */
export const DAILY_REWARD = 100;
export const dailyReward = (career: Career) => dailyPay(career, DAILY_REWARD);

const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The ladder of training: a hundred levels, each passed by making enough with three darts. Each level that is passed pays once. */
export const CLIMB_MAX = 100;
export const CLIMB_REWARD = 50;
/** What a level pays this player (a coach can double it). */
export const climbReward = (career: Career) => climbPay(career, CLIMB_REWARD);

/** What three darts must make to pass a level: 40 at the first, and the most there is (180) at the hundredth. */
export const climbTarget = (level: number) => Math.round(40 + 140 * ((clamp(level, 1, CLIMB_MAX) - 1) / (CLIMB_MAX - 1)));

/** The level the player is on (101 when all of them are passed). */
export const climbLevel = (career: Career) => clamp(career.climb?.level ?? 1, 1, CLIMB_MAX + 1);

/** Whether the level can be tried now: the room lets the player climb ten levels for each of its steps. */
export const climbOpen = (career: Career) => climbLevel(career) <= Math.min(CLIMB_MAX, levelCap(career.room));

/** Three darts have made this much: when it is enough for the level, the player moves up and is paid for it. */
export function applyClimb(career: Career, score: number): Career {
  if (!climbOpen(career) || score < climbTarget(climbLevel(career))) return career;
  const pay = climbReward(career);
  return book({ ...career, money: career.money + pay, climb: { level: climbLevel(career) + 1 } }, "training", `Stigen, nivå ${climbLevel(career)}`, pay);
}

/** The drill of a day: one of those the room has opened, the same for the whole day. */
export function dailyDrill(career: Career, day: string): DrillId {
  const open = DRILLS.filter((d) => isDrillOpen(career, d.id));
  return open[hashOf(`${career.id}|${day}`) % open.length].id;
}

/** The day before a day, as a date. */
const dayBefore = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** What the daily drill is today: which one, whether it is done, and the streak the player is on (a streak lives until a day is missed). */
export function dailyOf(career: Career, day: string): { id: DrillId; done: boolean; streak: number } {
  const d = career.daily;
  const alive = d && (d.last === day || d.last === dayBefore(day)) ? d.streak : 0;
  return { id: dailyDrill(career, day), done: d?.last === day, streak: alive };
}

/** A drill has been thrown: it counts as a try, a pass takes it a level up (as far as the room allows), and the treble 20 also moves the level of the career. */
export function applyDrill(career: Career, r: DrillResult, now: string): Career {
  const d = drillOf(r.id);
  const was = career.drills?.[r.id] ?? { level: LEVEL_MIN, passes: 0, tries: 0 };
  const ok = passed(r);
  const level = ok ? Math.max(was.level, Math.min(levelCap(career.room), LEVEL_MAX, r.level + 1)) : was.level;
  const base = d.kind === "score" ? trainCareer(career, r.scores, now) : career;
  const next = { ...base, drills: { ...(base.drills ?? {}), [r.id]: { level, passes: was.passes + (ok ? 1 : 0), tries: was.tries + 1 } } };
  // The drill of the day, passed for the first time that day: a streak day, and the reward.
  const day = now.slice(0, 10);
  const today = dailyOf(career, day);
  const pay = dailyReward(career);
  if (ok && !today.done && today.id === r.id) return book({ ...next, money: next.money + pay, daily: { day, done: true, streak: today.streak + 1, last: day } }, "training", "Dagens øvelse", pay);
  return next;
}
