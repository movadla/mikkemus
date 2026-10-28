/**
 * What a career shows on the home screen to keep the player going: the title the points are heading for, and the three goals nearest at hand
 * (the next tournament, the next rank, the next thing for the room). Each is a line, a bar and the way to it, so every visit to the home
 * screen ends with the player a bit closer to something. Plain data in and out.
 */
import { LADDER, SLOTS, TIERS, arenaSteps, dollars, isUnlocked, nextPlace, nextPrice, whyNot, type Career, type Tier } from "./career";

export type Rank = { name: string; /** Ranking points it takes. */ min: number };

/** The titles the ranking points give, on the way up. A world title is a rank of its own, above them. */
export const RANKS: Rank[] = [
  { name: "Pubspiller", min: 0 },
  { name: "Regionspiller", min: 10 },
  { name: "Landslagsspiller", min: 40 },
  { name: "Slam-spiller", min: 120 },
  { name: "Verdensspiller", min: 350 },
];

export const WORLD_CHAMPION = "Verdensmester";

/** The player's title now. */
export function rankOf(career: Career): string {
  if (career.worldTitles > 0) return WORLD_CHAMPION;
  return [...RANKS].reverse().find((r) => career.points >= r.min)?.name ?? RANKS[0].name;
}

/** The title after this one, or null at the top. */
export function nextRank(career: Career): Rank | null {
  if (career.worldTitles > 0) return null;
  return RANKS.find((r) => r.min > career.points) ?? null;
}

export type Goal = {
  id: "tournament" | "rank" | "room";
  /** The thing aimed for. */
  title: string;
  /** What is left to do, in a line. */
  line: string;
  /** How far there is to go, 0 to 1, or null when it is not a matter of a number. */
  progress: number | null;
  /** The small text at the end of the bar. */
  note?: string;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The tournament to aim for: the first step of the ladder the player cannot enter yet, with what is missing. */
function tournamentGoal(career: Career): Goal | null {
  const step = LADDER.find((t) => !career.active && isGap(career, t));
  if (!step) return null;
  if (isUnlocked(career, step)) {
    return { id: "tournament", title: step.name, line: `Du mangler ${dollars(step.fee - career.money)} i inngang`, progress: clamp01(career.money / step.fee), note: `${dollars(career.money)} av ${dollars(step.fee)}` };
  }
  return { id: "tournament", title: step.name, line: step.qualify ?? "Må kvalifiseres", progress: null };
}

/** A step is a gap when it cannot be entered, and it is the nearest such. */
function isGap(career: Career, tier: Tier): boolean {
  return whyNot({ ...career, active: null }, tier) !== null;
}

/** The title to reach: how many points it is. */
function rankGoal(career: Career): Goal | null {
  const next = nextRank(career);
  if (!next) return null;
  const from = [...RANKS].reverse().find((r) => career.points >= r.min)?.min ?? 0;
  return { id: "rank", title: next.name, line: `${next.min - career.points} poeng igjen`, progress: clamp01((career.points - from) / (next.min - from)), note: `${career.points} av ${next.min} poeng` };
}

/** The cheapest thing left to buy for the room (or the next place when everything is bought). */
function roomGoal(career: Career): Goal | null {
  const options = SLOTS.map((s) => ({ s, price: nextPrice(career, s.id) })).filter((o): o is { s: (typeof SLOTS)[number]; price: number } => o.price !== null);
  if (options.length === 0) {
    const place = nextPlace(career);
    return place ? { id: "room", title: place.name, line: place.about, progress: clamp01(career.money / place.price), note: `${dollars(career.money)} av ${dollars(place.price)}` } : null;
  }
  const best = options.sort((a, b) => a.price - b.price)[0];
  const step = career.arena[best.s.id];
  return { id: "room", title: `${best.s.name}: ${best.s.steps[step + 1]}`, line: career.money >= best.price ? "Du har råd til den nå" : `Du mangler ${dollars(best.price - career.money)}`, progress: clamp01(career.money / best.price), note: `${dollars(Math.min(career.money, best.price))} av ${dollars(best.price)}` };
}

/** The goals to show, in the order they are most likely to be reached. */
export function goalsOf(career: Career): Goal[] {
  return [tournamentGoal(career), rankGoal(career), roomGoal(career)].filter((g): g is Goal => g !== null);
}

/** How many steps of the ladder have been opened to this player (for the road). */
export const stepsOpen = (career: Career) => LADDER.filter((t) => isUnlocked(career, t)).length;

/** What the arena has made of the player: steps bought out of all there are. */
export const roomShare = (career: Career) => arenaSteps(career) / (SLOTS.length * 3);

export { TIERS };

/** The rank as a number for the star on the screen: 1 for a pub player, one more for each title above, and one above the last for a world champion. */
export function rankLevel(career: Career): number {
  if (career.worldTitles > 0) return RANKS.length + 1;
  return RANKS.filter((r) => career.points >= r.min).length;
}

/** How far the player is to the next rank, 0 to 1, for the bar on the home screen; null at the top. */
export function rankProgress(career: Career): { next: number; progress: number; points: number; need: number } | null {
  const next = nextRank(career);
  if (!next) return null;
  const from = [...RANKS].reverse().find((r) => career.points >= r.min)?.min ?? 0;
  return { next: rankLevel(career) + 1, progress: clamp01((career.points - from) / (next.min - from)), points: career.points, need: next.min };
}

/** Whether there is something new to buy for the room that the player can afford: the red dot on the room button. */
export function roomBadge(career: Career): boolean {
  return SLOTS.some((s) => {
    const price = nextPrice(career, s.id);
    return price !== null && career.money >= price;
  }) || (() => {
    const place = nextPlace(career);
    return !!place && career.money >= place.price;
  })();
}
