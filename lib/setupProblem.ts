import { toNamedTeam, type PickedTeam } from "./people";
import { teamNameProblems } from "./teamNames";

/**
 * The one reason a setup cannot start yet, or null when it can — for the line above the Start
 * button. One reason, because the player is standing at the board and reads one line; a sentence
 * listing every rule that could ever apply says less than the thing that is actually wrong right
 * now. Everyone on a picked team is on exactly one, by construction (see TeamPicker), so the
 * reasons left are few.
 */
export function teamSetupProblem(teams: PickedTeam[], botsAllowed: boolean, minimum = 2): string | null {
  if (!botsAllowed && teams.some((t) => t.members.some((m) => m.isBot))) return "Fjern botene, eller velg 1–3 kryss";
  if (teams.length < minimum) {
    const missing = minimum - teams.length;
    return teams.length === 0 ? `Velg ${minimum} lag` : `Velg ${missing} lag til`;
  }
  const nameProblem = teamNameProblems(teams.map(toNamedTeam)).find((p) => p !== null);
  if (nameProblem) return nameProblem;
  return null;
}

export function individualSetupProblem(players: string[], botBlocked: boolean, minimum = 1): string | null {
  if (botBlocked) return "Fjern botene, eller velg 1–3 kryss";
  if (players.length < minimum) return minimum === 1 ? "Velg spillere" : `Velg ${minimum - players.length} til`;
  return null;
}

/** "3 spillere · 3 kryss" — what the Start button is about to start. */
export function setupSummary(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p).join(" · ");
}
