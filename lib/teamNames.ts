/**
 * Team names: what a team is called by default, what is allowed, and what is remembered.
 *
 * A team's name is its identity in a match — the board, the turn order, the tournament table and
 * the statistics all key on it — so two teams must never share one, and none may be empty. That
 * used to be unchecked: the name box was a plain text field, two teams could both be called
 * "Rakettene", and the match then gave them one shared column.
 *
 * Until the user types a name of their own, a team is called after its members ("Per & Ola"),
 * which is a better default than "Lag 1" and means the same two people are always called the
 * same thing. A name the user does choose is remembered for that exact pair on this device, so
 * putting Per and Ola together again brings the name back.
 */

export const TEAM_NAME_MAX = 24;

export type NamedTeam = { name: string; members: string[]; /** The user typed this name themselves. */ custom?: boolean };

/** Trimmed, single-spaced and cut to the maximum length. */
export function cleanTeamName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, TEAM_NAME_MAX).trim();
}

/** "Per", "Per & Ola", "Per, Ola & Kari", "Per, Ola, Kari & Nils" — empty with no members. */
export function defaultTeamName(members: string[]): string {
  const names = members.map((m) => m.trim()).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** Order- and case-insensitive identity of a set of members. */
export function pairKey(members: string[]): string {
  return members
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

const STORAGE_KEY = "mikke-mus-team-names";

function readSaved(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The name the user last gave exactly this set of members, if any. */
export function savedTeamName(members: string[]): string | null {
  const key = pairKey(members);
  if (!key) return null;
  const saved = readSaved()[key];
  return typeof saved === "string" && cleanTeamName(saved) ? cleanTeamName(saved) : null;
}

/** Remembers the names the user chose themselves — teams left on their default are not stored, so
 *  they keep following their members if the line-up changes. Never throws: a full or blocked
 *  localStorage just means the name is not remembered. */
export function rememberTeamNames(teams: NamedTeam[]): void {
  if (typeof window === "undefined") return;
  try {
    const saved = readSaved();
    for (const t of teams) {
      const key = pairKey(t.members);
      if (!key) continue;
      if (t.custom) saved[key] = cleanTeamName(t.name);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Not remembering a name is not worth interrupting a match for.
  }
}

/**
 * The name a team is shown and played under: its own if the user typed one, otherwise the one
 * remembered for this pair, otherwise one built from the members, otherwise its placeholder
 * ("Lag 1") while it has nobody in it.
 */
export function resolvedTeamName(team: NamedTeam, lookupSaved: (members: string[]) => string | null = savedTeamName): string {
  if (team.custom) return cleanTeamName(team.name);
  return lookupSaved(team.members) ?? (defaultTeamName(team.members) || team.name);
}

/** Every team with the name it will actually play under. */
export function resolveTeams<T extends NamedTeam>(teams: T[], lookupSaved?: (members: string[]) => string | null): T[] {
  return teams.map((t) => ({ ...t, name: resolvedTeamName(t, lookupSaved) }));
}

/** One entry per team: why its name will not do, or null when it is fine. */
export function teamNameProblems(teams: NamedTeam[], lookupSaved?: (members: string[]) => string | null): (string | null)[] {
  const names = teams.map((t) => resolvedTeamName(t, lookupSaved));
  const count = new Map<string, number>();
  names.forEach((n) => count.set(n.toLowerCase(), (count.get(n.toLowerCase()) ?? 0) + 1));
  return names.map((n) => {
    if (!n) return "Laget trenger et navn";
    if ((count.get(n.toLowerCase()) ?? 0) > 1) return "Et annet lag heter det samme";
    return null;
  });
}
