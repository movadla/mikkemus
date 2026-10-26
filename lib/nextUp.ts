import { botSetupForMatch } from "./botCup";
import { ruleSetOf } from "./botSim";
import { sigmaForLevel } from "./botStrategy";
import type { PlayerRecord } from "./playerRows";
import { entrantInputs } from "./seedingTable";
import { entrantFromSigmas, matchChance } from "./tournamentOdds";
import type { Tournament, TournamentMatch } from "./tournament";

/**
 * The chance that the first side of a match wins it, for the card before the match: the people from their records, a bot from the
 * level it will throw at in this very match. Null when a side of the match is not known yet.
 */
export function winChanceFor(t: Tournament, match: TournamentMatch, records: PlayerRecord[]): number | null {
  const [pa, pb] = [t.participants.find((p) => p.name === match.participantA), t.participants.find((p) => p.name === match.participantB)];
  if (!pa || !pb) return null;
  const rules = ruleSetOf(t);
  const { botLevels, teamRosters } = botSetupForMatch(t, match);
  const people = new Map(entrantInputs(records, rules, "player").map((e) => [e.name.trim().toLowerCase(), e.sigmas[0]]));
  const fallback = [sigmaForLevel("4")];
  const sigmasOf = (name: string, isBot: boolean, level?: string): number[] => (isBot ? [sigmaForLevel((level ?? "4") as never)] : people.get(name.trim().toLowerCase()) ?? fallback);
  const entrantOf = (p: typeof pa) => {
    const roster = teamRosters[p.name];
    const members = roster && roster.length > 0 ? roster.map((m) => sigmasOf(m.name, m.isBot, m.botLevel)) : [sigmasOf(p.name, p.isBot, botLevels[p.name] ?? p.botLevel)];
    return entrantFromSigmas(p.name, members, rules);
  };
  return matchChance(entrantOf(pa), entrantOf(pb));
}
