import { STEPS, aggregateTurns, type Step, type TurnResult } from "./game";

/** Forsøk per rad: the crosses and the misses that belonged to each row, from the turn log. */
export function rowCosts(turns: TurnResult[]): Record<Step, number> {
  const out = {} as Record<Step, number>;
  STEPS.forEach((s) => (out[s] = 0));
  // Turns that know their darts per row use them: a triple that closes a row is one dart there, and a dart left on a
  // double or triple while another number was being worked is not an attempt at that number. The rest (older or manual
  // turns) fall back to crosses plus misses.
  const old = turns.filter((t) => t && !t.dartsByStep);
  for (const t of turns) {
    if (!t?.dartsByStep) continue;
    for (const s of STEPS) out[s] += t.dartsByStep[s] ?? 0;
  }
  const agg = aggregateTurns(old);
  STEPS.forEach((s) => (out[s] += (agg.hitsByStep[s] ?? 0) + (agg.missesByStep[s] ?? 0)));
  return out;
}
