/**
 * Training at home: a drill the player throws for real and writes in, which moves their level in the career. The level is what the opponents
 * are set from (lib/career.ts), so the career follows how the player really throws, and it is the only thing that does: money buys a better
 * room, never a better throw.
 *
 * The drill is fifteen rounds of three darts at the treble 20, each round's total written in. How much a player scores at it points to how
 * wide they throw (their MED in mm, lower is sharper): EXPECTED is what a thrower of each MED averages, from simulating the bots' own throw
 * (lib/botDarts.ts). Forty-five darts say little by themselves, so one session moves the level a quarter of the way to what it shows, and at
 * most three mm; it takes a few sessions to settle, and one lucky or poor session does not throw the career off.
 */
import type { Career, TrainingSession } from "./career";

export const DRILL_ROUNDS = 15;

/** Round averages at the treble 20 for a thrower of this MED (mm), 60 000 simulated darts each. */
export const EXPECTED: [number, number][] = [[20, 61.7], [25, 51.7], [30, 45.8], [35, 42.4], [40, 39.8], [45, 38.1], [50, 36.5], [55, 35.2], [60, 34.1], [65, 32.9], [70, 31.7], [75, 30.9]];

/** The sharpest and the weakest level a career can have. */
export const MED_MIN = 20;
export const MED_MAX = 70;

const MAX_MOVE = 3;
const WEIGHT = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

/** What a thrower of this MED averages per round at the treble 20. */
export function expectedAverage(med: number): number {
  const m = clamp(med, EXPECTED[0][0], EXPECTED[EXPECTED.length - 1][0]);
  for (let i = 1; i < EXPECTED.length; i++) {
    const [m0, a0] = EXPECTED[i - 1];
    const [m1, a1] = EXPECTED[i];
    if (m <= m1) return a0 + ((a1 - a0) * (m - m0)) / (m1 - m0);
  }
  return EXPECTED[EXPECTED.length - 1][1];
}

/** The MED an average round points to: the other way round, from the table. A better average than the table has is the sharpest, a worse one the weakest. */
export function medFromAverage(average: number): number {
  const top = EXPECTED[0];
  const bottom = EXPECTED[EXPECTED.length - 1];
  if (average >= top[1]) return top[0];
  if (average <= bottom[1]) return bottom[0];
  for (let i = 1; i < EXPECTED.length; i++) {
    const [m0, a0] = EXPECTED[i - 1];
    const [m1, a1] = EXPECTED[i];
    if (average >= a1) return m0 + ((average - a0) * (m1 - m0)) / (a1 - a0);
  }
  return bottom[0];
}

export const averageOf = (rounds: number[]) => (rounds.length === 0 ? 0 : rounds.reduce((s, r) => s + r, 0) / rounds.length);

/** The session a set of rounds makes, from the level the career has now. */
export function sessionFrom(career: Career, rounds: number[], now: string): TrainingSession {
  const average = oneDecimal(averageOf(rounds));
  const measured = oneDecimal(medFromAverage(average));
  const move = clamp((measured - career.skillMed) * WEIGHT, -MAX_MOVE, MAX_MOVE);
  const after = oneDecimal(clamp(career.skillMed + move, MED_MIN, MED_MAX));
  return { at: now, average, measured, before: career.skillMed, after };
}

/** A session is thrown: the level moves, and the session is kept (the last ten). Not a full drill is not counted. */
export function trainCareer(career: Career, rounds: number[], now: string): Career {
  if (rounds.length < DRILL_ROUNDS) return career;
  const session = sessionFrom(career, rounds.slice(0, DRILL_ROUNDS), now);
  return { ...career, skillMed: session.after, training: [session, ...career.training].slice(0, 10) };
}
