/**
 * What each person made in a game, kept with its match in Kveldsscore: the numbers the evening's statistics are worked out from. It is per person
 * (the member who threw, in a team), so that a game of teams has them too. A series adds its games together.
 */
import type { CountdownGame } from "./countdown";
import type { HalvItGame } from "./halvit";
import { stateOf as halvitState } from "./halvit";
import type { HighstrikerGame } from "./highstriker";
import { stateOf as killerState, type KillerGame } from "./killer";
import { stateOf as lavaState, type LavaGame } from "./lava";

export type Fig = {
  darts: number;
  /** 301/501: what came off the number. Highstriker: the sum of the rounds. Halv It: the points made. */
  points: number;
  rounds: number;
  /** The best round (301/501 and Highstriker). */
  best: number;
  /** Rounds of 100 or more, and rounds of 180 (301/501). */
  tons: number;
  s180: number;
  /** Sections set on fire (Lava). */
  burned: number;
  /** Lives lost (Highstriker, Lava, Killer), and halvings (Halv It). */
  lostLives: number;
  /** Players taken out (Killer). */
  kills: number;
  /** The highest finish (301/501). */
  finish: number;
};
export type FigureSet = Record<string, Fig>;

const none = (): Fig => ({ darts: 0, points: 0, rounds: 0, best: 0, tons: 0, s180: 0, burned: 0, lostLives: 0, kills: 0, finish: 0 });
const of = (set: FigureSet, who: string): Fig => (set[who] ??= none());

export function countdownFigures(g: CountdownGame, winner: string | null): FigureSet {
  const set: FigureSet = {};
  g.turns.forEach((t, i) => {
    const f = of(set, t.by ?? t.player);
    f.darts += t.darts;
    f.rounds += 1;
    if (t.bust) return;
    f.points += t.scored;
    f.best = Math.max(f.best, t.scored);
    if (t.scored >= 100) f.tons += 1;
    if (t.scored === 180) f.s180 += 1;
    if (winner && i === g.turns.length - 1) f.finish = t.scored;
  });
  return set;
}

export function highstrikerFigures(g: HighstrikerGame): FigureSet {
  const set: FigureSet = {};
  for (const t of g.turns) {
    const f = of(set, t.by ?? t.player);
    f.darts += 3;
    f.rounds += 1;
    f.points += t.scored;
    f.best = Math.max(f.best, t.scored);
    if (t.lostLife) f.lostLives += 1;
  }
  return set;
}

export function lavaFigures(g: LavaGame): FigureSet {
  const set: FigureSet = {};
  for (const d of lavaState(g).log) {
    const f = of(set, d.by ?? d.player);
    f.darts += 1;
    if (d.outcome === "burn") f.burned += 1;
    if (d.outcome === "lava") f.lostLives += 1;
  }
  return set;
}

export function halvitFigures(g: HalvItGame): FigureSet {
  const set: FigureSet = {};
  for (const t of halvitState(g).log) {
    const f = of(set, t.by ?? t.player);
    f.darts += 1;
    if (t.after > t.before) f.points += t.after - t.before;
    if (t.halved) f.lostLives += 1;
  }
  return set;
}

export function killerFigures(g: KillerGame): FigureSet {
  const set: FigureSet = {};
  for (const d of killerState(g).log) {
    const f = of(set, d.by ?? d.player);
    f.darts += 1;
    if (d.effect === "kill") f.kills += 1;
  }
  return set;
}

/** The games of a series as one: what is counted adds up, what is best is the best. */
export function mergeFigures(sets: FigureSet[]): FigureSet {
  const out: FigureSet = {};
  for (const set of sets)
    for (const [who, f] of Object.entries(set)) {
      const o = of(out, who);
      o.darts += f.darts;
      o.points += f.points;
      o.rounds += f.rounds;
      o.tons += f.tons;
      o.s180 += f.s180;
      o.burned += f.burned;
      o.lostLives += f.lostLives;
      o.kills += f.kills;
      o.best = Math.max(o.best, f.best);
      o.finish = Math.max(o.finish, f.finish);
    }
  return out;
}
