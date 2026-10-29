/**
 * What the home screen of the career puts first: the one thing to do next. A cup that is going comes first, then a challenge that is, and
 * otherwise the biggest step of the ladder the player can enter now. The button says what happens and what it gives (lib text only: the
 * screen draws it).
 */
import { nextToThrow } from "./botSim";
import { bracketRoundLabel, matchParticipants, type Tournament } from "./tournament";
import { GAMES, LADDER, TIERS, dollars, eventTier, whyNot, type Career, type Challenge, type Tier } from "./career";

export type Hero =
  | { kind: "event"; tier: Tier; /** The round of the next match, or null when there is none for the player. */ round: string | null; opponent: string | null; drawn: boolean; done: boolean; prize: number }
  | { kind: "challenge"; challenge: Challenge; done: boolean }
  | { kind: "enter"; tier: Tier };

export function heroFor(career: Career): Hero {
  const a = career.active;
  if (a) {
    const tier = eventTier(a);
    if (a.result) return { kind: "event", tier, round: null, opponent: null, drawn: true, done: true, prize: a.result.prize };
    const next = a.tournament ? botSimNext(a.tournament, career.player) : null;
    return { kind: "event", tier, round: next?.round ?? null, opponent: next?.opponent ?? null, drawn: !!a.tournament, done: false, prize: 0 };
  }
  if (career.challenge) return { kind: "challenge", challenge: career.challenge, done: career.challenge.won !== null };
  if (career.played === 0) return { kind: "enter", tier: TIERS.lu };
  const enter = [...LADDER].reverse().find((t) => whyNot(career, t) === null) ?? TIERS.lu;
  return { kind: "enter", tier: enter };
}

/** "Semifinale" is "semifinalen" in a sentence; "8-delsfinale" stays. */
const inSentence = (round: string) => (round.toLowerCase().endsWith("finale") ? `${round.toLowerCase()}n` : round.toLowerCase());

/** What the main button says: one word, and a small line under it for where it leads. */
export function heroButton(hero: Hero): { label: string; sub: string } {
  if (hero.kind === "enter") return { label: "SPILL", sub: `${hero.tier.short} · ${hero.tier.fee === 0 ? "gratis" : dollars(hero.tier.fee)}` };
  if (hero.kind === "challenge") {
    const c = hero.challenge;
    if (hero.done) return c.won ? { label: "HENT", sub: dollars(c.stake) } : { label: "OK", sub: GAMES[c.game].name };
    return { label: "SPILL", sub: c.tv ? `${c.tv.title} · ${c.opponent.name}` : `${GAMES[c.game].name} · ${c.opponent.name}` };
  }
  if (hero.done) return hero.prize > 0 ? { label: "HENT", sub: dollars(hero.prize) } : { label: "OK", sub: hero.tier.short };
  if (!hero.drawn) return { label: "TREKK", sub: hero.tier.short };
  if (hero.round && hero.opponent) return { label: "SPILL", sub: `${hero.round} · ${hero.opponent}` };
  return { label: "FULLFØR", sub: hero.tier.short };
}

/** The short word of a round, for the line under the button. */
export { inSentence };

/** The next match for the player in a cup that is going: its round, and who it is against. Null when the player is out, or nothing is ready. */
function botSimNext(t: Tournament, player: string): { round: string; opponent: string } | null {
  const m = nextToThrow(t);
  if (!m) return null;
  const people = matchParticipants(m);
  if (!people.includes(player)) return null;
  const opponent = people.find((p) => p !== player);
  return opponent ? { round: bracketRoundLabel(m.bracketRoundSize ?? 1, m.isBronzeMatch), opponent } : null;
}
