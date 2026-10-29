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

/** A cup of teams of two (the World Cup of Darts, a cup of pairs): who the player's team is, and the others. The sides are the teams, and a team has one score. */
export type TeamCup = {
  /** The player's side: its name (Norge, or the two names) and who throws with them. */
  mine: { name: string; partner: string };
  others: { name: string; members: [string, string] }[];
};

/** A tournament that is offered instead of one of the ladder: the look and the scale of one of its steps, with a name, a place, a price and a prize of its own. */
export type Invitation = Tier & {
  /** Which of the kinds of invitation it is, so the same does not come twice in a row. */
  key: string;
  city: string;
  /** Why the player is asked, in a line. */
  reason: string;
  /** A game of its own (301 or 501): without it the tournament is played in the game of the career. `humanStart` is where the player starts when it is not where the others do. */
  countdown?: { start: 301 | 501; doubleOut: boolean; humanStart?: number };
  /** Paid to the player on top of any prize, for being there (a television show pays everyone who comes). */
  honorarium?: number;
  /** The names that play, when they are fixed (the best of the season): without it the field is drawn. */
  field?: string[];
  /** A cup of teams of two: the player and a partner against the others. The size is then the number of teams. */
  team?: TeamCup;
};

/** A game made for television: a title, what it pays for being there, how many legs, and where each side starts (a head start for the one who starts lower). */
export type Tv = { title: string; honorarium: number; legs: 1 | 3; humanStart: number; theirStart: number };

export type Sender = { name: string; role: string };

/** What a sponsor offers: so much for every tournament in which the player gets at least as far as `need`, for `events` tournaments. */
export type SponsorDeal = { name: string; perEvent: number; need: Place; events: number };

/** A deal that has been signed: how many tournaments are left, how many have missed the condition, and what it has paid in all. */
export type Sponsor = SponsorDeal & { left: number; misses: number; earned: number };

/** What a message holds that can be answered. */
export type Offer =
  | { kind: "invite"; invite: Invitation }
  | { kind: "challenge"; game: GameId; opponent: { name: string; skill: number }; stake: number; risk: number; tv?: Tv }
  | { kind: "sponsor"; /** The deals on offer: one is signed. */ deals?: SponsorDeal[]; /** A career saved when each deal was a message of its own. */ deal?: SponsorDeal }
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

export type SeasonResult = { season: number; rank: number; points: number; prize: number; winner: string; /** The best five of the table, for the recap. Absent on a season from before it was kept. */ table?: { name: string; pts: number }[] };

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
  /** The last season whose recap the player has seen. */
  recapSeen?: number;
  /** The rank the player last saw (the rank-up screen shows when the rank is another one). Absent on a career from before it was kept. */
  rankSeen?: string;
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

/** How the rival throws, in a few words: the same one for the whole career. Only colour: nothing in the game is steered by it. */
export const RIVAL_STYLES = ["Rolig og jevn", "Rask og risikabel", "Presis og kald", "Pratsom og uberegnelig"];

const hashUnit = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/**
 * The player's rival: one of the regulars of Ly, the same for the whole career (it follows from the name of the career, so nothing is kept).
 * If they stop, the next in the order takes their place.
 */
export function rivalOf(career: { id: string; player: string; life?: Life }): { name: string; style: string } {
  const retired = career.life?.world.retired ?? [];
  const own = career.player.trim().toLowerCase();
  const order = LY_REGULARS.map((r) => r.name)
    .filter((n) => n.toLowerCase() !== own)
    .sort((a, b) => hashUnit(`${career.id}|rival|${a}`) - hashUnit(`${career.id}|rival|${b}`));
  const name = order.find((n) => !retired.includes(n)) ?? order[0];
  return { name, style: RIVAL_STYLES[Math.floor(hashUnit(`${career.id}|rival-style|${name}`) * RIVAL_STYLES.length)] };
}

/** The one who waits at each step above the pub: always the same, and in the field every time. The one at the top is the best of the level bots. */
export const BOSSES: Record<"region" | "nm" | "gs" | "vm", string> = { region: "Rudolf", nm: "Emil Haugen", gs: "Max Hartmann", vm: "Littler" };

/** Who is sure to be in the field of a step, besides the player: the rival, and the boss of the step (when they still play). */
export function mustPlay(career: { id: string; player: string; life?: Life }, tier: string): string[] {
  const retired = career.life?.world.retired ?? [];
  const boss = BOSSES[tier as keyof typeof BOSSES];
  return [rivalOf(career).name, ...(boss && !retired.includes(boss) ? [boss] : [])];
}

/** A line of news, newest first. */
export function addNews(life: Life, kind: NewsKind, headline: string, text: string, who?: string): Life {
  const counter = life.counter + 1;
  const item: NewsItem = { id: `n${counter}`, week: life.week, kind, headline, text, ...(who ? { who } : {}) };
  return { ...life, counter, news: [item, ...life.news].slice(0, 40) };
}

/** The logo of a sponsor (public/career/sponsors/<name>.webp): "Café Trøffel" is cafe-troffel. */
export const sponsorLogo = (name: string) => `/career/sponsors/${name.toLowerCase().replace(/ø/g, "o").replace(/å/g, "a").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;

/** The deals a sponsor message holds, from a career of either kind. */
export const dealsOf = (o: Extract<Offer, { kind: "sponsor" }>): SponsorDeal[] => o.deals ?? (o.deal ? [o.deal] : []);

export function addMessage(life: Life, from: Sender, title: string, body: string, offer: Offer, until?: number): Life {
  const counter = life.counter + 1;
  const m: Message = { id: `m${counter}`, week: life.week, from, title, body, read: false, state: "open", offer, ...(until ? { until } : {}) };
  return { ...life, counter, inbox: [m, ...life.inbox].slice(0, 30) };
}
