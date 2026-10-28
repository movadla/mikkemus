/**
 * The bots in the games that are not scored dart by dart on the board (301 and 501, Highstriker, Lava). A bot throws like it does
 * everywhere else: it aims at a point, the dart lands off it by the level's own spread (see sigmaForLevel), and where it landed is
 * read off the board. What changes from game to game is only what it aims at.
 */
import type { BotLevel } from "./botLevels";
import { gaussianSample, sigmaForLevel } from "./botStrategy";
import { checkoutsOf } from "./checkout";
import { judge } from "./countdown";
import { aimPointFor, sectorAt } from "./dartboard";
import { BULL, MISS } from "./lava";
import { formatSectorLabel, parseSector } from "./scoliaMapping";

export type Aim = [number, number];

/** How well a bot throws: one of the levels, or a MED in mm of its own (the career sets its bots between the levels). */
export type Skill = BotLevel | number;

/** A dart as it landed: what it is called on the board, what it scores, and which number (or the bull) it is on. */
export type BotDart = {
  sector: string;
  /** "T20", "20", "D16", "BULL", "25" or "BOM". */
  label: string;
  value: number;
  /** A double or the bull: what a finish has to end on. */
  double: boolean;
  /** The section it counts for in Lava: the number, BULL for both rings of the bull, MISS off the board. */
  section: number;
};

/** What a Scolia sector string is worth: "T20" is 60, "Bull" is 50, "25" is 25, "None" is nothing. */
export function dartOfSector(sector: string): BotDart {
  const parsed = parseSector(sector, false);
  const label = formatSectorLabel(parsed);
  if (parsed.kind === "miss") return { sector, label, value: 0, double: false, section: MISS };
  if (parsed.kind === "bull") return { sector, label, value: parsed.ring === "inner" ? 50 : 25, double: parsed.ring === "inner", section: BULL };
  const times = parsed.ring === "T" ? 3 : parsed.ring === "D" ? 2 : 1;
  return { sector, label, value: parsed.number * times, double: parsed.ring === "D", section: parsed.number };
}

/** A dart thrown at a point by a bot of this level: the point and the spread of the level decide where it lands. */
export function throwAt(aim: Aim, level: Skill): BotDart {
  const sigma = sigmaForLevel(level);
  return dartOfSector(sectorAt([aim[0] + gaussianSample(sigma), aim[1] + gaussianSample(sigma)]));
}

/** The throw of a bot: given as a parameter so the tests can throw perfectly. */
export type Thrower = (aim: Aim, level: Skill) => BotDart;

/** Where to aim for a dart as the checkout lines call it: "T20", "D16", "20", "25", "Bull". */
export function aimForLabel(label: string): Aim {
  if (label === "Bull") return [0, 0];
  if (label === "25") return [0, 11];
  const m = /^([TD]?)(\d{1,2})$/.exec(label);
  if (!m) return [0, 0];
  return aimPointFor({ ring: m[1] === "T" ? "T" : m[1] === "D" ? "D" : "S", number: Number(m[2]) });
}

// -- 301 and 501 --------------------------------------------------------------------------------------------------------------

const ways = new Map<string, string[][]>();

/** The ways out of a number, best first. Worked out once per number: the search is the slow part of a bot's dart. */
function waysOut(left: number, doubleOut: boolean): string[][] {
  const key = `${left}:${doubleOut}`;
  let found = ways.get(key);
  if (!found) {
    found = checkoutsOf(left, doubleOut, 12);
    ways.set(key, found);
  }
  return found;
}

/** What a bot aims at with `dartsLeft` darts in the round and `left` to go: the way out when there is one, else what leaves the best way. */
export function chooseCountdownAim(left: number, doubleOut: boolean, dartsLeft: number): string {
  const way = waysOut(left, doubleOut).find((w) => w.length <= dartsLeft);
  if (way) return way[0];
  // No way out yet: the dart that leaves the shortest way out, and the highest of those. Far from out that is simply the treble 20.
  const options = ["T20", "T19", "T18", "T17", "T16", "T15", "20", "19", "18", "17", "16", "15", "14", "13", "12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "25"];
  let best: { label: string; rank: number; value: number } | null = null;
  for (const label of options) {
    const value = dartOfSector(label === "25" ? "25" : /^T/.test(label) ? label : `S${label}`).value;
    const after = left - value;
    if (after < (doubleOut ? 2 : 1)) continue;
    const rank = waysOut(after, doubleOut)[0]?.length ?? 4;
    if (!best || rank < best.rank || (rank === best.rank && value > best.value)) best = { label, rank, value };
  }
  return best?.label ?? "1";
}

export type BotRound = {
  /** What the round made. For a round over the line it is more than what was left, so the game reads it as over. */
  scored: number;
  /** Darts thrown: three, or fewer when the round finished it or went over. */
  darts: number;
  /** What each dart was, as the board calls it. */
  labels: string[];
  bust: boolean;
  finished: boolean;
};

/** One round of 301 or 501 by a bot: up to three darts, stopping on the finish or on going over. A finish has to be a double with a double out. */
export function botCountdownRound(left: number, doubleOut: boolean, level: Skill, thrower: Thrower = throwAt): BotRound {
  const labels: string[] = [];
  let total = 0;
  for (let n = 1; n <= 3; n++) {
    const dart = thrower(aimForLabel(chooseCountdownAim(left - total, doubleOut, 4 - n)), level);
    labels.push(dart.label);
    total += dart.value;
    const verdict = judge(left, total, doubleOut);
    if (verdict === "bust" || (verdict === "finish" && doubleOut && !dart.double)) return { scored: left + 1, darts: 3, labels, bust: true, finished: false };
    if (verdict === "finish") return { scored: total, darts: n, labels, bust: false, finished: true };
  }
  return { scored: total, darts: 3, labels, bust: false, finished: false };
}

// -- Highstriker --------------------------------------------------------------------------------------------------------------

/** The noise a throw is drawn from when the bot weighs where to aim: the same every time, so the choice does not flicker. One unit of spread. */
const NOISE: Aim[] = (() => {
  let seed = 20261027;
  const next = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(next(), Number.EPSILON))) * Math.cos(2 * Math.PI * next());
  return Array.from({ length: 160 }, () => [gauss(), gauss()] as Aim);
})();

/** Where the dart lands when thrown at `aim` with the spread of the level, for each of the weighing draws. */
const landings = (aim: Aim, level: Skill) => {
  const sigma = sigmaForLevel(level);
  return NOISE.map(([dx, dy]) => dartOfSector(sectorAt([aim[0] + dx * sigma, aim[1] + dy * sigma])));
};

const lowAims = new Map<Skill, Aim>();

/** Where to aim for the fewest points: the single of the number that, with the neighbours it can land on, makes the least on average. */
export function lowAim(level: Skill): Aim {
  const known = lowAims.get(level);
  if (known) return known;
  let best: { aim: Aim; mean: number } | null = null;
  for (let n = 1; n <= 20; n++) {
    const aim = aimPointFor({ ring: "S", number: n });
    const mean = landings(aim, level).reduce((s, d) => s + d.value, 0) / NOISE.length;
    if (!best || mean < best.mean) best = { aim, mean };
  }
  lowAims.set(level, best!.aim);
  return best!.aim;
}

/**
 * One round of Highstriker by a bot, to beat `least` (null in the first round, where there is nothing to beat). It throws for the
 * treble 20 until it has made enough, then for as little as it can, so the next one has as little to beat as possible.
 */
export function botHighstrikerRound(least: number | null, level: Skill, thrower: Thrower = throwAt): { scored: number; labels: string[] } {
  const labels: string[] = [];
  let total = 0;
  for (let n = 0; n < 3; n++) {
    let aim: Aim;
    if (least === null) aim = aimForLabel("T20");
    else if (total >= least) aim = lowAim(level);
    else aim = aimForLabel(least - total <= 20 ? "20" : "T20");
    const dart = thrower(aim, level);
    labels.push(dart.label);
    total += dart.value;
  }
  return { scored: total, labels };
}

// -- Lava ---------------------------------------------------------------------------------------------------------------------

const lavaCandidates: Aim[] = (() => {
  const all: Aim[] = [[0, 0]];
  for (let n = 1; n <= 20; n++) {
    for (const radius of [57, 134]) {
      const [x, y] = aimPointFor({ ring: "S", number: n });
      const k = radius / Math.hypot(x, y);
      all.push([x * k, y * k]);
    }
  }
  return all;
})();

/**
 * Where a bot aims in Lava: the point where a dart is least likely to land in a section that is burning, weighing where it could land
 * with the spread of its level. A section not yet burning is worth a little, so of two as safe the one that sets more on fire wins.
 */
export function chooseLavaAim(burned: ReadonlySet<number>, level: Skill): Aim {
  let best: { aim: Aim; value: number } | null = null;
  for (const aim of lavaCandidates) {
    let value = 0;
    for (const d of landings(aim, level)) {
      if (d.section === MISS) continue;
      value += burned.has(d.section) ? -3 : 0.25;
    }
    if (!best || value > best.value) best = { aim, value };
  }
  return best!.aim;
}

/** One dart of Lava by a bot: the section it hit, or MISS. */
export function botLavaDart(burned: ReadonlySet<number>, level: Skill, thrower: Thrower = throwAt): BotDart {
  return thrower(chooseLavaAim(burned, level), level);
}
