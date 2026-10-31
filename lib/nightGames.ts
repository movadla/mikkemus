/**
 * The match a finished game puts in Kveldsscore: its sides (a player, or a team with its people) and the order they finished in. A match with a bot
 * in it gives null: only matches between people count. Where a game cannot tell who was second and third, it is told by how it ended.
 */
import { remainingOf, type CountdownGame } from "./countdown";
import { stateOf as halvitState, type HalvItGame } from "./halvit";
import type { HighstrikerGame } from "./highstriker";
import { stateOf as killerState, type KillerGame } from "./killer";
import { stateOf as lavaState, type LavaGame } from "./lava";
import type { NightBonus } from "./bonus";
import { countdownFigures, halvitFigures, highstrikerFigures, killerFigures, lavaFigures, mergeFigures, type FigureSet } from "./nightFigures";
import type { NightGame, NightMatch, NightSide } from "./nightScore";
import type { NewNightMatch } from "./nightScoreStorage";

type Roster = Record<string, { name: string; isBot: boolean }[]> | undefined;

/** The sides of a game, with the people on each. */
export function sidesOf(players: string[], rosters?: Roster): NightSide[] {
  return players.map((name) => ({ name, members: rosters?.[name]?.map((m) => m.name) ?? [name] }));
}

/** Whether a bot is among them, alone or on a team. */
export const hasBot = (players: string[], bots: string[], rosters?: Roster): boolean => players.some((p) => bots.includes(p) || !!rosters?.[p]?.some((m) => m.isBot));

/** What a series (best of x) came to, to be kept with its match: the games each side won. */
export type SeriesResult = NonNullable<NightMatch["series"]>;

const make = (id: string, game: NightGame, players: string[], rosters: Roster, placements: string[], series?: SeriesResult, bonus?: NightBonus[], figures?: FigureSet[]): NewNightMatch => ({ id, game, sides: sidesOf(players, rosters), placements, ...(series ? { series } : {}), ...(bonus && bonus.length > 0 ? { bonus } : {}), ...(figures && figures.length > 0 ? { figures: mergeFigures(figures) } : {}), source: { kind: "game", id } });

/** Those who did not win, ordered by `rank` (the best first). */
const after = (players: string[], winner: string, rank: (p: string) => number): string[] => [winner, ...players.filter((p) => p !== winner).sort((a, b) => rank(a) - rank(b))];

export function countdownNight(g: CountdownGame, winner: string, bots: string[], id: string, series?: SeriesResult, bonus?: NightBonus[], prior?: FigureSet[]): NewNightMatch | null {
  if (hasBot(g.players, bots, g.rosters)) return null;
  return make(id, g.start === 301 ? "301" : "501", g.players, g.rosters, after(g.players, winner, (p) => remainingOf(g, p)), series, bonus, [...(prior ?? []), countdownFigures(g, winner)]);
}

export function highstrikerNight(g: HighstrikerGame, winner: string, bots: string[], id: string, series?: SeriesResult, prior?: FigureSet[]): NewNightMatch | null {
  if (hasBot(g.players, bots, g.rosters)) return null;
  // Out later is better: the turn a side ran out of lives, the later the better.
  const outAt = (p: string) => {
    let lives = g.lives;
    for (let i = 0; i < g.turns.length; i++) {
      if (g.turns[i].player === p && g.turns[i].lostLife) lives -= 1;
      if (lives <= 0) return i;
    }
    return Infinity;
  };
  return make(id, "highstriker", g.players, g.rosters, after(g.players, winner, (p) => -outAt(p)), series, undefined, [...(prior ?? []), highstrikerFigures(g)]);
}

export function lavaNight(g: LavaGame, winner: string, bots: string[], id: string, series?: SeriesResult, prior?: FigureSet[]): NewNightMatch | null {
  if (hasBot(g.players, bots, g.rosters)) return null;
  const log = lavaState(g).log;
  const outAt = (p: string) => log.findIndex((d) => d.player === p && d.knockedOut);
  return make(id, "lava", g.players, g.rosters, after(g.players, winner, (p) => -(outAt(p) === -1 ? Infinity : outAt(p))), series, undefined, [...(prior ?? []), lavaFigures(g)]);
}

export function halvitNight(g: HalvItGame, winner: string, id: string, series?: SeriesResult, prior?: FigureSet[]): NewNightMatch | null {
  const s = halvitState(g);
  return make(id, "halvit", g.players, g.rosters, after(g.players, winner, (p) => -s.scores[p]), series, undefined, [...(prior ?? []), halvitFigures(g)]);
}

export function killerNight(g: KillerGame, winner: string, id: string, series?: SeriesResult, prior?: FigureSet[]): NewNightMatch | null {
  const log = killerState(g).log;
  // The order they went out in: the one who is out last did best of those out.
  const outAt = (p: string) => log.findIndex((d) => (d.effect === "kill" && d.victim === p) || (d.effect === "selfout" && d.player === p));
  return make(id, "killer", g.players, g.rosters, after(g.players, winner, (p) => -(outAt(p) === -1 ? Infinity : outAt(p))), series, undefined, [...(prior ?? []), killerFigures(g)]);
}
