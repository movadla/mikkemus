/**
 * The statistics of a career: one line for every match the player has thrown in a tournament, kept with the career (the history only has the
 * tournaments). From them the profile shows what darts players look at: the average, the best round, the 180s and the highest checkout in 301
 * and 501, and the hit rate in Mikke Mus.
 */
import type { Career } from "./career";
import { matchParticipants, type Tournament } from "./tournament";

export type MatchLine = { at: string; won: boolean; darts: number; hits?: number; misses?: number; rounds?: number[]; checkout?: number };

const KEEP = 80;

/** The matches of a tournament the side played (not the ones decided by the model, not a walkover), as lines for the statistics. */
export function matchLines(t: Tournament, side: string, at: string): MatchLine[] {
  return t.matches
    .filter((m) => !m.isBye && !m.simulated && m.winner && m.stats?.[side] && matchParticipants(m).includes(side))
    .map((m) => {
      const s = m.stats![side];
      return { at, won: m.winner === side, darts: s.darts, ...(s.rounds ? { rounds: s.rounds, ...(s.checkout ? { checkout: s.checkout } : {}) } : { hits: s.hits, misses: s.misses }) };
    });
}

/** Adds the lines of a finished tournament to the career's own. */
export const withLines = (career: Career, lines: MatchLine[]): Career => (lines.length ? { ...career, log: [...(career.log ?? []), ...lines].slice(-KEEP) } : career);

export type StatsSummary = {
  matches: number;
  won: number;
  /** 301 and 501: the average of three darts over the last ten matches, the best round, the 180s and the highest checkout. */
  countdown?: { average: number; best: number; max180: number; checkout: number };
  /** Mikke Mus: how many of the darts hit, in per cent, and the darts used in a match. */
  mm?: { hitRate: number; darts: number };
};

export function statsOf(career: Career): StatsSummary {
  const log = career.log ?? [];
  const cd = log.filter((l) => l.rounds);
  const mm = log.filter((l) => !l.rounds && l.hits !== undefined);
  const out: StatsSummary = { matches: log.length, won: log.filter((l) => l.won).length };
  if (cd.length) {
    const last = cd.slice(-10);
    const scored = last.reduce((s, l) => s + l.rounds!.reduce((a, b) => a + b, 0), 0);
    const darts = last.reduce((s, l) => s + l.darts, 0);
    const all = cd.flatMap((l) => l.rounds!);
    out.countdown = { average: darts ? Math.round((scored / darts) * 30) / 10 : 0, best: Math.max(0, ...all), max180: all.filter((r) => r === 180).length, checkout: Math.max(0, ...cd.map((l) => l.checkout ?? 0)) };
  }
  if (mm.length) {
    const hits = mm.reduce((s, l) => s + (l.hits ?? 0), 0);
    const misses = mm.reduce((s, l) => s + (l.misses ?? 0), 0);
    out.mm = { hitRate: hits + misses ? Math.round((hits / (hits + misses)) * 100) : 0, darts: Math.round(mm.reduce((s, l) => s + l.darts, 0) / mm.length) };
  }
  return out;
}
