import { STEPS, aggregateTurns, type TurnResult } from "./game";
import type { HitStat, MemberStat } from "./playerRows";
import { throwerStats } from "./turnStats";

export function emptyMemberStat(): MemberStat {
  const steps = {} as Record<(typeof STEPS)[number], HitStat>;
  STEPS.forEach((s) => (steps[s] = { hits: 0, misses: 0 }));
  return { matches: 0, turns: 0, darts: 0, hits: 0, misses: 0, steps, bestRun: 0, throws: 0, sumR: 0 };
}

/**
 * What each person on a team did in one finished match: the turns they threw, read off the team's
 * own turn log (every turn there says who threw it), and their measured distances from Scolia.
 * A member who threw nothing is left out.
 */
export function memberDeltas(turns: readonly (TurnResult | undefined)[], members: readonly string[], byMember?: Record<string, { throws: number; sumR: number }>): Record<string, MemberStat> {
  const out: Record<string, MemberStat> = {};
  for (const name of members) {
    const mine = turns.filter((t): t is TurnResult => !!t && t.thrower === name);
    if (mine.length === 0) continue;
    const agg = aggregateTurns(mine);
    const base = emptyMemberStat();
    STEPS.forEach((s) => (base.steps[s] = { hits: agg.hitsByStep[s] ?? 0, misses: agg.missesByStep[s] ?? 0 }));
    out[name] = {
      ...base,
      matches: 1,
      turns: mine.length,
      darts: agg.darts,
      hits: agg.hits,
      misses: agg.misses,
      bestRun: (throwerStats(mine, name)[0]?.bestRun ?? 0) * 3,
      throws: byMember?.[name]?.throws ?? 0,
      sumR: byMember?.[name]?.sumR ?? 0,
    };
  }
  return out;
}

/** Adds a match to a team's running totals per member. Pure: returns the new totals. */
export function mergeMemberStats(existing: Record<string, MemberStat> | undefined, delta: Record<string, MemberStat>): Record<string, MemberStat> {
  const out: Record<string, MemberStat> = { ...(existing ?? {}) };
  for (const [name, d] of Object.entries(delta)) {
    const e = out[name] ?? emptyMemberStat();
    const steps = {} as MemberStat["steps"];
    STEPS.forEach((s) => (steps[s] = { hits: (e.steps[s]?.hits ?? 0) + d.steps[s].hits, misses: (e.steps[s]?.misses ?? 0) + d.steps[s].misses }));
    out[name] = {
      matches: e.matches + d.matches,
      turns: e.turns + d.turns,
      darts: e.darts + d.darts,
      hits: e.hits + d.hits,
      misses: e.misses + d.misses,
      steps,
      bestRun: Math.max(e.bestRun, d.bestRun),
      throws: e.throws + d.throws,
      sumR: e.sumR + d.sumR,
    };
  }
  return out;
}

export const memberHitPct = (m: MemberStat): number | null => (m.hits + m.misses === 0 ? null : Math.round((m.hits / (m.hits + m.misses)) * 100));
export const memberMed = (m: MemberStat): number | null => (m.throws === 0 ? null : m.sumR / m.throws);
