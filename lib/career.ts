/**
 * Career mode: one person plays through events against bots, for dollars and ranking points. An event is an ordinary cup of the app's own
 * tournaments (lib/knockout.ts), played with the Mikke Mus game, so the draw, the bracket, the bots and the champion screen are the ones
 * the house already knows. What the career adds is around it: what it costs to get in, what each place pays, the ranking that opens the
 * next step of the ladder, and who the bots are (set from the player's own level).
 *
 * The player throws for real and writes the rounds in, so nothing can make the throw itself better. The opponents are set from the
 * player's level (a MED in mm; lower is sharper) times a factor for the step of the ladder, so anyone can get to the top. Everything
 * here is plain data in and out: a career can be saved as it is, paused anywhere and picked up again. See CAREER_PLAN.md.
 */
import { levelOfMed } from "./botLevels";
import { unit, type CupConfig, type CupKind } from "./botCup";
import { playElsewhere } from "./botSim";
import { createKnockout } from "./knockout";
import { matchParticipants, type Participant, type Tournament } from "./tournament";

export type TierId = "lu" | "region" | "nm" | "gs" | "vm";

/** How far the player got: the title, or the round they went out in (r16 is the round of sixteen, r32 the round of thirty-two). */
export type Place = "winner" | "final" | "semi" | "quarter" | "r16" | "r32";

/** How big the opening scene is: the pub evening is the smallest, the world championship the biggest. */
export type Scale = 1 | 2 | 3 | 4 | 5;

export type Tier = {
  id: TierId;
  kind: CupKind;
  /** The event, and where it is held. */
  name: string;
  trophy: string;
  venue: string;
  /** What the opening scene calls it. */
  stage: string;
  tagline: string;
  scale: Scale;
  /** Entrants: a power of two. */
  size: 8 | 16 | 32;
  fee: number;
  /** What each place wins; a place that is not here wins nothing. */
  prizes: Partial<Record<Place, number>>;
  /** Ranking points for each place. */
  points: Partial<Record<Place, number>>;
  /** The bots' MED against the player's: over 1 is weaker than the player. */
  factor: number;
  /** About how long it takes the player, for the card. */
  minutes: number;
  /** Who it opens: placing like this here qualifies the player for the next step, once. */
  opens?: { tier: TierId; places: Place[] };
  /** How the step is entered, for the card: nothing to say for those that only cost money. */
  qualify?: string;
};

export const TIERS: Record<TierId, Tier> = {
  lu: {
    id: "lu",
    kind: "lu",
    name: "Lü-cupen",
    trophy: "Lü-pokalen",
    venue: "Lü",
    stage: "Fredagskveld på puben",
    tagline: "Fredagsturneringen på Lü",
    scale: 1,
    size: 8,
    fee: 0,
    prizes: { winner: 500, final: 300, semi: 200 },
    points: { winner: 10, final: 6, semi: 3, quarter: 1 },
    factor: 1.2,
    minutes: 30,
  },
  region: {
    id: "region",
    kind: "region",
    name: "Regionmesterskapet",
    trophy: "Regionpokalen",
    venue: "Regionhallen",
    stage: "Regionalt mesterskap",
    tagline: "Beste i regionen",
    scale: 2,
    size: 16,
    fee: 200,
    prizes: { winner: 2500, final: 1200, semi: 600, quarter: 300 },
    points: { winner: 25, final: 15, semi: 8, quarter: 4, r16: 1 },
    factor: 1.18,
    minutes: 50,
    opens: { tier: "nm", places: ["winner", "final", "semi"] },
  },
  nm: {
    id: "nm",
    kind: "nm",
    name: "Norgesmesterskapet",
    trophy: "Norgesmesterpokalen",
    venue: "Nasjonalarenaen",
    stage: "Nasjonalt mesterskap",
    tagline: "Kampen om Norge",
    scale: 3,
    size: 16,
    fee: 750,
    prizes: { winner: 8000, final: 4000, semi: 2000, quarter: 1000 },
    points: { winner: 60, final: 36, semi: 20, quarter: 10, r16: 3 },
    factor: 1.14,
    minutes: 60,
    qualify: "Kom blant de fire beste i Regionmesterskapet",
    opens: { tier: "gs", places: ["winner"] },
  },
  gs: {
    id: "gs",
    kind: "gs",
    name: "Grand Slam",
    trophy: "Grand Slam-pokalen",
    venue: "Slam-arenaen",
    stage: "Grand Slam",
    tagline: "Fire runder mot de beste",
    scale: 4,
    size: 16,
    fee: 2500,
    prizes: { winner: 25000, final: 12000, semi: 6000, quarter: 3000 },
    points: { winner: 120, final: 70, semi: 40, quarter: 20, r16: 8 },
    factor: 1.12,
    minutes: 60,
    qualify: "Vinn Norgesmesterskapet",
    opens: { tier: "vm", places: ["winner", "final"] },
  },
  vm: {
    id: "vm",
    kind: "vm",
    name: "VM i dart",
    trophy: "Verdensmesterpokalen",
    venue: "Verdensarenaen",
    stage: "Verdensmesterskapet",
    tagline: "Hele verden, én pokal",
    scale: 5,
    size: 32,
    fee: 10000,
    prizes: { winner: 150000, final: 70000, semi: 35000, quarter: 15000, r16: 7000 },
    points: { winner: 400, final: 240, semi: 140, quarter: 70, r16: 30, r32: 8 },
    factor: 1.22,
    minutes: 90,
    qualify: "Bli nummer én eller to i Grand Slam",
  },
};

/** The ladder, the smallest step first. */
export const LADDER: Tier[] = [TIERS.lu, TIERS.region, TIERS.nm, TIERS.gs, TIERS.vm];

export const PLACE_LABEL: Record<Place, string> = {
  winner: "Vinner",
  final: "Finalist",
  semi: "Tapte semifinalen",
  quarter: "Tapte kvartfinalen",
  r16: "Tapte åttedelsfinalen",
  r32: "Tapte sekstendelsfinalen",
};

/** Where a career starts: how sharp the player says they are. The MED is the bots' yardstick, and is worked out from the throwing later. */
export const START_LEVELS: { key: string; name: string; med: number; about: string }[] = [
  { key: "nybegynner", name: "Nybegynner", med: 55, about: "Treffer mest brettet" },
  { key: "klubb", name: "Klubbspiller", med: 45, about: "Treffer ofte der du sikter" },
  { key: "dyktig", name: "Dyktig", med: 37, about: "Holder seg stort sett i trebling og dobbel" },
  { key: "sterk", name: "Sterk", med: 30, about: "Treffer det du sikter på det meste av tiden" },
];

/** Where the player starts out. The picture of it is the first step of the home arena (see CAREER_PLAN.md). */
export type HomeId = "garage" | "basement" | "loft";
export const HOMES: { id: HomeId; name: string; about: string }[] = [
  { id: "garage", name: "Garasjen", about: "Kald betong og et brett på en planke" },
  { id: "basement", name: "Kjelleren", about: "Én pære og en pappeske å sitte på" },
  { id: "loft", name: "Loftet", about: "Skrå tak, støv og et vindu" },
];

/** The darts the player starts with: a weight, which is a matter of feel. For now it only shows; better darts are for sale later. */
export type DartsId = "lette" | "middels" | "tunge";
export const DARTS: { id: DartsId; name: string; about: string }[] = [
  { id: "lette", name: "Lette", about: "18 g, fort ut av hånden" },
  { id: "middels", name: "Middels", about: "22 g, den vanlige" },
  { id: "tunge", name: "Tunge", about: "26 g, tunge å stoppe" },
];

export type Profile = { home: HomeId; darts: DartsId };

export const START_MONEY = 100;

export type EventResult = { place: Place; prize: number; cost: number; points: number };

export type ActiveEvent = {
  id: string;
  tier: TierId;
  seed: number;
  /** What it cost to get in. */
  cost: number;
  /** Everyone in the cup, strongest first: what the draw is made from. */
  entrants: Participant[];
  cup: CupConfig;
  /** The cup itself, once the draw is made. */
  tournament: Tournament | null;
  result: EventResult | null;
};

export type HistoryEntry = { at: string; event: string; place?: Place; prize: number; cost: number; points: number; /** A challenge, not a cup: the game, and whether it was won. */ game?: string; won?: boolean };

/** A training session: what the player threw, what it says about their level, and how the level moved. */
export type TrainingSession = { at: string; /** The average of a round of three darts at the treble 20. */ average: number; /** The level the average points to, as a MED in mm. */ measured: number; before: number; after: number };

export type Career = {
  v: 1;
  /** The same for the same name. */
  id: string;
  player: string;
  createdAt: string;
  savedAt: string;
  profile: Profile;
  startLevel: string;
  /** The player's level as a MED in mm. */
  skillMed: number;
  money: number;
  points: number;
  titles: number;
  /** World championships won: each makes the field a little sharper. */
  worldTitles: number;
  played: number;
  history: HistoryEntry[];
  active: ActiveEvent | null;
  /** The steps the player has qualified for, each for one entry. */
  qualified: TierId[];
  /** The last training sessions, newest first. */
  training: TrainingSession[];
  /** What has been bought for the home arena: the step of each thing, 0 (as it was when the career began) to 3. */
  arena: Arena;
  /** A challenge that is waiting, or has been played and not yet taken in. */
  challenge: Challenge | null;
  /** How many challenges there have been, so each is a new one. */
  challenges: number;
};

export const careerId = (player: string) => player.trim().toLowerCase();

export const DEFAULT_PROFILE: Profile = { home: "garage", darts: "middels" };

export function newCareer(player: string, startLevel: string, now: string, profile: Profile = DEFAULT_PROFILE): Career {
  const level = START_LEVELS.find((l) => l.key === startLevel) ?? START_LEVELS[2];
  return { v: 1, id: careerId(player), player, createdAt: now, savedAt: now, profile, startLevel: level.key, skillMed: level.med, money: START_MONEY, points: 0, titles: 0, worldTitles: 0, played: 0, history: [], active: null, qualified: [], training: [], arena: { ...START_ARENA }, challenge: null, challenges: 0 };
}

/** The money, as the career writes it: dollars, so nobody takes it for real money. */
export const dollars = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("nb-NO")}`;

/** The regulars of Lü: the names the pub's field is drawn from. */
export const REGULARS = ["Roger", "Tone", "Svein-Arne", "Kenneth", "Bjørn", "Mia", "Åge", "Ragnhild", "Terje", "Lise", "Odd", "Siri", "Freddy", "Gunnhild", "Truls", "Hege", "Rolf", "Kjartan", "Unni", "Øyvind"];

/** The names of the bigger events: a first name and a surname, put together by the draw so no two in a field are alike. */
const FIRST = ["Anders", "Mikael", "Jonas", "Tobias", "Henrik", "Lukas", "Marius", "Erik", "Stian", "Daniel", "Peter", "Marco", "Luca", "Jan", "Pieter", "Sven", "Karl", "Dmitri", "Ivan", "Tomas", "Rafael", "Hugo", "Oskar", "Felix", "Emil", "Nils", "Magnus", "Viktor", "Adam", "Leon", "Matteo", "Jesper"];
const LAST = ["Berg", "Holm", "Dahl", "Lund", "Strand", "Vik", "Moe", "Brandt", "Keller", "Rossi", "Visser", "Novak", "Kovac", "Lindqvist", "Hartmann", "Dubois", "Moreau", "Jansen", "Bakker", "Fischer", "Weber", "Olsen", "Nygård", "Solberg", "Haugen", "Berntsen", "Engen", "Rud", "Foss", "Ruud", "Santos", "Varga"];

const byLuck = <T>(items: T[], key: (t: T) => string, seed: string): T[] => [...items].sort((x, y) => unit(`${seed}|${key(x)}`) - unit(`${seed}|${key(y)}`));

/** `count` names for a field, none of them the player's: the regulars at the pub, full names everywhere else. */
export function fieldNames(tier: Tier, player: string, seed: number, count: number): string[] {
  const own = player.trim().toLowerCase();
  if (tier.id === "lu") return byLuck(REGULARS.filter((n) => n.toLowerCase() !== own), (n) => n, `${seed}|names`).slice(0, count);
  const firsts = byLuck(FIRST, (n) => n, `${seed}|first`);
  const lasts = byLuck(LAST, (n) => n, `${seed}|last`);
  return firsts.map((f, i) => `${f} ${lasts[i]}`).filter((n) => !n.toLowerCase().startsWith(`${own} `) && n.toLowerCase() !== own).slice(0, count);
}

/** The factor of a step of the ladder for this player: the world championship gets sharper with every title. */
export function factorFor(career: Career, tier: Tier): number {
  const own = tier.id === "vm" ? tier.factor * Math.max(0.7, 0.96 ** career.worldTitles) : tier.factor;
  return own * arenaBonus(career);
}

/** The bots' skill on the level scale (1 sharpest to 8 weakest) for a player of this level at this step of the ladder, before each bot's own spread. */
export function fieldCentre(career: Career, tier: Tier): number {
  return levelOfMed(career.skillMed * factorFor(career, tier));
}

/** The field: the player and the rest, strongest first (the player where their own level puts them). Each bot has a skill of its own around the centre. */
export function fieldFor(career: Career, tier: Tier, seed: number): Participant[] {
  const names = fieldNames(tier, career.player, seed, tier.size - 1);
  const factor = factorFor(career, tier);
  const bots = names.map((name) => {
    const med = career.skillMed * factor * (0.88 + unit(`${seed}|skill|${name}`) * 0.24);
    const skill = Math.min(8, Math.max(1, levelOfMed(med)));
    return { name, isBot: true as const, botLevel: String(Math.round(skill)) as Participant["botLevel"], skill };
  });
  const own = levelOfMed(career.skillMed);
  const order: { p: Participant; strength: number }[] = [{ p: { name: career.player, isBot: false }, strength: own }, ...bots.map((b) => ({ p: b as Participant, strength: b.skill }))];
  return order.sort((a, b) => a.strength - b.strength).map((x) => x.p);
}

export function cupFor(career: Career, tier: Tier, seed: number): CupConfig {
  return { kind: tier.kind, name: tier.name, trophy: tier.trophy, level: String(Math.round(Math.min(8, Math.max(1, fieldCentre(career, tier))))) as CupConfig["level"], growth: true, seed, career: true };
}

/** What it costs to get in. */
export const entryCost = (_career: Career, tier: Tier) => tier.fee;

/** Lü and the regional championship are open to anyone with the money; the rest are entered by qualifying. */
export const isUnlocked = (career: Career, tier: Tier) => !tier.qualify || career.qualified.includes(tier.id);

/** Why the player cannot sign up for this step, or null when they can. */
export function whyNot(career: Career, tier: Tier): string | null {
  if (career.active) return "Du har en turnering som pågår";
  if (!isUnlocked(career, tier)) return tier.qualify ?? "Må kvalifiseres";
  if (career.money < tier.fee) return `Du mangler ${dollars(tier.fee - career.money)} i inngang`;
  return null;
}

/** The biggest step the player has played or qualified for (the pub at the least): what a challenge is priced by. */
export function topStep(career: Career): Tier {
  return [...LADDER].reverse().find((t) => t.id === "lu" || career.qualified.includes(t.id) || career.history.some((h) => h.event === t.name)) ?? TIERS.lu;
}

/** The total prize pool, for the opening scene. */
export const prizePool = (tier: Tier) => Object.values(tier.prizes).reduce((s, n) => s + (n ?? 0), 0);

/** Signs up for an event: the fee is paid and the field is made. The draw comes next, and with it the cup. */
export function startEvent(career: Career, tierId: TierId, seed: number): Career {
  const tier = TIERS[tierId];
  if (whyNot(career, tier)) return career;
  const cost = entryCost(career, tier);
  const active: ActiveEvent = { id: `${career.id}-${seed}`, tier: tierId, seed, cost, entrants: fieldFor(career, tier, seed), cup: cupFor(career, tier, seed), tournament: null, result: null };
  // The qualification is for this one entry.
  return { ...career, money: career.money - cost, qualified: career.qualified.filter((q) => q !== tierId), active };
}

/** The draw is made: the cup is opened, in the order the draw gave. */
export function openCup(career: Career, order: Participant[], now: string): Career {
  const a = career.active;
  if (!a || a.tournament) return career;
  const t = createKnockout("individual", order, a.id, now, "standard", a.cup);
  return { ...career, active: { ...a, tournament: { ...t, name: a.cup.name } } };
}

/** The cup has moved on: a match was played, or taken back. */
export function setTournament(career: Career, t: Tournament): Career {
  const a = career.active;
  return a ? { ...career, active: { ...a, tournament: t } } : career;
}

/** How far the player got: the last match they lost, or the title. */
export function placeIn(t: Tournament, player: string): Place {
  const final = t.matches.find((m) => m.bracketRoundSize === 1 && !m.isBronzeMatch);
  if (final?.winner === player) return "winner";
  const lost = t.matches.find((m) => !m.isBronzeMatch && m.winner && m.winner !== player && matchParticipants(m).includes(player));
  const size = lost?.bracketRoundSize ?? 4;
  return size <= 1 ? "final" : size === 2 ? "semi" : size === 4 ? "quarter" : size === 8 ? "r16" : "r32";
}

/** The event is over for the player (out, or the cup is done): what is left of the cup is played out, and the prize is paid. */
export function finishEvent(career: Career, now: string): Career {
  const a = career.active;
  if (!a?.tournament || a.result) return career;
  const t = a.tournament.status === "done" ? a.tournament : playElsewhere(a.tournament).tournament;
  const tier = TIERS[a.tier];
  const place = placeIn(t, career.player);
  const result: EventResult = { place, prize: tier.prizes[place] ?? 0, cost: a.cost, points: tier.points[place] ?? 0 };
  const entry: HistoryEntry = { at: now, event: tier.name, place, prize: result.prize, cost: result.cost, points: result.points };
  const won = place === "winner";
  const opens = tier.opens && tier.opens.places.includes(place) ? tier.opens.tier : null;
  return {
    ...career,
    qualified: opens && !career.qualified.includes(opens) ? [...career.qualified, opens] : career.qualified,
    money: career.money + result.prize,
    points: career.points + result.points,
    titles: career.titles + (won ? 1 : 0),
    worldTitles: career.worldTitles + (won && tier.id === "vm" ? 1 : 0),
    played: career.played + 1,
    history: [entry, ...career.history].slice(0, 30),
    active: { ...a, tournament: t, result },
  };
}

/** Leaves the finished event behind. */
export function closeEvent(career: Career): Career {
  return career.active?.result ? { ...career, active: null } : career;
}

/** Gives the event up: the entry fee is gone, and nothing is won. */
export function abandonEvent(career: Career): Career {
  return career.active && !career.active.result ? { ...career, active: null } : career;
}

/* ---------------------------------------------------------------------------------------------------------------------------------
 * Challenges: someone at the bar wants a game, between the tournaments. A game of 501, of Lava or of Highstriker against one bot, for a stake
 * the opponent puts up: win and it is yours, lose and it costs nothing (it is the opponent's money). The point is a break, so it is quick.
 * ------------------------------------------------------------------------------------------------------------------------------- */

export type GameId = "501" | "lava" | "highstriker";

export const GAMES: Record<GameId, { name: string; about: string; minutes: number }> = {
  "501": { name: "501", about: "Ned til null, dobbel ut", minutes: 8 },
  lava: { name: "Lava", about: "Ikke ta et felt som er brent", minutes: 5 },
  highstriker: { name: "Highstriker", about: "Slå forrige runde, eller mist et liv", minutes: 5 },
};

/** The challenger's MED against the player's, the stake and the points: a game is a little easier than a cup, and it pays by how far the career is. */
const CHALLENGE_FACTOR = 1.1;

export type Challenge = {
  id: string;
  game: GameId;
  /** Who challenges, and how sharp they are on the level scale. */
  opponent: { name: string; skill: number };
  /** What the winner takes. */
  stake: number;
  /** Set when the game is over. */
  won: boolean | null;
};

/** What a challenge is worth for a player at this point of the ladder: a quarter of the first prize of the biggest step they can enter, with a floor. */
export function stakeFor(career: Career, game: GameId): number {
  const step = topStep(career);
  const base = Math.max(100, Math.round((step.prizes.winner ?? 500) / 4 / 50) * 50);
  return game === "501" ? base : Math.round((base * 0.7) / 50) * 50 || 50;
}

/** A new challenge, from the seed: the game chosen, an opponent from the field, and a stake. */
export function newChallenge(career: Career, game: GameId, seed: number): Challenge {
  const names = fieldNames(topStep(career), career.player, seed, 4);
  const name = names[Math.floor(unit(`${seed}|who`) * names.length)] ?? "Roger";
  const med = career.skillMed * CHALLENGE_FACTOR * arenaBonus(career) * (0.9 + unit(`${seed}|skill`) * 0.2);
  const skill = Math.min(8, Math.max(1, levelOfMed(med)));
  return { id: `${career.id}-c${seed}`, game, opponent: { name, skill }, stake: stakeFor(career, game), won: null };
}

/** The player takes on a challenge in this game. Only one at a time, and not while a cup is going. */
export function offerChallenge(career: Career, game: GameId, seed: number): Career {
  if (career.active || career.challenge) return career;
  return { ...career, challenge: newChallenge(career, game, seed), challenges: career.challenges + 1 };
}

/** The game is over: the stake is the player's if they won. */
export function settleChallenge(career: Career, won: boolean, now: string): Career {
  const c = career.challenge;
  if (!c || c.won !== null) return career;
  const prize = won ? c.stake : 0;
  const entry: HistoryEntry = { at: now, event: `Utfordring: ${GAMES[c.game].name} mot ${c.opponent.name}`, prize, cost: 0, points: 0, game: c.game, won };
  return { ...career, money: career.money + prize, history: [entry, ...career.history].slice(0, 30), challenge: { ...c, won } };
}

/** Takes the finished challenge off the table. */
export const closeChallenge = (career: Career): Career => (career.challenge && career.challenge.won !== null ? { ...career, challenge: null } : career);

/** Turns a challenge down. */
export const declineChallenge = (career: Career): Career => (career.challenge && career.challenge.won === null ? { ...career, challenge: null } : career);

/* ---------------------------------------------------------------------------------------------------------------------------------
 * The home arena: six things to buy, each in three steps over what the place had to begin with. It is where the money goes. It does not make
 * the throw better (the player throws for real), but a better room is a better evening: every step makes the opponents a little weaker.
 * ------------------------------------------------------------------------------------------------------------------------------- */

export type SlotId = "wall" | "floor" | "board" | "light" | "decor" | "crowd";

export type Slot = { id: SlotId; name: string; /** What each of the four steps is called, the first being what there was. */ steps: [string, string, string, string]; /** What it costs to get to step 1, 2 and 3. */ prices: [number, number, number] };

export const SLOTS: Slot[] = [
  { id: "wall", name: "Vegg", steps: ["Slitt vegg", "Malt vegg", "Trepanel", "Arenavegg med storskjerm"], prices: [500, 2500, 15000] },
  { id: "floor", name: "Gulv", steps: ["Gammelt gulv", "Laminat", "Teppe og kastelinje", "Scene med lys i kanten"], prices: [300, 1800, 10000] },
  { id: "board", name: "Dartbrett", steps: ["Billig brett på planke", "Sisalbrett i skap", "Turneringsbrett med ring", "Proffbrett med lysring"], prices: [400, 2200, 9000] },
  { id: "light", name: "Lys", steps: ["Naken pære", "Spotlight", "Lysring og to spotter", "Lysrigg med stråler"], prices: [300, 1600, 13000] },
  { id: "decor", name: "Pynt", steps: ["Pappeske og bøtte", "Krittavle og plakat", "Pokalhylle og neonskilt", "Pokalskap og bannere"], prices: [200, 1300, 7500] },
  { id: "crowd", name: "Publikum", steps: ["Ingen", "En venn", "Fem ved baren", "Fullt hus"], prices: [150, 1100, 8000] },
];

export type Arena = Record<SlotId, number>;
export const START_ARENA: Arena = { wall: 0, floor: 0, board: 0, light: 0, decor: 0, crowd: 0 };

/** How much weaker each step makes the opponents (their MED is that much higher). Everything bought is 18 steps: 14 %. */
const STEP_BONUS = 0.008;

export const arenaSteps = (career: Career) => SLOTS.reduce((s, sl) => s + (career.arena[sl.id] ?? 0), 0);

/** The factor the arena puts on the opponents' MED: 1 with nothing bought, a little over with everything. */
export const arenaBonus = (career: Career) => 1 + STEP_BONUS * arenaSteps(career);

/** What the next step of a thing costs, or null when it is as good as it gets. */
export function nextPrice(career: Career, id: SlotId): number | null {
  const slot = SLOTS.find((s) => s.id === id);
  const step = career.arena[id] ?? 0;
  return slot && step < 3 ? slot.prices[step] : null;
}

/** Why a thing cannot be bought now, or null when it can. */
export function whyNotBuy(career: Career, id: SlotId): string | null {
  const price = nextPrice(career, id);
  if (price === null) return "Fullt utbygd";
  if (career.money < price) return `Du mangler ${dollars(price - career.money)}`;
  return null;
}

/** Buys the next step of a thing: the money goes and the room gets better. */
export function buyUpgrade(career: Career, id: SlotId): Career {
  if (whyNotBuy(career, id)) return career;
  const price = nextPrice(career, id)!;
  return { ...career, money: career.money - price, arena: { ...career.arena, [id]: (career.arena[id] ?? 0) + 1 } };
}
