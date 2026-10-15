import { cleanTeamName, pairKey, type NamedTeam } from "./teamNames";

/**
 * Teams that have played before, kept as cards of their own — a name and the people in it —
 * instead of as made-up players in the list of players.
 *
 * People got round the lack of a place for team names by creating a "player" called "Vadla & Lars"
 * and picking it; that put team names in the player list and in the statistics. A card is the
 * proper home: it remembers the team, and choosing it fills in a team slot in one tap.
 *
 * Per device, like the team names (lib/teamNames.ts) and the shirts (lib/teamKit.ts), which are
 * worked out from the same two things — the members.
 */
export type TeamCard = { name: string; members: string[]; lastUsed: number };

const STORAGE_KEY = "mikke-mus-team-cards";
const MAX_CARDS = 40;

function parseCards(raw: string | null): TeamCard[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cards: TeamCard[] = [];
    for (const c of parsed) {
      if (!c || typeof c !== "object") continue;
      const { name, members, lastUsed } = c as Record<string, unknown>;
      if (typeof name !== "string" || !Array.isArray(members) || !members.every((m) => typeof m === "string")) continue;
      if (members.length === 0) continue;
      cards.push({ name: cleanTeamName(name), members: members as string[], lastUsed: typeof lastUsed === "number" ? lastUsed : 0 });
    }
    return cards.sort((a, b) => b.lastUsed - a.lastUsed);
  } catch {
    return [];
  }
}

export function readTeamCards(): TeamCard[] {
  if (typeof window === "undefined") return [];
  try {
    return parseCards(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

const EMPTY: TeamCard[] = [];
let cachedRaw: string | null | undefined;
let cachedCards: TeamCard[] = EMPTY;
const listeners = new Set<() => void>();

/** The cards as React can hold them: the same array every time until the stored text changes, so
 *  a screen showing them does not re-render forever. */
export function getTeamCardsSnapshot(): TeamCard[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Blocked storage reads as no cards.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCards = parseCards(raw);
  }
  return cachedCards;
}

export function subscribeTeamCards(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The cards after these teams have played: each team replaces the card for the same people, so a
 * team that changes its name does not leave the old one behind, and the list stays short.
 */
export function mergeTeamCards(existing: TeamCard[], teams: NamedTeam[], now: number): TeamCard[] {
  const byPair = new Map<string, TeamCard>();
  existing.forEach((c) => byPair.set(pairKey(c.members), c));
  for (const t of teams) {
    const key = pairKey(t.members);
    const name = cleanTeamName(t.name);
    if (!key || !name) continue;
    byPair.set(key, { name, members: t.members, lastUsed: now });
  }
  return [...byPair.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_CARDS);
}

/** Remembers the teams of a match that is starting. Never throws. */
export function rememberTeamCards(teams: NamedTeam[], now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeTeamCards(readTeamCards(), teams, now)));
    listeners.forEach((l) => l());
  } catch {
    // A team that is not remembered just has to be put together again.
  }
}

export type PersonRef = { name: string; isBot: boolean };

/**
 * Fills a team slot from a card: the card's people are added to the pool if they are not in it
 * (taking them out of any team they were already on, so nobody is in two), and the card goes in
 * the first team that has nobody in it yet — or in a new team if every slot is taken.
 * Pure, so the screens that offer it all behave the same.
 */
export function applyTeamCard<P extends PersonRef>(
  card: TeamCard,
  people: P[],
  teams: NamedTeam[],
  makePerson: (name: string) => P,
): { people: P[]; teams: NamedTeam[] } {
  const known = new Set(people.map((p) => p.name.toLowerCase()));
  const added = card.members.filter((m) => !known.has(m.toLowerCase())).map(makePerson);
  const nextPeople = [...people, ...added];
  // Match the card's names to the spelling already in the pool.
  const spelled = card.members.map((m) => nextPeople.find((p) => p.name.toLowerCase() === m.toLowerCase())!.name);
  const taken = new Set(spelled);
  const cleared = teams.map((t) => ({ ...t, members: t.members.filter((m) => !taken.has(m)) }));
  const slot = cleared.findIndex((t) => t.members.length === 0);
  const filled: NamedTeam = { name: card.name, members: spelled, custom: true };
  if (slot === -1) return { people: nextPeople, teams: [...cleared, filled] };
  return { people: nextPeople, teams: cleared.map((t, i) => (i === slot ? filled : t)) };
}
