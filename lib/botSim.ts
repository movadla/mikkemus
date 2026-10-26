import type { TurnAggregate } from "./game";
import { emptyProgress, totalMarks } from "./game";
import { botSetupForMatch, unit } from "./botCup";
import type { BotLevel, TeamMember } from "./botLevels";
import { sigmaForLevel } from "./botStrategy";
import { finishCdf, stateOf } from "./odds/forward";
import { modelFor, type RuleSet } from "./odds/model";
import { raceWinProbs } from "./odds/winProb";
import { RULES, baseOf } from "./rules";
import { isHouse, recordKnockoutResult } from "./knockout";
import type { Participant, Tournament, TournamentMatch } from "./tournament";

/**
 * Matches the house is not in. In a cup, two bots meeting is not worth sitting through: it is decided here, with the same model
 * the win chances are made from, at the levels those bots would have thrown at in that match (lib/botCup.ts), and recorded like
 * any other result so the bracket moves on. The same match always gives the same result, so a reload cannot change it.
 */

export function ruleSetOf(t: Tournament): RuleSet {
  const base = RULES[baseOf(t.variant ?? "standard")];
  return { target: base.target, ringChoice: base.ringOnOwnNumberIsChoice };
}

/** How long one side needs to finish, in its own turns, as the chance of being done within t turns. A team takes a turn each in turn. */
function cdfOf(rules: RuleSet, levels: BotLevel[]): Float64Array {
  const models = levels.map((l) => modelFor(rules, sigmaForLevel(l)));
  return finishCdf({ start: stateOf(models[0], emptyProgress()), models });
}

function levelsOf(p: Participant, botLevels: Record<string, BotLevel>, rosters: Record<string, TeamMember[]>): BotLevel[] {
  const roster = rosters[p.name];
  if (roster && roster.length > 0) return roster.map((m) => m.botLevel ?? "4");
  return [botLevels[p.name] ?? p.botLevel ?? "4"];
}

/** The chance a beats b, with whoever throws first averaged out. */
export function winChanceOf(a: Float64Array, b: Float64Array): number {
  const ab = raceWinProbs([a, b])[0];
  const ba = raceWinProbs([b, a])[1];
  return (ab + ba) / 2;
}

/** The turn a side finishes on, drawn from its distribution with `u` in [0, 1). */
function turnFrom(cdf: Float64Array, u: number): number {
  for (let t = 1; t < cdf.length; t++) if (cdf[t] >= u) return t;
  return cdf.length - 1;
}

export type SimulatedResult = { placements: string[]; stats: Record<string, TurnAggregate>; chanceA: number };

/** The result of a match between two bots (or two sides of bots): who wins, and numbers that look like the match they played. */
export function simulateMatch(t: Tournament, match: TournamentMatch): SimulatedResult | null {
  const [pa, pb] = [t.participants.find((p) => p.name === match.participantA), t.participants.find((p) => p.name === match.participantB)];
  if (!pa || !pb) return null;
  const { botLevels, teamRosters } = botSetupForMatch(t, match);
  const rules = ruleSetOf(t);
  const cdfA = cdfOf(rules, levelsOf(pa, botLevels, teamRosters));
  const cdfB = cdfOf(rules, levelsOf(pb, botLevels, teamRosters));
  const chanceA = winChanceOf(cdfA, cdfB);
  const seed = t.cup?.seed ?? 0;
  const aWins = unit(`${seed}|sim|${match.id}|winner`) < chanceA;
  const [winner, loser] = aWins ? [pa.name, pb.name] : [pb.name, pa.name];
  const winCdf = aWins ? cdfA : cdfB;
  // The winner finishes on its turn, and the loser has had as many turns (one fewer when it throws second).
  const winTurns = turnFrom(winCdf, unit(`${seed}|sim|${match.id}|turns`));
  const loseTurns = Math.max(1, winTurns - (unit(`${seed}|sim|${match.id}|second`) < 0.5 ? 1 : 0));
  const marks = totalMarks();
  const make = (turns: number, finished: boolean, who: string): TurnAggregate => {
    const darts = finished ? turns * 3 - Math.floor(unit(`${seed}|sim|${match.id}|${who}|last`) * 3) : turns * 3;
    const hits = finished ? marks : Math.max(1, Math.round(marks * (0.55 + 0.4 * unit(`${seed}|sim|${match.id}|${who}|hits`))));
    return { hits, misses: Math.max(0, darts - Math.round(hits / 1.15)), darts, hitsByStep: {}, missesByStep: {} };
  };
  return {
    placements: [winner, loser],
    stats: { [winner]: make(winTurns, true, winner), [loser]: make(loseTurns, false, loser) },
    chanceA,
  };
}

/** Whether the model may decide this match: a cup, and nobody of the house in it. */
export function isSimulable(t: Tournament, match: TournamentMatch): boolean {
  if (!t.cup || match.winner || !match.participantA || !match.participantB) return false;
  return [match.participantA, match.participantB].every((n) => {
    const p = t.participants.find((x) => x.name === n);
    return !!p && !isHouse(p);
  });
}

/**
 * Decides the matches nobody of the house plays in, as far as the cup has got: those in the round the house is playing in now, or
 * an earlier one. A bot half of the bracket is not played out ahead of the house. When no one of the house has a match left,
 * everything that remains is decided. Returns the tournament and the matches it decided, in order.
 */
export function playElsewhere(t: Tournament): { tournament: Tournament; decided: string[] } {
  let cur = t;
  const decided: string[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const ready = cur.matches.filter((m) => !m.winner && !!m.participantA && !!m.participantB);
    const human = ready.find((m) => !isSimulable(cur, m));
    const limit = human ? human.bracketRoundSize ?? 1 : 0;
    const m = ready.find((x) => isSimulable(cur, x) && (x.bracketRoundSize ?? 1) >= limit);
    if (!m) break;
    const result = simulateMatch(cur, m);
    if (!result) break;
    cur = recordKnockoutResult(cur, m.id, result.placements, result.stats, { simulated: true });
    decided.push(m.id);
  }
  return { tournament: cur, decided };
}

/** The match to throw next: the first one with someone of the house in it, and only when there is none the first of any. */
export function nextToThrow(t: Tournament): TournamentMatch | null {
  const ready = t.matches.filter((m) => !m.winner && !!m.participantA && !!m.participantB);
  return ready.find((m) => !isSimulable(t, m)) ?? ready[0] ?? null;
}
