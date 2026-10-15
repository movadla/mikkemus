import { STEPS } from "./game";
import type { PlayerRecord, RecordKind, RingHits } from "./playerRows";

/**
 * Two records that are the same side — a team entered twice under two names, say — folded into
 * one. Every running total is a sum, the best finish is the lower of the two, the history is the
 * two histories in date order, and the photo and sound come from whichever has them (the first
 * wins when both do). The name, kind and members are given, not inherited, because the point of
 * merging is usually to end up under a new name.
 */
export function mergeRecords(records: PlayerRecord[], into: { name: string; kind: RecordKind; members?: string[] }): PlayerRecord {
  if (records.length === 0) throw new Error("ingenting å slå sammen");
  const sumRing = (a: RingHits, b: RingHits): RingHits => {
    const out = { ...a };
    for (const [num, count] of Object.entries(b)) out[num] = (out[num] ?? 0) + count;
    return out;
  };
  const merged = records.reduce((acc, r) => ({
    ...acc,
    photo: acc.photo ?? r.photo,
    sound: acc.sound ?? r.sound,
    matchesPlayed: acc.matchesPlayed + r.matchesPlayed,
    matchesWon: acc.matchesWon + r.matchesWon,
    dartsInWins: acc.dartsInWins + r.dartsInWins,
    bestDartsToFinish:
      acc.bestDartsToFinish === null ? r.bestDartsToFinish : r.bestDartsToFinish === null ? acc.bestDartsToFinish : Math.min(acc.bestDartsToFinish, r.bestDartsToFinish),
    overall: { hits: acc.overall.hits + r.overall.hits, misses: acc.overall.misses + r.overall.misses },
    steps: STEPS.reduce(
      (s, step) => ({ ...s, [step]: { hits: acc.steps[step].hits + r.steps[step].hits, misses: acc.steps[step].misses + r.steps[step].misses } }),
      acc.steps,
    ),
    accuracy: {
      sumDistance: acc.accuracy.sumDistance + r.accuracy.sumDistance,
      sumHorizontal: acc.accuracy.sumHorizontal + r.accuracy.sumHorizontal,
      sumVertical: acc.accuracy.sumVertical + r.accuracy.sumVertical,
      throws: acc.accuracy.throws + r.accuracy.throws,
    },
    luck: STEPS.reduce((l, step) => ({ ...l, [step]: { sum: acc.luck[step].sum + r.luck[step].sum, count: acc.luck[step].count + r.luck[step].count } }), acc.luck),
    bullDuel: {
      throws: acc.bullDuel.throws + r.bullDuel.throws,
      points: acc.bullDuel.points + r.bullDuel.points,
      redHits: acc.bullDuel.redHits + r.bullDuel.redHits,
      greenHits: acc.bullDuel.greenHits + r.bullDuel.greenHits,
      luckSum: acc.bullDuel.luckSum + r.bullDuel.luckSum,
      luckCount: acc.bullDuel.luckCount + r.bullDuel.luckCount,
    },
    tripleHits: sumRing(acc.tripleHits, r.tripleHits),
    doubleHits: sumRing(acc.doubleHits, r.doubleHits),
    matchHistory: [...acc.matchHistory, ...r.matchHistory],
  }));
  return {
    ...merged,
    name: into.name.trim(),
    kind: into.kind,
    ...(into.kind === "team" ? { members: into.members ?? [] } : {}),
    matchHistory: [...merged.matchHistory].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
