import type { PickedTeam } from "./people";
import { medOfLevel } from "./opponentStats";

/** One person on a side that is a team in 301/501, Highstriker or Lava: the level of a bot is a MED in mm, which is what the bots throw by. */
export type SideMember = { name: string; isBot: boolean; botLevel?: number };

/** The teams that were picked, as the sides of a game: the names of the teams, and who is on each. The members throw a round each, in turn. */
export function rostersOf(teams: PickedTeam[]): Record<string, SideMember[]> {
  return Object.fromEntries(
    teams.map((t) => [
      t.name,
      // A member's level is a step of the level scale ("4"); the games throw by a MED in mm, so it is turned into one (a bare 4 would be a 4 mm thrower).
      t.members.map((m) => ({ name: m.name, isBot: m.isBot, ...(m.isBot ? { botLevel: medOfLevel(Number(m.botLevel ?? 4)) } : {}) })),
    ]),
  );
}
