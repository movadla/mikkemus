/**
 * What happens around the tournaments of a career as the weeks go by (the types are in lib/careerLife.ts). A week passes when the player has
 * played a tournament or left one; with it the other players play a tournament of their own, news is written, and offers come in the inbox:
 * invitations to tournaments outside the ladder, challenges the player did not ask for, and sponsors. Every ten weeks a season ends, with a
 * prize for the best of it, and the other players change: some get sharper or worse, some stop, and new ones come. Nothing is random in the
 * sense that matters for saving: everything is drawn from the name of the career and the week, so the same career is the same on every phone.
 */
import { levelOfMed } from "./botLevels";
import { unit } from "./botCup";
import { EVERYONE, LY_REGULARS, INTERNATIONALS, opponentOf, type Opponent } from "./opponents";
import { winChance, norwayRankOf, playerWorldRank, worldRankOf } from "./opponentStats";
import {
  GAMES, LADDER, TIERS, closeEvent, abandonEvent, dollars, fieldNames, isUnlocked, newChallenge, startEvent, stakeFor, topStep, whyNot,
  type Career, type Challenge, type GameId, type Place, type Tier, type TierId,
} from "./career";
import {
  BOSSES, REP_MAX, WEEKS_PER_SEASON, lifeOf, placeMeets, rivalOf, seasonOf, weekInSeason,
  type Invitation, type Life, type Message, type NewsItem, type NewsKind, type Offer, type Rookie, type Sender, type SeasonResult, type SponsorDeal,
} from "./careerLife";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round50 = (n: number) => Math.round(n / 50) * 50;

/* ----------------------------------------------------------------- the other players, as the seasons have made them */

/** Everyone in the lists as they are now: the ones who have stopped gone, the new ones in, and each one's strength moved by what the seasons did. */
export function peopleOf(career: Career): Opponent[] {
  const w = lifeOf(career).world;
  const base = EVERYONE.filter((o) => !w.retired.includes(o.name)).map((o) => ({ ...o, med: o.med * (w.drift[o.name] ?? 1) }));
  const fresh = w.rookies.map((r) => ({ ...opponentOf(r.name), med: r.med * (w.drift[r.name] ?? 1) }));
  return [...base, ...fresh];
}

/** The strength (MED in mm) of one of them now. */
export function botMed(career: Career, name: string): number {
  const w = lifeOf(career).world;
  const rookie = w.rookies.find((r) => r.name === name);
  return (rookie ? rookie.med : opponentOf(name).med) * (w.drift[name] ?? 1);
}

/** The player's place on the Norwegian list, as the list shows it. */
export const norwayRank = (career: Career) => norwayRankOf(playerWorldRank(career.skillMed, career.points));

/* ----------------------------------------------------------------- a small writer of news and messages */

function addNews(life: Life, kind: NewsKind, headline: string, text: string, who?: string): Life {
  const counter = life.counter + 1;
  const item: NewsItem = { id: `n${counter}`, week: life.week, kind, headline, text, ...(who ? { who } : {}) };
  return { ...life, counter, news: [item, ...life.news].slice(0, 40) };
}

function addMessage(life: Life, from: Sender, title: string, body: string, offer: Offer, until?: number): Life {
  const counter = life.counter + 1;
  const m: Message = { id: `m${counter}`, week: life.week, from, title, body, read: false, state: "open", offer, ...(until ? { until } : {}) };
  return { ...life, counter, inbox: [m, ...life.inbox].slice(0, 30) };
}

const withLife = (career: Career, life: Life): Career => ({ ...career, life });

/* ----------------------------------------------------------------- the tournament the others play while the player plays theirs */

/** A cup between the names given: the strongest meet the weakest, the better one wins more often than not. Where each one went out. */
export function playBracket(names: string[], medOf: (name: string) => number, key: string): { places: Record<string, Place>; final: [string, string] } {
  const places: Record<string, Place> = {};
  let alive = [...names].sort((a, b) => medOf(a) - medOf(b));
  let final: [string, string] = [alive[0] ?? "", alive[1] ?? ""];
  while (alive.length > 1) {
    const n = alive.length;
    const size = 2 ** Math.ceil(Math.log2(n));
    const lossPlace: Place = size <= 2 ? "final" : size === 4 ? "semi" : size === 8 ? "quarter" : size === 16 ? "r16" : "r32";
    const pool = [...alive];
    const bye = pool.length % 2 ? pool.shift() : undefined;
    const next: string[] = bye ? [bye] : [];
    for (let i = 0; i < pool.length / 2; i++) {
      const a = pool[i];
      const b = pool[pool.length - 1 - i];
      const aWins = unit(`${key}|${size}|${a}|${b}`) < winChance(medOf(a), medOf(b)) / 100;
      next.push(aWins ? a : b);
      places[aWins ? b : a] = lossPlace;
      if (size <= 2) final = [aWins ? a : b, aWins ? b : a];
    }
    alive = next.sort((x, y) => medOf(x) - medOf(y));
  }
  if (alive[0]) places[alive[0]] = "winner";
  return { places, final };
}

/** The cup of the week elsewhere: one of the steps the player has reached, played by the others. Their points go to the season. */
function otherCup(career: Career, life: Life, week: number): Life {
  const top = LADDER.indexOf(topStep(career));
  const tier = LADDER[Math.floor(unit(`${career.id}|${week}|which`) * (top + 1))] ?? LADDER[0];
  const names = fieldNames(tier, "", week * 31 + career.played, tier.size, life.world);
  if (names.length < 4) return life;
  const medOf = (n: string) => botMed({ ...career, life }, n);
  const { places, final } = playBracket(names, medOf, `${career.id}|${week}|cup`);
  const pts = { ...life.world.pts };
  for (const [n, p] of Object.entries(places)) pts[n] = (pts[n] ?? 0) + (tier.points[p] ?? 0);
  let next: Life = { ...life, world: { ...life.world, pts } };
  const [champion, runnerUp] = final;
  const order = [...names].sort((a, b) => medOf(a) - medOf(b));
  const seed = order.indexOf(champion) + 1;
  if (seed > Math.max(3, names.length / 3)) next = addNews(next, "upset", `${champion} tok ${tier.name} som outsider`, `Nummer ${seed} av ${names.length} på papiret. Slo ${runnerUp} i finalen.`, champion);
  else next = addNews(next, "cup", `${champion} vant ${tier.name}`, `Slo ${runnerUp} i finalen.`, champion);
  return next;
}

/* ----------------------------------------------------------------- offers */

type Template = {
  key: string;
  name: string;
  city: string;
  base: TierId;
  /** What the entry costs and what it pays, against the step it is built on. */
  fee: number;
  prize: number;
  size?: 8 | 16 | 32;
  countdown?: Invitation["countdown"];
  /** A price in dollars that is not a share of the step's (a night with a high stake). */
  feeAbs?: number;
  /** Paid for being there, whatever the place: a share of what the biggest step the player has reached pays to its winner. */
  honorarium?: number;
  /** How many weeks go before the same one comes again. */
  gap?: number;
  /** A win or a final opens the next step the player cannot enter yet. */
  wildcard?: boolean;
  from: Sender;
  tagline: string;
  need: (career: Career) => boolean;
  reason: (career: Career) => string;
};

const lockedStep = (career: Career): Tier | undefined => LADDER.find((t) => t.qualify && !isUnlocked(career, t));
const reached = (career: Career, id: TierId) => LADDER.indexOf(topStep(career)) >= LADDER.findIndex((t) => t.id === id);

const TEMPLATES: Template[] = [
  { key: "ly-sprint", name: "Ly-sprinten", city: "Ly", base: "lu", fee: 0, prize: 0.8, countdown: { start: 301, doubleOut: false }, from: { name: "Puben på Ly", role: "Ly" }, tagline: "En kort kveld i 301", need: () => true, reason: () => "Puben setter opp en kort kveld i 301, uten krav om dobbel." },
  { key: "bergen", name: "Bergen Invitational", city: "Bergen", base: "region", fee: 0.6, prize: 1.1, countdown: { start: 301, doubleOut: true }, from: { name: "Bergen Dartklubb", role: "Arrangør" }, tagline: "301 med dobbel ut", need: (c) => reached(c, "region") || c.points >= 10, reason: (c) => `Invitert fordi du er nr. ${norwayRank(c)} i Norge.` },
  { key: "trondheim", name: "Trondheim Open", city: "Trondheim", base: "region", fee: 0.5, prize: 0.9, from: { name: "Trondheim Dartklubb", role: "Arrangør" }, tagline: "Spilles som karrieren din", need: (c) => c.points >= 10, reason: (c) => `Invitert fordi du har ${c.points} rangpoeng.` },
  { key: "wildcard", name: "Oslo Wildcard", city: "Oslo", base: "region", fee: 0.5, prize: 0.7, wildcard: true, from: { name: "Norges Dartsforbund", role: "Forbundet" }, tagline: "Vinn plassen din", need: (c) => !!lockedStep(c) && c.points >= 10, reason: (c) => `Vinneren og finalisten får plass i ${lockedStep(c)?.name ?? "neste turnering"}.` },
  { key: "stavanger", name: "Stavanger Masters", city: "Stavanger", base: "nm", fee: 0.7, prize: 0.8, countdown: { start: 501, doubleOut: true }, from: { name: "Stavanger Dartklubb", role: "Arrangør" }, tagline: "501 med dobbel ut", need: (c) => reached(c, "nm"), reason: (c) => `Invitert som nr. ${norwayRank(c)} i Norge.` },
  { key: "handicap", name: "Handicapcupen", city: "Drammen", base: "region", fee: 0.5, prize: 1.6, countdown: { start: 301, doubleOut: true, humanStart: 501 }, from: { name: "Drammen Dartklubb", role: "Arrangør" }, tagline: "Du starter på 501, de på 301", need: (c) => c.points >= 10, reason: () => "Du får handicap: 501 mot deres 301. Premien er større." },
  { key: "natt", name: "Nattcupen", city: "Ly", base: "lu", fee: 0, feeAbs: 100, prize: 2.5, size: 8, countdown: { start: 301, doubleOut: true }, gap: 6, from: { name: "Puben på Ly", role: "Ly" }, tagline: "Én natt, høy innsats", need: (c) => c.played >= 3, reason: () => "Én natt, høy innsats: $100 inn, stor premie." },
  { key: "eindhoven", name: "Eindhoven Open", city: "Eindhoven", base: "nm", fee: 0.6, prize: 0.8, countdown: { start: 501, doubleOut: true }, from: { name: "Eindhoven Darts", role: "Arrangør" }, tagline: "501 i Nederland", need: (c) => reached(c, "nm"), reason: (c) => `Invitert som nr. ${norwayRank(c)} i Norge.` },
  { key: "hamburg", name: "Hamburg Masters", city: "Hamburg", base: "nm", fee: 0.6, prize: 0.9, countdown: { start: 301, doubleOut: true }, from: { name: "Hamburg Darts", role: "Arrangør" }, tagline: "301 i Tyskland", need: (c) => reached(c, "region") && c.points >= 25, reason: (c) => `Invitert som nr. ${norwayRank(c)} i Norge.` },
  { key: "tv-kveld", name: "TV-kvelden", city: "TV-studio", base: "vm", fee: 0, prize: 0.2, size: 8, countdown: { start: 501, doubleOut: true }, honorarium: 0.05, gap: 10, from: { name: "TV-selskapet", role: "TV" }, tagline: "Åtte spillere i studio", need: (c) => (norwayRank(c) <= 8 || c.points >= 80) && c.points >= 40, reason: () => "Åtte spillere, én kveld, direkte. Honorar til alle." },
  { key: "norden", name: "Nordisk Invitasjonscup", city: "København", base: "gs", fee: 0.6, prize: 0.7, countdown: { start: 501, doubleOut: true }, from: { name: "Nordisk Dartsunion", role: "Arrangør" }, tagline: "De beste i Norden", need: (c) => reached(c, "gs"), reason: (c) => `Invitert som nr. ${norwayRank(c)} i Norge.` },
];

/** A template as an invitation: the look and scale of its step, with its own name, city, price and prizes. */
function inviteOf(t: Template, career: Career): Invitation {
  const base = TIERS[t.base];
  const scaled = (src: Partial<Record<Place, number>>, f: number, min: number) => Object.fromEntries(Object.entries(src).map(([p, v]) => [p, Math.max(min, round50((v ?? 0) * f))])) as Partial<Record<Place, number>>;
  const next = t.wildcard ? lockedStep(career) : undefined;
  return {
    ...base,
    key: t.key,
    city: t.city,
    name: t.name,
    short: t.city,
    trophy: `${t.name}-pokalen`,
    venue: t.city,
    stage: `Invitasjon · ${t.city}`,
    tagline: t.tagline,
    size: t.size ?? base.size,
    fee: t.feeAbs ?? (base.fee === 0 ? 0 : Math.round((base.fee * t.fee) / 10) * 10),
    ...(t.honorarium ? { honorarium: Math.max(200, round50((topStep(career).prizes.winner ?? 500) * t.honorarium)) } : {}),
    prizes: scaled(base.prizes, t.prize, 50),
    points: Object.fromEntries(Object.entries(base.points).map(([p, v]) => [p, Math.max(1, Math.round((v ?? 0) / 2))])),
    qualify: undefined,
    opens: next ? { tier: next.id, places: ["winner", "final"] } : undefined,
    reason: t.reason(career),
    ...(t.countdown ? { countdown: t.countdown } : {}),
  };
}

const openOf = (life: Life, kind: Offer["kind"]) => life.inbox.filter((m) => m.state === "open" && m.offer.kind === kind);

/** Maybe an invitation: one of the kinds that fit the player now, that has not been sent lately. Never more than two wait at once. */
function maybeInvite(career: Career, life: Life, week: number): Life {
  if (openOf(life, "invite").length >= 2 || unit(`${career.id}|${week}|invite`) > 0.55) return life;
  const sent = (key: string) => Math.min(99, ...life.inbox.filter((m) => m.offer.kind === "invite" && (m.offer as { invite: Invitation }).invite.key === key).map((m) => week - m.week));
  const fits = TEMPLATES.filter((t) => sent(t.key) > (t.gap ?? 4) && t.need(career));
  const t = fits[Math.floor(unit(`${career.id}|${week}|invite-which`) * fits.length)];
  if (!t) return life;
  const invite = inviteOf(t, career);
  return addMessage(life, t.from, invite.name, invite.reason, { kind: "invite", invite }, week + 2);
}

/** The finale of the season: the eight best of the table play it, in the last week, when the player is one of them. */
function maybeFinale(career: Career, life: Life, week: number): Life {
  if (weekInSeason(week) !== WEEKS_PER_SEASON) return life;
  const table = [...peopleOf({ ...career, life }).map((o) => ({ name: o.name, pts: life.world.pts[o.name] ?? 0, med: o.med })), { name: career.player, pts: life.seasonPts, med: career.skillMed }].sort((a, b) => b.pts - a.pts || a.med - b.med);
  const rank = table.findIndex((s) => s.name === career.player) + 1;
  if (rank > 8 || life.seasonPts <= 0) return life;
  const base = topStep(career);
  const scaled = (src: Partial<Record<Place, number>>, f: number, min: number) => Object.fromEntries(Object.entries(src).map(([p, v]) => [p, Math.max(min, round50((v ?? 0) * f))])) as Partial<Record<Place, number>>;
  const invite: Invitation = {
    ...base,
    key: "finale",
    city: "Sesongfinalen",
    name: `Sesongfinalen ${seasonOf(week)}`,
    short: "Finalen",
    trophy: `Sesongfinale ${seasonOf(week)}-pokalen`,
    venue: "Sesongfinalen",
    stage: "Sesongfinale",
    tagline: "De åtte beste i sesongen",
    size: 8,
    fee: 0,
    prizes: scaled(base.prizes, 0.6, 100),
    points: Object.fromEntries(Object.entries(base.points).map(([p, v]) => [p, Math.max(1, Math.round((v ?? 0) / 2))])),
    qualify: undefined,
    opens: undefined,
    reason: `Du er nr. ${rank} i sesongtabellen.`,
    field: table.filter((s) => s.name !== career.player).slice(0, 7).map((s) => s.name),
  };
  return addMessage(life, { name: "Norges Dartsforbund", role: "Forbundet" }, invite.name, invite.reason, { kind: "invite", invite }, week + 1);
}

/** A game for television, now and then, for a player who is doing well: a show of one leg against the strongest there is, with a head start, or the best of three against a name. */
function maybeTv(career: Career, life: Life, week: number): Life {
  const open = life.inbox.some((m) => m.state === "open" && m.offer.kind === "challenge" && m.offer.tv);
  if (career.challenge || open || !(norwayRank(career) <= 12 || career.points >= 40) || unit(`${career.id}|${week}|tv`) > 0.3) return life;
  const since = (title: string) => Math.min(99, ...life.inbox.filter((m) => m.offer.kind === "challenge" && m.offer.tv?.title === title).map((m) => week - m.week));
  const options = [
    { title: "Utfordreren", gap: 8 },
    { title: "Studioduellen", gap: 4 },
  ].filter((o) => since(o.title) > o.gap);
  const pick = options[Math.floor(unit(`${career.id}|${week}|tv-which`) * options.length)];
  if (!pick) return life;
  const base = stakeFor(career, "501");
  const from = { name: "TV-selskapet", role: "TV" };
  if (pick.title === "Utfordreren") {
    const tv = { title: pick.title, honorarium: Math.max(100, round50(base * 0.5)), legs: 1 as const, humanStart: 201, theirStart: 301 };
    return addMessage(life, from, tv.title, "Du mot Littler. Du starter på 201, Littler på 301.", { kind: "challenge", game: "501", opponent: { name: "Littler", skill: 1 }, stake: round50(base * 4), risk: 0, tv }, week + 3);
  }
  const named = peopleOf({ ...career, life }).filter((o) => INTERNATIONALS.some((i) => i.name === o.name));
  const who = named[Math.floor(unit(`${career.id}|${week}|tv-who`) * named.length)];
  if (!who) return life;
  const tv = { title: pick.title, honorarium: Math.max(100, round50(base * 0.3)), legs: 3 as const, humanStart: 301, theirStart: 301 };
  return addMessage(life, from, tv.title, `Best av tre mot ${who.name}.`, { kind: "challenge", game: "501", opponent: { name: who.name, skill: Math.max(1, levelOfMed(who.med * 0.95)) }, stake: round50(base * 2), risk: 0, tv }, week + 3);
}

/** What the player pays when they lose to someone who asked, against what they win: half. */
const riskFor = (stake: number) => Math.max(50, round50(stake / 2));

/** A challenge from someone: a rival who wants the match back, or someone at the bar. It has a time, and saying no costs some of the name. */
function challengeFrom(career: Career, life: Life, week: number, rival: string | null): Life {
  const seed = week * 977 + career.played * 31 + life.counter;
  const game: GameId = rival ? "501" : (["501", "lava", "highstriker"] as GameId[])[Math.floor(unit(`${career.id}|${week}|game`) * 3)];
  const base = newChallenge(career, game, seed);
  const name = rival ?? base.opponent.name;
  const stake = rival ? round50(stakeFor(career, game) * 1.5) : Math.max(50, round50(stakeFor(career, game) * 0.6));
  const risk = rival ? riskFor(stake) : 0;
  const rec = rival ? career.rivals?.[rival] : undefined;
  const title = rival ? (rec && rec.l > rec.w ? `${name} vil ha revansje` : `${name} vil teste deg`) : `${name} tilbyr en kamp`;
  const body = rival ? "Én runde i 501." : `${GAMES[game].name}, én runde.`;
  return addMessage(life, { name, role: rival ? "Rival" : "Stamgjest" }, title, body, { kind: "challenge", game, opponent: { name, skill: base.opponent.skill }, stake, risk }, week + 1);
}

/** Maybe a challenge that nobody asked for: more often the better the name. */
function maybeChallenge(career: Career, life: Life, week: number): Life {
  if (career.challenge || openOf(life, "challenge").length > 0) return life;
  if (unit(`${career.id}|${week}|surprise`) > 0.15 + 0.05 * life.reputation) return life;
  // The ones who ask for a match are the rival, the same one every time, and now and then someone at the bar.
  const rival = unit(`${career.id}|${week}|rival`) < 0.6 ? rivalOf({ ...career, life }).name : null;
  return challengeFrom(career, life, week, rival);
}

const SPONSORS = ["Hansens Rør", "Bjørns Bilpleie", "Gullhaug Bygg", "Café Trøffel", "Nordvik Elektro", "Smia Mat og Vin", "Fjellvik Maskin", "Sandvold Regnskap"];

/**
 * The deals sponsors offer at this point of the career: three, that differ in how long they last and what they pay. The longer the deal, the more
 * it pays for each tournament (a sum for getting as far as the quarter-final, the semi-final higher up). Three firms, one of each.
 */
export function dealsFor(career: Career, seed: string): SponsorDeal[] {
  const step = topStep(career);
  const need: Place = LADDER.indexOf(step) <= 1 ? "quarter" : "semi";
  const base = Math.max(40, Math.round((step.prizes.winner ?? 500) / 30 / 10) * 10);
  const start = Math.floor(unit(`${seed}|sponsor`) * SPONSORS.length);
  return [
    { events: 3, factor: 1 },
    { events: 6, factor: 1.6 },
    { events: 10, factor: 2.2 },
  ].map((d, i) => ({ name: SPONSORS[(start + i * 3) % SPONSORS.length], perEvent: Math.round((base * d.factor) / 10) * 10, need, events: d.events }));
}

/** The three offers go out at once, to be answered in three weeks: one of them can be taken. */
function offerSponsors(career: Career, life: Life, week: number): Life {
  const need = (d: SponsorDeal) => (d.need === "quarter" ? "Til kvartfinalen." : "Til semifinalen.");
  return dealsFor(career, `${career.id}|${week}`).reduceRight((l, deal) => addMessage(l, { name: deal.name, role: "Sponsor" }, `${deal.name} vil sponse deg`, need(deal), { kind: "sponsor", deal }, week + 3), life);
}

/** Now and then a sponsor turns up on its own, once the player has played a little and has a name. */
function maybeSponsor(career: Career, life: Life, week: number): Life {
  if (life.sponsor || openOf(life, "sponsor").length > 0 || life.reputation < 3 || career.played < 2 || unit(`${career.id}|${week}|sponsor`) > 0.3) return life;
  return offerSponsors(career, life, week);
}

/* ----------------------------------------------------------------- the season */

const ROOKIE_FIRST = ["Mathias", "Sander", "Eirik", "Oliver", "Sondre", "Vetle", "Tobias", "Jakob", "Kasper", "Fredrik", "Trym", "Aksel"];
const ROOKIE_LAST = ["Berg", "Strand", "Vik", "Moe", "Olsen", "Solberg", "Berntsen", "Engen", "Rud", "Foss", "Ruud", "Nygård"];

/** The prize for a place in the season: for the best, a quarter of what the biggest tournament the player has reached pays to its winner; less down to tenth. */
export function seasonPrize(rank: number, career: Career): number {
  const first = Math.max(300, round50((topStep(career).prizes.winner ?? 500) / 4));
  return rank === 1 ? first : rank === 2 ? round50(first * 0.6) : rank === 3 ? round50(first * 0.35) : rank <= 10 ? round50(first * 0.1) : 0;
}

/** The season is over: the best of it is paid, the others change, someone stops and someone new comes. */
function endSeason(career: Career, life: Life, week: number): { life: Life; prize: number } {
  const season = seasonOf(week);
  const people = peopleOf({ ...career, life });
  const standings = [...people.map((o) => ({ name: o.name, pts: life.world.pts[o.name] ?? 0, med: o.med })), { name: career.player, pts: life.seasonPts, med: career.skillMed }].sort((a, b) => b.pts - a.pts || a.med - b.med);
  const rank = standings.findIndex((s) => s.name === career.player) + 1;
  const winner = standings[0];
  const prize = seasonPrize(rank, career);
  const result: SeasonResult = { season, rank, points: life.seasonPts, prize, winner: winner.name };
  let next: Life = { ...life, seasons: [result, ...life.seasons].slice(0, 20) };
  // The ranks of the last season, kept for the arrows, before the players change.
  const snap: Record<string, number> = {};
  for (const o of people) snap[o.name] = worldRankOf(o.med);
  // Everyone's strength moves a little; the best of the season a touch sharper.
  const top = new Set(standings.slice(0, 3).map((s) => s.name));
  const drift = { ...life.world.drift };
  for (const o of people) drift[o.name] = clamp((drift[o.name] ?? 1) * (1 + (unit(`${career.id}|${season}|drift|${o.name}`) - 0.5) * 0.08 - (top.has(o.name) ? 0.01 : 0)), 0.85, 1.15);
  // Someone stops, most seasons: one of the older names, never the best.
  const retired = [...life.world.retired];
  const rookies = [...life.world.rookies];
  const mine = rivalOf({ ...career, life }).name;
  const candidates = [...LY_REGULARS, ...INTERNATIONALS].filter((o) => !retired.includes(o.name) && o.med >= 33 && o.name !== mine && !Object.values(BOSSES).includes(o.name));
  const leaves = candidates.length > 0 && retired.length < 10 && unit(`${career.id}|${season}|retire`) < 0.7 ? candidates[Math.floor(unit(`${career.id}|${season}|retire-who`) * candidates.length)] : null;
  if (leaves) retired.push(leaves.name);
  // New players: one in place of the one who stopped, and now and then another.
  const known = new Set([...EVERYONE.map((o) => o.name), ...rookies.map((r) => r.name)]);
  const fresh: Rookie[] = [];
  const count = (leaves ? 1 : 0) + (unit(`${career.id}|${season}|extra`) < 0.4 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const first = ROOKIE_FIRST[Math.floor(unit(`${career.id}|${season}|rf${i}`) * ROOKIE_FIRST.length)];
    const last = ROOKIE_LAST[Math.floor(unit(`${career.id}|${season}|rl${i}`) * ROOKIE_LAST.length)];
    const name = `${first} ${last}`;
    if (known.has(name)) continue;
    known.add(name);
    fresh.push({ name, med: 33 + unit(`${career.id}|${season}|rm${i}`) * 10, age: 17 + Math.floor(unit(`${career.id}|${season}|ra${i}`) * 5), since: season + 1 });
  }
  next = { ...next, world: { drift, retired, rookies: [...rookies, ...fresh].slice(-12), pts: {}, snap }, seasonPts: 0 };
  // The word about it.
  const youWon = winner.name === career.player;
  next = addNews(next, "season", youWon ? `Du er årets spiller, sesong ${season}` : `${winner.name} er årets spiller, sesong ${season}`, `${winner.pts} poeng. ${rank === 1 ? "" : `Du ble nummer ${rank} med ${life.seasonPts}.`}`.trim(), youWon ? career.player : winner.name);
  if (leaves) next = addNews(next, "world", `${leaves.name} legger opp`, "Etter en lang karriere på brettet.", leaves.name);
  for (const r of fresh) next = addNews(next, "world", `Nytt navn: ${r.name}, ${r.age} år`, "Kommer inn på listene fra neste sesong.", r.name);
  next = addMessage(next, { name: "Norges Dartsforbund", role: "Forbundet" }, `Sesong ${season} er over`, `Du ble nummer ${rank} av ${standings.length} med ${life.seasonPts} poeng.${prize > 0 ? ` Sesongpremien er ${dollars(prize)}.` : ""} Ny sesong starter nå.`, { kind: "info" });
  return { life: next, prize };
}

/* ----------------------------------------------------------------- a week goes by */

/** A week has gone by: the others play their tournament, messages that ran out are closed, offers come, and when the tenth week is over, the season ends. */
export function advanceWeek(career: Career): Career {
  let life = lifeOf(career);
  const was = life.week;
  const week = was + 1;
  life = otherCup(career, life, was);
  life = { ...life, week };
  // Offers that were not answered in time: a challenge that goes by is a no, which the name remembers.
  const late = life.inbox.filter((m) => isLate(m, week));
  const missed = late.filter((m) => m.offer.kind === "challenge" && !m.offer.tv).length;
  life = { ...life, reputation: Math.max(0, life.reputation - missed), inbox: life.inbox.map((m) => (late.includes(m) ? { ...m, state: "expired" as const } : m)) };
  let money = career.money;
  if (seasonOf(week) > seasonOf(was)) {
    const ended = endSeason(career, life, was);
    life = ended.life;
    money += ended.prize;
  }
  life = maybeFinale(career, life, week);
  life = maybeInvite(career, life, week);
  life = maybeTv(career, life, week);
  life = maybeChallenge(career, life, week);
  life = maybeSponsor(career, life, week);
  if (weekInSeason(week) % 3 === 0) life = leaderNews(career, life);
  return { ...career, money, life };
}

const isLate = (m: Message, week: number) => m.state === "open" && m.offer.kind !== "info" && m.until !== undefined && m.until < week;

/** Who leads the season now, as a line of news. */
function leaderNews(career: Career, life: Life): Life {
  const board = [...Object.entries(life.world.pts), [career.player, life.seasonPts] as [string, number]].sort((a, b) => b[1] - a[1]);
  const [name, pts] = board[0] ?? [];
  if (!name || pts <= 0) return life;
  return name === career.player ? addNews(life, "season", "Du leder sesongen", `${pts} poeng etter uke ${weekInSeason(life.week - 1)}.`, career.player) : addNews(life, "season", `${name} leder sesongen`, `${pts} poeng etter uke ${weekInSeason(life.week - 1)}.`, name);
}

/* ----------------------------------------------------------------- leaving an event */

/** What the sponsor does with the tournament that has just been played, for the result screen and for the account. Null without a deal or a result. */
export function sponsorOutcome(career: Career): { name: string; met: boolean; pay: number; need: Place } | null {
  const s = lifeOf(career).sponsor;
  const r = career.active?.result;
  if (!s || !r) return null;
  const met = placeMeets(r.place, s.need);
  return { name: s.name, met, pay: met ? s.perEvent : 0, need: s.need };
}

const CONGRATS: Record<TierId, string> = { lu: "Puben på Ly", region: "Regionforbundet", nm: "Norges Dartsforbund", gs: "Slam-arrangøren", vm: "Verdensforbundet" };

const WENT: Record<Place, string> = { winner: "vant", final: "tapte finalen i", semi: "tapte semifinalen i", quarter: "tapte kvartfinalen i", r16: "røk ut i åttedelsfinalen i", r32: "røk ut i første runde i" };

/** The player leaves a finished event: the sponsor pays or not, the result is news, a rival may ask for the match back, and the week goes by. */
export function leaveEvent(career: Career): Career {
  const a = career.active;
  const r = a?.result;
  if (!a || !r) return career;
  let life = lifeOf(career);
  let money = career.money;
  const tier = a.invite ?? TIERS[a.tier];
  // The sponsor.
  const so = sponsorOutcome(career);
  if (so && life.sponsor) {
    const s = life.sponsor;
    const next = { ...s, left: s.left - 1, misses: s.misses + (so.met ? 0 : 1), earned: s.earned + so.pay };
    money += so.pay;
    if (next.misses >= 3) {
      life = addMessage({ ...life, sponsor: null, reputation: Math.max(0, life.reputation - 1) }, { name: s.name, role: "Sponsor" }, "Avtalen er brutt", `${s.name} har ventet på en plass blant de ${s.need === "quarter" ? "åtte" : "fire"} beste tre ganger. De avslutter avtalen. Den ga ${dollars(next.earned)}.`, { kind: "info" });
    } else if (next.left <= 0) {
      life = addMessage({ ...life, sponsor: null }, { name: s.name, role: "Sponsor" }, "Avtalen er over", `Takk for samarbeidet. Avtalen ga ${dollars(next.earned)}.`, { kind: "info" });
    } else life = { ...life, sponsor: next };
  }
  // The news about the player.
  life = addNews(life, "you", `${career.player} ${WENT[r.place]} ${tier.name}`, `${r.prize > 0 ? `+${dollars(r.prize)} · ` : ""}+${r.points} rangpoeng`, career.player);
  life = { ...life, seasonPts: life.seasonPts + r.points };
  if (r.place === "winner") {
    life = { ...life, reputation: Math.min(REP_MAX, life.reputation + 1) };
    life = addMessage(life, { name: a.invite ? a.invite.city : CONGRATS[a.tier], role: "Gratulerer" }, `Gratulerer med ${tier.name}`, `Du tok tittelen og ${dollars(r.prize)}.`, { kind: "info" });
  }
  // The first title brings sponsors: three of them, with a deal each.
  if (r.place === "winner" && career.titles === 1 && !life.sponsor && openOf(life, "sponsor").length === 0) life = offerSponsors(career, life, life.week);
  // The rival writes after a tournament, and asks for the match back when they have the better of the two.
  const rival = rivalOf({ ...career, life }).name;
  const m = a.tournament?.matches.find((x) => !x.isBronzeMatch && x.winner && x.winner !== career.player && [x.participantA, x.participantB].includes(career.player));
  const by = m ? [m.participantA, m.participantB].find((n) => n && n !== career.player) ?? null : null;
  const rec = career.rivals?.[rival];
  let next = withLife({ ...career, money }, life);
  if (by === rival && rec && rec.l > rec.w && !next.challenge && openOf(life, "challenge").length === 0 && unit(`${career.id}|${life.week}|ask`) < 0.7) {
    next = withLife(next, challengeFrom(next, life, life.week, rival));
  } else if (unit(`${career.id}|${life.week}|line`) < 0.5) {
    const line = r.place === "winner" ? "Bra spilt. Neste gang er det min tur." : by === rival ? "Det var meg som tok deg. Vi sees." : r.place === "final" ? "Så nærme. Jeg venter i neste finale." : "Jeg ser deg i neste turnering.";
    next = withLife(next, addMessage(life, { name: rival, role: "Rival" }, rival, line, { kind: "info" }));
  }
  return advanceWeek(closeEvent(next));
}

/** The player gives an event up: it is gone, and the week goes by all the same. */
export function leaveAbandoned(career: Career): Career {
  if (!career.active || career.active.result) return career;
  return advanceWeek(abandonEvent(career));
}

/* ----------------------------------------------------------------- answering the inbox */

const patch = (life: Life, id: string, change: Partial<Message>): Life => ({ ...life, inbox: life.inbox.map((m) => (m.id === id ? { ...m, ...change } : m)) });

/** Why an offer cannot be taken now, or null when it can. */
export function whyNotAnswer(career: Career, m: Message): string | null {
  if (m.state !== "open") return null;
  const o = m.offer;
  if (o.kind === "invite") {
    if (career.active) return "Fullfør turneringen først";
    if (career.challenge) return "Fullfør duellen først";
    return whyNot(career, o.invite) ?? null;
  }
  if (o.kind === "challenge") return career.active || career.challenge ? "Fullfør det som pågår først" : null;
  if (o.kind === "sponsor") return lifeOf(career).sponsor ? "Du har en avtale fra før" : null;
  return null;
}

/** The player has read a message. */
export function markRead(career: Career, id: string): Career {
  const life = lifeOf(career);
  const m = life.inbox.find((x) => x.id === id);
  return m && !m.read ? withLife(career, patch(life, id, { read: true })) : career;
}

/** The player has seen the news. */
export function markNewsSeen(career: Career): Career {
  const life = lifeOf(career);
  return life.newsSeen === life.counter ? career : withLife(career, { ...life, newsSeen: life.counter });
}

/** Says yes or no to an offer. A yes to an invitation signs the player up (the fee is paid, the field is made); a yes to a challenge puts it on the table; a yes to a sponsor signs the deal. */
export function answerMessage(career: Career, id: string, accept: boolean, seed: number): Career {
  const life = lifeOf(career);
  const m = life.inbox.find((x) => x.id === id);
  if (!m || m.state !== "open" || m.offer.kind === "info") return career;
  const o = m.offer;
  if (!accept) {
    // Saying no to a challenge costs some of the name; the others are only turned down.
    const rep = o.kind === "challenge" && !o.tv ? Math.max(0, life.reputation - 1) : life.reputation;
    return withLife(career, { ...patch(life, id, { state: "declined", read: true }), reputation: rep });
  }
  if (whyNotAnswer(career, m)) return career;
  if (o.kind === "invite") {
    const started = startEvent(career, o.invite.id, seed, o.invite);
    if (started === career) return career;
    return withLife(started, patch(lifeOf(started), id, { state: "taken", read: true }));
  }
  if (o.kind === "challenge") {
    const challenge: Challenge = { id: `${career.id}-c${seed}`, game: o.game, opponent: o.opponent, stake: o.stake, won: null, risk: o.risk, from: id, ...(o.tv ? { tv: o.tv } : {}) };
    return withLife({ ...career, challenge, challenges: career.challenges + 1 }, patch(life, id, { state: "taken", read: true }));
  }
  // One deal at a time: the other offers are closed.
  const closed: Life = { ...life, inbox: life.inbox.map((x) => (x.id === id ? { ...x, state: "taken" as const, read: true } : x.state === "open" && x.offer.kind === "sponsor" ? { ...x, state: "declined" as const } : x)) };
  return withLife(career, { ...closed, sponsor: { ...o.deal, left: o.deal.events, misses: 0, earned: 0 } });
}

