/**
 * Career mode: one person plays through events against bots, for dollars and ranking points. An event is an ordinary cup of the app's own
 * tournaments (lib/knockout.ts), played with the Mikke Mus game, so the draw, the bracket, the bots and the champion screen are the ones
 * the house already knows. What the career adds is around it: what it costs to get in, what each place pays, the ranking, and who the
 * bots are (set from the player's own level).
 *
 * The player throws for real and writes the rounds in, so nothing can make the throw itself better. The opponents are set from the
 * player's level (a MED in mm; lower is sharper) times a factor for the step of the ladder, so anyone can get to the top. Everything
 * here is plain data in and out: a career can be saved as it is, paused anywhere and picked up again. See CAREER_PLAN.md.
 */
import { levelOfMed } from "./botLevels";
import { unit, type CupConfig } from "./botCup";
import { playElsewhere } from "./botSim";
import { createKnockout } from "./knockout";
import { matchParticipants, type Participant, type Tournament } from "./tournament";

export type TierId = "lu";

export type Place = "winner" | "final" | "semi" | "quarter";

export type Tier = {
  id: TierId;
  /** The event, and where it is held. */
  name: string;
  trophy: string;
  venue: string;
  /** Entrants: a power of two. */
  size: 8;
  fee: number;
  /** What each place wins. */
  prizes: Record<Place, number>;
  /** Ranking points for each place. */
  points: Record<Place, number>;
  /** The bots' MED against the player's: over 1 is weaker than the player. */
  factor: number;
  /** About how long it takes the player, for the card. */
  minutes: number;
};

export const TIERS: Record<TierId, Tier> = {
  lu: {
    id: "lu",
    name: "Lü-cupen",
    trophy: "Lü-pokalen",
    venue: "Lü",
    size: 8,
    fee: 50,
    prizes: { winner: 400, final: 150, semi: 0, quarter: 0 },
    points: { winner: 10, final: 6, semi: 3, quarter: 1 },
    factor: 1.2,
    minutes: 30,
  },
};

export const PLACE_LABEL: Record<Place, string> = { winner: "Vinner", final: "Finalist", semi: "Tapte semifinalen", quarter: "Tapte kvartfinalen" };

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

export const START_MONEY = 300;

export type EventResult = { place: Place; prize: number; cost: number; points: number };

export type ActiveEvent = {
  id: string;
  tier: TierId;
  seed: number;
  /** What it cost to get in: the fee, or what the player had if that was less. */
  cost: number;
  /** Everyone in the cup, strongest first: what the draw is made from. */
  entrants: Participant[];
  cup: CupConfig;
  /** The cup itself, once the draw is made. */
  tournament: Tournament | null;
  result: EventResult | null;
};

export type HistoryEntry = { at: string; event: string; place: Place; prize: number; cost: number; points: number };

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
  played: number;
  history: HistoryEntry[];
  active: ActiveEvent | null;
};

export const careerId = (player: string) => player.trim().toLowerCase();

export const DEFAULT_PROFILE: Profile = { home: "garage", darts: "middels" };

export function newCareer(player: string, startLevel: string, now: string, profile: Profile = DEFAULT_PROFILE): Career {
  const level = START_LEVELS.find((l) => l.key === startLevel) ?? START_LEVELS[2];
  return { v: 1, id: careerId(player), player, createdAt: now, savedAt: now, profile, startLevel: level.key, skillMed: level.med, money: START_MONEY, points: 0, titles: 0, played: 0, history: [], active: null };
}

/** The money, as the career writes it: dollars, so nobody takes it for real money. */
export const dollars = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("nb-NO")}`;

/** The regulars of Lü: the names the field is drawn from. */
export const REGULARS = ["Roger", "Tone", "Svein-Arne", "Kenneth", "Bjørn", "Mia", "Åge", "Ragnhild", "Terje", "Lise", "Odd", "Siri", "Freddy", "Gunnhild", "Truls", "Hege", "Rolf", "Kjartan", "Unni", "Øyvind"];

const byLuck = <T>(items: T[], key: (t: T) => string, seed: string): T[] => [...items].sort((x, y) => unit(`${seed}|${key(x)}`) - unit(`${seed}|${key(y)}`));

/** The bots' skill on the level scale (1 sharpest to 8 weakest) for a player of this level at this step of the ladder, before each bot's own spread. */
export function fieldCentre(career: Career, tier: Tier): number {
  return levelOfMed(career.skillMed * tier.factor);
}

/** The field: the player and seven regulars, strongest first (the player where their own level puts them). Each regular has a skill of their own around the centre. */
export function fieldFor(career: Career, tier: Tier, seed: number): Participant[] {
  const names = byLuck(REGULARS.filter((n) => n.toLowerCase() !== career.id), (n) => n, `${seed}|names`).slice(0, tier.size - 1);
  const bots = names.map((name) => {
    const med = career.skillMed * tier.factor * (0.88 + unit(`${seed}|skill|${name}`) * 0.24);
    const skill = Math.min(8, Math.max(1, levelOfMed(med)));
    return { name, isBot: true as const, botLevel: String(Math.round(skill)) as Participant["botLevel"], skill };
  });
  const own = levelOfMed(career.skillMed);
  const order: { p: Participant; strength: number }[] = [{ p: { name: career.player, isBot: false }, strength: own }, ...bots.map((b) => ({ p: b as Participant, strength: b.skill }))];
  return order.sort((a, b) => a.strength - b.strength).map((x) => x.p);
}

export function cupFor(career: Career, tier: Tier, seed: number): CupConfig {
  return { kind: "lu", name: tier.name, trophy: tier.trophy, level: String(Math.round(Math.min(8, Math.max(1, fieldCentre(career, tier))))) as CupConfig["level"], growth: true, seed };
}

/** What it costs to get in: the fee, or what there is if less (the landlord lets you in on credit, so a career can never get stuck). */
export const entryCost = (career: Career, tier: Tier) => Math.min(tier.fee, career.money);

/** Signs up for an event: the fee is paid and the field is made. The draw comes next, and with it the cup. */
export function startEvent(career: Career, tierId: TierId, seed: number): Career {
  if (career.active) return career;
  const tier = TIERS[tierId];
  const cost = entryCost(career, tier);
  const active: ActiveEvent = { id: `${career.id}-${seed}`, tier: tierId, seed, cost, entrants: fieldFor(career, tier, seed), cup: cupFor(career, tier, seed), tournament: null, result: null };
  return { ...career, money: career.money - cost, active };
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
  return size === 1 ? "final" : size === 2 ? "semi" : "quarter";
}

/** The event is over for the player (out, or the cup is done): what is left of the cup is played out, and the prize is paid. */
export function finishEvent(career: Career, now: string): Career {
  const a = career.active;
  if (!a?.tournament || a.result) return career;
  const t = a.tournament.status === "done" ? a.tournament : playElsewhere(a.tournament).tournament;
  const tier = TIERS[a.tier];
  const place = placeIn(t, career.player);
  const result: EventResult = { place, prize: tier.prizes[place], cost: a.cost, points: tier.points[place] };
  const entry: HistoryEntry = { at: now, event: tier.name, place, prize: result.prize, cost: result.cost, points: result.points };
  return {
    ...career,
    money: career.money + result.prize,
    points: career.points + result.points,
    titles: career.titles + (place === "winner" ? 1 : 0),
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
