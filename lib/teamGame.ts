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

/** Who throws after the side that is up: the next side, and for a team the member whose turn it is on it. */
export type NextUp<M extends { name: string }> = { side: string; member: M | null };

/** The member of a side whose round it is, from the rounds the side has thrown (null for a lone player). */
export function memberAfter<M extends { name: string }>(rosters: Record<string, M[]> | undefined, side: string, rounds: number): M | null {
  const roster = rosters?.[side];
  return roster && roster.length > 0 ? roster[rounds % roster.length] : null;
}

/** What to call the next to throw: the member of a team with the team's name after, or the lone player. */
export function nextName(next: NextUp<{ name: string }> | null): string | null {
  if (!next) return null;
  return next.member ? `${next.member.name} (${next.side})` : next.side;
}
