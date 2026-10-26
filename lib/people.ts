import type { BotLevel, TeamMember } from "./botLevels";
import { botDisplayName } from "./botLevels";
import { defaultTeamName, type NamedTeam } from "./teamNames";

/**
 * Someone in a match being set up: a saved player, a new name that is saved when the match
 * starts, a guest who is never saved, or a bot. The setup screens hold these; the game gets
 * names, bot levels and guest flags out of them at start (see lib/people.ts's split helpers).
 */
export type Person = { name: string; isBot: boolean; botLevel?: BotLevel; isGuest?: boolean };

/** A team being set up: its name and who is in it, in playing order. `custom` means the name is
 *  the user's own (or a team's recorded name) and is kept as it is, rather than following the
 *  members — see lib/teamNames.ts. */
export type PickedTeam = { name: string; members: Person[]; custom?: boolean };

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The bot's name for this match: "Littler", or "Littler (2)" when one is in already. */
export function nextBotName(level: BotLevel, taken: string[]): string {
  const base = botDisplayName(level);
  let name = base;
  let suffix = 2;
  while (taken.some((t) => sameName(t, name))) {
    name = `${base} (${suffix})`;
    suffix++;
  }
  return name;
}

/** The people of a one-against-one match, as the game wants them. */
export function splitPeople(people: Person[]): { players: string[]; botLevels: Record<string, BotLevel>; guestPlayers: Record<string, true> } {
  const botLevels: Record<string, BotLevel> = {};
  const guestPlayers: Record<string, true> = {};
  people.forEach((p) => {
    if (p.isBot && p.botLevel) botLevels[p.name] = p.botLevel;
    if (p.isGuest) guestPlayers[p.name] = true;
  });
  return { players: people.map((p) => p.name), botLevels, guestPlayers };
}

/** The people who have a record — not bots, not guests. The ones to save and to remember. */
export function savedPeople(people: Person[]): string[] {
  return people.filter((p) => !p.isBot && !p.isGuest).map((p) => p.name);
}

export function toMember(p: Person): TeamMember {
  return { name: p.name, isBot: p.isBot, botLevel: p.botLevel };
}

export function toNamedTeam(t: PickedTeam): NamedTeam {
  return { name: t.name, members: t.members.map((m) => m.name), custom: t.custom };
}

/** Everyone on any of these teams. */
export function teamPeople(teams: PickedTeam[]): Person[] {
  return teams.flatMap((t) => t.members);
}

/** Whether these two line-ups have anyone in common — a person plays for one team at a time. */
export function sharesMember(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => sameName(x, y)));
}

/** A team of these people, named after them unless given a name. */
export function makeTeam(members: Person[], name?: string): PickedTeam {
  const typed = name?.trim();
  return typed ? { name: typed, members, custom: true } : { name: defaultTeamName(members.map((m) => m.name)), members };
}
