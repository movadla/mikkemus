/**
 * The bull-off that settles a tie for a place in Ly Pilotturnering: each of the tied throws three darts at the bull. The outer bull is
 * worth 1 and the bullseye 2; nothing else counts. The most points is first. Still level, the ones who are level throw again, and again,
 * until every place is settled.
 */
export type BullDart = 0 | 1 | 2;

export const bullOffScore = (darts: BullDart[]) => darts.reduce<number>((sum, d) => sum + d, 0);

/** The people who are level for a place: each group of two or more in a row with the same number of crosses missing. The winner (first)
 *  is never in one, and who closed first is not a matter of a tie. */
export function tieGroups(placements: string[], remaining: Record<string, number>): string[][] {
  const groups: string[][] = [];
  let run: string[] = [];
  for (let i = 1; i < placements.length; i++) {
    const name = placements[i];
    if (run.length > 0 && remaining[run[0]] === remaining[name]) run.push(name);
    else {
      if (run.length > 1) groups.push(run);
      run = [name];
    }
  }
  if (run.length > 1) groups.push(run);
  return groups;
}

/** The finishing order with one tied group put in the order the bull-off gave it. */
export function withGroupOrder(placements: string[], group: string[], ordered: string[]): string[] {
  const first = placements.findIndex((n) => group.includes(n));
  const out = [...placements];
  ordered.forEach((n, i) => (out[first + i] = n));
  return out;
}

/** Where a bull-off stands: the places already settled, in order, and the groups still level, in order. */
export type BullOffState = { resolved: string[]; pending: string[][] };

function settle(s: BullOffState): BullOffState {
  const pending = [...s.pending];
  const resolved = [...s.resolved];
  while (pending.length > 0 && pending[0].length === 1) resolved.push(pending.shift()![0]);
  return { resolved, pending };
}

export function startBullOff(group: string[]): BullOffState {
  return settle({ resolved: [], pending: [group] });
}

export const bullOffDone = (s: BullOffState) => s.pending.length === 0;

/** The group that throws now (empty when it is done). */
export function currentGroup(s: BullOffState): string[] {
  return s.pending[0] ?? [];
}

/** The round of the group that is throwing, in points per person: splits it into who is ahead of whom, and what is still level. */
export function applyRound(s: BullOffState, points: Record<string, number>): BullOffState {
  const group = currentGroup(s);
  if (group.length === 0) return s;
  const levels = [...new Set(group.map((n) => points[n] ?? 0))].sort((a, b) => b - a);
  const buckets = levels.map((p) => group.filter((n) => (points[n] ?? 0) === p));
  return settle({ resolved: s.resolved, pending: [...buckets, ...s.pending.slice(1)] });
}

/** Three darts for a bot, from how widely it scatters (sigma, in millimetres, in each direction): the bullseye is 6.35 mm from the middle
 *  and the outer bull 15.9 mm. */
export function simulateBullDarts(sigma: number, rand: () => number = Math.random): BullDart[] {
  return [0, 1, 2].map(() => {
    const r = sigma * Math.sqrt(-2 * Math.log(1 - rand()));
    return r <= 6.35 ? 2 : r <= 15.9 ? 1 : 0;
  });
}
