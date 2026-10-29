/**
 * What goes on around the tournaments of a career: the weeks and the seasons, the news, the messages with their offers, a sponsor, the player's
 * name (rykte), and a world where the other players change from one season to the next. It is kept in one object on the career, `life`, so
 * a career from before any of it is the same career with a life that has just begun. The types and the small helpers are here; what happens
 * as the weeks go by is in lib/careerWorld.ts.
 */
import type { GameId, Place, Tier } from "./career";
import { LY_REGULARS } from "./opponents";

/** A season is ten weeks, and a week goes by when the player has played a tournament (or left one). */
export const WEEKS_PER_SEASON = 10;

/** The best a name can be. It starts in the middle: saying no to what people ask costs some, playing what they ask earns some. */
export const REP_MAX = 10;
export const REP_START = 5;

/** The order of the places, the best first. */
export const PLACE_ORDER: Place[] = ["winner", "final", "semi", "quarter", "r16", "r32"];

/** Whether a place is as good as the one that is needed. */
export const placeMeets = (place: Place, need: Place) => PLACE_ORDER.indexOf(place) <= PLACE_ORDER.indexOf(need);

/** A tournament that is offered instead of one of the ladder: the look and the scale of one of its steps, with a name, a place, a price and a prize of its own. */
export type Invitation = Tier & {
  /** Which of the kinds of invitation it is, so the same does not come twice in a row. */
  key: string;
  city: string;
  /** Why the player is asked, in a line. */
  reason: string;
  /** A game of its own (301 or 501): without it the tournament is played in the game of the career. */
  countdown?: { start: 301 | 501; doubleOut: boolean };
};

export type Sender = { name: string; role: string };

/** What a sponsor offers: so much for every tournament in which the player gets at least as far as `need`, for `events` tournaments. */
export type SponsorDeal = { name: string; perEvent: number; need: Place; events: number };

/** A deal that has been signed: how many tournaments are left, how many have missed the condition, and what it has paid in all. */
export type Sponsor = SponsorDeal & { left: number; misses: number; earned: number };

/** What a message holds that can be answered. */
export type Offer =
  | { kind: "invite"; invite: Invitation }
  | { kind: "challenge"; game: GameId; opponent: { name: string; skill: number }; stake: number; risk: number }
  | { kind: "sponsor"; deal: SponsorDeal }
  | { kind: "info" };

export type MessageState = "open" | "taken" | "declined" | "expired";

export type Message = {
  id: string;
  week: number;
  from: Sender;
  title: string;
  body: string;
  read: boolean;
  state: MessageState;
  /** The last week it can be answered. */
  until?: number;
  offer: Offer;
};

export type NewsKind = "cup" | "upset" | "you" | "season" | "world";

export type NewsItem = { id: string; week: number; kind: NewsKind; headline: string; text: string; /** A person in the story: the face by it. */ who?: string };

/** A new player in the world: made up, with a strength of their own. */
export type Rookie = { name: string; med: number; age: number; since: number };

/**
 * How the other players have changed: a factor on each one's strength (under 1 is sharper), who has stopped, who has come, the ranking points
 * of this season, and the world rank each had at the end of the last one (for the arrows in the lists).
 */
export type World = { drift: Record<string, number>; retired: string[]; rookies: Rookie[]; pts: Record<string, number>; snap: Record<string, number> };

export type SeasonResult = { season: number; rank: number; points: number; prize: number; winner: string };

export type Life = {
  /** The week of the career, from 1. */
  week: number;
  /** The ranking points of this season. */
  seasonPts: number;
  reputation: number;
  news: NewsItem[];
  inbox: Message[];
  /** The highest number of an item of news the player has seen. */
  newsSeen: number;
  sponsor: Sponsor | null;
  world: World;
  seasons: SeasonResult[];
  /** Counts what is made (news, messages), so each has a name of its own. */
  counter: number;
};

export const newWorld = (): World => ({ drift: {}, retired: [], rookies: [], pts: {}, snap: {} });

export const newLife = (): Life => ({ week: 1, seasonPts: 0, reputation: REP_START, news: [], inbox: [], newsSeen: 0, sponsor: null, world: newWorld(), seasons: [], counter: 0 });

/** The life of a career, or the beginning of one for a career that has none. */
export const lifeOf = (career: { life?: Life }): Life => (career.life ? { ...newLife(), ...career.life, world: { ...newWorld(), ...career.life.world } } : newLife());

export const seasonOf = (week: number) => Math.floor((Math.max(1, week) - 1) / WEEKS_PER_SEASON) + 1;
export const weekInSeason = (week: number) => ((Math.max(1, week) - 1) % WEEKS_PER_SEASON) + 1;

/** Messages that can still be answered. */
export const isOpen = (m: Message) => m.state === "open" && m.offer.kind !== "info";

/** What waits for the player in the inbox: unread messages, and offers that are still open. */
export const inboxCount = (life: Life) => life.inbox.filter((m) => !m.read || isOpen(m)).length;

/** Items of news the player has not seen. */
export const unseenNews = (life: Life) => life.news.filter((n) => Number(n.id.slice(1)) > life.newsSeen).length;

/** The regulars of Ly who are still playing, and the new ones: who a field at the pub is drawn from. */
export const lyPool = (life: Life): string[] => [...LY_REGULARS.map((r) => r.name).filter((n) => !life.world.retired.includes(n)), ...life.world.rookies.map((r) => r.name)];

/** The life of a new career: a message from the pub that says what the inbox is for, and the first line of news. */
export function welcomeLife(player: string): Life {
  return {
    ...newLife(),
    counter: 2,
    news: [{ id: "n1", week: 1, kind: "world", headline: `${player} er ny på Ly`, text: "Fredagscupen venter. Det er gratis å være med." }],
    inbox: [{ id: "m2", week: 1, from: { name: "Puben på Ly", role: "Ly" }, title: `Velkommen, ${player}`, body: "Her kommer invitasjoner, utfordringer og tilbud når du har spilt litt. Spill en turnering, så skjer det noe.", read: false, state: "open", offer: { kind: "info" } }],
  };
}
