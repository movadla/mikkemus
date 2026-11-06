import type { BotLevel } from "./botLevels";
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
export type TeamCard = {
  name: string;
  members: string[];
  lastUsed: number;
  /** When the team was put in a match, newest last (the latest thirty): what «used in the last hours» counts. A card from before this has only lastUsed. */
  uses?: number[];
  /** The members that are bots, by name, with their level — so a team with a bot in it comes back as it was. */
  bots?: Record<string, BotLevel>;
};

const BOT_LEVEL_KEYS = ["1", "2", "3", "4", "5", "6"];

function parseBots(raw: unknown, members: string[]): Record<string, BotLevel> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, BotLevel> = {};
  for (const [name, level] of Object.entries(raw as Record<string, unknown>)) {
    if (members.includes(name) && typeof level === "string" && BOT_LEVEL_KEYS.includes(level)) out[name] = level as BotLevel;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A team to remember: the named team and, for the bots in it, their levels. */
export type RememberedTeam = NamedTeam & { bots?: Record<string, BotLevel> };

const STORAGE_KEY = "mikke-mus-team-cards";
const MAX_CARDS = 40;
const MAX_USES = 30;

function parseCards(raw: string | null): TeamCard[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cards: TeamCard[] = [];
    for (const c of parsed) {
      if (!c || typeof c !== "object") continue;
      const { name, members, lastUsed, bots, uses } = c as Record<string, unknown>;
      if (typeof name !== "string" || !Array.isArray(members) || !members.every((m) => typeof m === "string")) continue;
      if (members.length === 0) continue;
      const parsedBots = parseBots(bots, members as string[]);
      const parsedUses = Array.isArray(uses) ? uses.filter((u): u is number => typeof u === "number").slice(-MAX_USES) : undefined;
      cards.push({ name: cleanTeamName(name), members: members as string[], lastUsed: typeof lastUsed === "number" ? lastUsed : 0, ...(parsedUses && parsedUses.length > 0 ? { uses: parsedUses } : {}), ...(parsedBots ? { bots: parsedBots } : {}) });
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
export function mergeTeamCards(existing: TeamCard[], teams: RememberedTeam[], now: number): TeamCard[] {
  const byPair = new Map<string, TeamCard>();
  existing.forEach((c) => byPair.set(pairKey(c.members), c));
  for (const t of teams) {
    const key = pairKey(t.members);
    const name = cleanTeamName(t.name);
    if (!key || !name) continue;
    const before = byPair.get(key);
    const uses = [...(before?.uses ?? (before && before.lastUsed > 0 ? [before.lastUsed] : [])), now].slice(-MAX_USES);
    byPair.set(key, { name, members: t.members, lastUsed: now, uses, ...(t.bots ? { bots: t.bots } : {}) });
  }
  return [...byPair.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_CARDS);
}

/** Remembers the teams of a match that is starting. Never throws. */
export function rememberTeamCards(teams: RememberedTeam[], now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeTeamCards(readTeamCards(), teams, now)));
    listeners.forEach((l) => l());
  } catch {
    // A team that is not remembered just has to be put together again.
  }
}

/**
 * The device's cards and the teams that have a record of their own (lib/playerRows.ts), as one
 * list. A record is a card with no last-used time of its own, so the cards this device has used
 * come first; where both exist for the same people, the record's name wins — it is the name the
 * statistics are under, on every device.
 */
export function withTeamRecords(cards: TeamCard[], records: { name: string; members?: string[] }[]): TeamCard[] {
  const byPair = new Map<string, TeamCard>();
  cards.forEach((c) => byPair.set(pairKey(c.members), c));
  for (const r of records) {
    const members = r.members ?? [];
    const key = pairKey(members);
    const name = cleanTeamName(r.name);
    if (!key || !name) continue;
    const local = byPair.get(key);
    byPair.set(key, { name, members: local?.members ?? members, lastUsed: local?.lastUsed ?? 0, ...(local?.uses ? { uses: local.uses } : {}), ...(local?.bots ? { bots: local.bots } : {}) });
  }
  return [...byPair.values()].sort((a, b) => b.lastUsed - a.lastUsed || a.name.localeCompare(b.name, "no"));
}

/** How many teams the picker shows before «Mer». */
export const TEAMS_SHOWN = 6;

/** How far back «used lately» looks. */
export const RECENT_MS = 18 * 60 * 60 * 1000;

/** How many times a team was put in a match in the last hours: its uses on this device, or for a card from before the uses were kept, its last use as one. */
const recentUses = (c: TeamCard, now: number) => (c.uses ?? (c.lastUsed > 0 ? [c.lastUsed] : [])).filter((u) => now - u <= RECENT_MS).length;

/**
 * The teams in the order of how much they are used: by the matches the team has on record, most first, and between teams with the same
 * number (or none: a team only this device remembers) by when this device last used it. The list the picker shows the first of.
 */
export function rankByUse(cards: TeamCard[], records: { members?: string[]; matchesPlayed?: number }[]): TeamCard[] {
  const played = new Map<string, number>();
  records.forEach((r) => played.set(pairKey(r.members ?? []), r.matchesPlayed ?? 0));
  const count = (c: TeamCard) => played.get(pairKey(c.members)) ?? 0;
  return [...cards].sort((a, b) => count(b) - count(a) || b.lastUsed - a.lastUsed || a.name.localeCompare(b.name, "no"));
}

/**
 * The order the picker shows the teams in: the teams used most in the last eighteen hours first (the most used first, and between equals the last used), then
 * the rest by how much they are used altogether (rankByUse). When nothing was played in the last eighteen hours that is simply the most used altogether.
 */
export function rankForPicker(cards: TeamCard[], records: { members?: string[]; matchesPlayed?: number }[], now: number): TeamCard[] {
  const overall = rankByUse(cards, records);
  const recent = overall.filter((x) => recentUses(x, now) > 0).sort((a, b) => recentUses(b, now) - recentUses(a, now) || b.lastUsed - a.lastUsed);
  return [...recent, ...overall.filter((x) => !recent.includes(x))];
}
