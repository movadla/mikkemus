import type { BotLevel, TeamMember } from "./botLevels";
import type { Participant, Tournament, TournamentMatch, TournamentMode } from "./tournament";

/**
 * A cup against bots: the people (or teams) of the house in a tournament with named bot opponents, played for a trophy.
 * The tournament itself is the ordinary one (groups, then a bracket); what is new is who the bots are and how they throw.
 *
 * A bot has a skill of its own, a number on the level scale (1 = Littler, the sharpest, to 5 = Kjetil, the weakest), set
 * once for the cup from the level chosen with some spread, so the field is not made of equals. For each match the skill is
 * moved by how far into the cup it is (they start a little weaker and grow, when that is chosen) and by that day's form, which
 * is different in every match, and then rounded to the level the game engine plays the match at. So a bot does not throw the
 * same every time, as the house does not either.
 */

export type CupKind = "vm" | "em" | "gs" | "nm" | "open";

export type CupType = { kind: CupKind; name: string; trophy: string; tagline: string; defaultSize: number };

export const CUP_TYPES: CupType[] = [
  { kind: "vm", name: "VM i dart", trophy: "Verdensmesterpokalen", tagline: "Hele verden, én pokal", defaultSize: 16 },
  { kind: "em", name: "EM i dart", trophy: "Europamesterpokalen", tagline: "Europas beste kasteføringer", defaultSize: 8 },
  { kind: "gs", name: "Grand Slam", trophy: "Grand Slam-pokalen", tagline: "Gruppespill, så utslagskamper", defaultSize: 12 },
  { kind: "nm", name: "Norgesmesterskapet", trophy: "Norgesmesterpokalen", tagline: "Kampen om Norge", defaultSize: 8 },
  { kind: "open", name: "Lilleaker Open", trophy: "Lilleaker-pokalen", tagline: "Hjemmebane, og alle vil ha pokalen", defaultSize: 8 },
];

/** How many take part, the people of the house and the bots together. */
export const CUP_SIZES = [4, 6, 8, 12, 16];

/** Where the cup begins when nothing is chosen: ChrisBell, 39 mm, which is the group's own average (Vadla measures about 37). */
export const DEFAULT_CUP_LEVEL: BotLevel = "4";

/** What is kept of a cup in the tournament: enough to name it, and to work out how the bots throw each match. */
export type CupConfig = {
  kind: CupKind;
  name: string;
  trophy: string;
  /** The bots' level on average. */
  level: BotLevel;
  /** Whether the bots start a little weaker and get better as the cup goes on. */
  growth: boolean;
  /** Everything random in the cup comes from this, so the same cup is the same after a reload. */
  seed: number;
};

export function cupType(kind: CupKind): CupType {
  return CUP_TYPES.find((c) => c.kind === kind) ?? CUP_TYPES[0];
}

export function makeCup(kind: CupKind, level: BotLevel, growth: boolean, seed: number): CupConfig {
  const t = cupType(kind);
  return { kind, name: t.name, trophy: t.trophy, level, growth, seed };
}

/** The sharpest and the weakest level there is to play a bot at. */
const BEST = 1;
const WORST = 5;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A number from 0 to 1 that is the same for the same text. */
export function unit(text: string): number {
  let a = hash(text) + 0x6d2b79f5;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

const clamp = (v: number) => Math.min(WORST, Math.max(BEST, v));

/** One bot's skill for the whole cup: the cup's level, a little better or worse, never the same for two. */
export function botSkill(cup: CupConfig, name: string): number {
  return clamp(Number(cup.level) + (unit(`${cup.seed}|skill|${name}`) - 0.5) * 1.6);
}

/** How much further into the cup moves the level: positive is weaker. Group matches are the easiest, the final the hardest. */
export function stageOffset(match: Pick<TournamentMatch, "round" | "bracketRoundSize">): number {
  if (match.round === "group") return 0.7;
  const size = match.bracketRoundSize ?? 1;
  if (size >= 8) return 0.3;
  if (size >= 4) return 0;
  return size === 2 ? -0.4 : -0.7;
}

/** The level a bot throws at in this match: its skill, the stage of the cup, and the day's form. */
export function levelForMatch(cup: CupConfig, skill: number, match: Pick<TournamentMatch, "id" | "round" | "bracketRoundSize">, name: string): BotLevel {
  const stage = cup.growth ? stageOffset(match) : 0;
  const form = (unit(`${cup.seed}|form|${match.id}|${name}`) - 0.5) * 1.8;
  return String(Math.round(clamp(skill + stage + form))) as BotLevel;
}

const FIRST_NAMES_POOL = [
  "Jonas Lindqvist", "Marco Bellini", "Pieter de Wit", "Callum Hartley", "Kasper Nygaard", "Luca Moretti", "Henrik Dahl", "Ruben Castillo",
  "Declan O'Rourke", "Matti Korhonen", "Stefan Brandt", "Joao Ferreira", "Tobias Engel", "Nico Vandenberg", "Sven Eriksen", "Aleksi Heikkila",
  "Ewan MacLeod", "Thijs Bakker", "Mateo Alvarez", "Oskar Berg", "Rory Callahan", "Felix Wagner", "Dario Conti", "Emil Strand",
  "Liam Brennan", "Jakub Nowak", "Anders Moe", "Gerrit Smit", "Niklas Holm", "Teodor Lund", "Arne Solberg", "Kristian Aas",
  "Sander Veen", "Casper Holt", "Yannick Dubois", "Milan Horvat", "Bastian Roth", "Hugo Lefevre", "Gunnar Vik", "Remy Laurent",
];

const TEAM_NAMES_POOL = [
  "Treble Trouble", "Bull Busters", "Oche Outlaws", "Double Dutch", "Flight Club", "Checkout Kings", "Tungsten Titans", "Arrow Heads",
  "Madhouse Mafia", "Bullseye Bandits", "Skarpe Piler", "Oche Rockets", "Triple Threat", "Sisal Saints", "Dart Vaders", "Nordlys Nine",
  "Barrel Rollers", "Grand Gutta", "Mikkel og Mus", "De Gode Gamle",
];

/** `count` names from the pool in an order of the cup's own, none of them taken. */
export function pickNames(pool: string[], count: number, taken: string[], seed: string): string[] {
  const lower = taken.map((t) => t.trim().toLowerCase());
  const free = pool.filter((n) => !lower.includes(n.toLowerCase()));
  const ordered = [...free].sort((a, b) => unit(`${seed}|${a}`) - unit(`${seed}|${b}`));
  const names = ordered.slice(0, count);
  // A pool that runs out is numbered on, rather than put in twice.
  for (let i = 0; names.length < count; i++) {
    const base = pool[i % pool.length];
    const name = `${base} ${Math.floor(i / pool.length) + 2}`;
    if (!lower.includes(name.toLowerCase()) && !names.includes(name)) names.push(name);
  }
  return names;
}

/** The most the cup holds: the pools, with one more for each person of the house to be told apart from. */
export const MAX_CUP_SIZE = 16;

/**
 * Everyone in the cup: the house's own entrants first (people alone, or teams), then the bots to make `size`. Bots get names
 * of their own — people for the individual cup, teams of two named people for the team cup — and a skill each.
 */
export function buildCupParticipants(mode: TournamentMode, own: Participant[], size: number, cup: CupConfig): Participant[] {
  const botCount = Math.max(0, Math.min(MAX_CUP_SIZE, size) - own.length);
  const taken = own.flatMap((p) => [p.name, ...(p.members ?? []).map((m) => m.name)]);
  const asBot = (name: string): { name: string; isBot: true; botLevel: BotLevel; skill: number } => {
    const skill = botSkill(cup, name);
    return { name, isBot: true, botLevel: String(Math.round(skill)) as BotLevel, skill };
  };
  if (mode === "individual") {
    const bots = pickNames(FIRST_NAMES_POOL, botCount, taken, `${cup.seed}|people`).map(asBot);
    return [...own, ...bots];
  }
  const teamNames = pickNames(TEAM_NAMES_POOL, botCount, taken, `${cup.seed}|teams`);
  const memberNames = pickNames(FIRST_NAMES_POOL, botCount * 2, [...taken, ...teamNames], `${cup.seed}|members`);
  const bots: Participant[] = teamNames.map((name, i) => ({
    name,
    isBot: false,
    members: [memberNames[i * 2], memberNames[i * 2 + 1]].map((m): TeamMember => asBot(m)),
  }));
  return [...own, ...bots];
}

/**
 * Who is a bot, and at what level, for one match of the tournament. For an ordinary tournament that is the level each bot was
 * given; for a cup it is worked out for this match, from the bot's skill, how far into the cup it is, and the day's form. The
 * same match gives the same levels every time it is asked for (a reload must not change the opposition).
 */
export function botSetupForMatch(tournament: Pick<Tournament, "participants" | "cup">, match: Pick<TournamentMatch, "id" | "round" | "bracketRoundSize">): { botLevels: Record<string, BotLevel>; teamRosters: Record<string, TeamMember[]> } {
  const { cup } = tournament;
  const levelOf = (who: { name: string; botLevel?: BotLevel; skill?: number }): BotLevel | undefined =>
    cup && who.skill !== undefined ? levelForMatch(cup, who.skill, match, who.name) : who.botLevel;
  const botLevels: Record<string, BotLevel> = {};
  const teamRosters: Record<string, TeamMember[]> = {};
  tournament.participants.forEach((p) => {
    const level = levelOf(p);
    if (p.isBot && level) botLevels[p.name] = level;
    if (p.members && p.members.length > 0) teamRosters[p.name] = p.members.map((m) => (m.isBot ? { ...m, botLevel: levelOf(m) } : m));
  });
  return { botLevels, teamRosters };
}
