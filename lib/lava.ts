/**
 * Lava: one board for everyone, and every section is safe until someone hits it. A section that has been hit turns to lava, all of it (the
 * double, the treble and both singles), and from then on a dart in it costs a life. A dart outside the sections (a miss) costs nothing.
 * Three darts a round. A life gone and no more left means out, and the round ends there. The last one standing wins.
 *
 * The sections are the twenty numbers and the bull (25 and 50 are the same section). With doubles and trebles on, the double and the treble of
 * each number are sections of their own, apart from the number itself. When every section has been set on fire and there is still a game, one at
 * random opens again as safe; when it is hit, another opens. The random is worked out from a seed kept with the game, so the same darts always give
 * the same board, and taking a dart back puts it all back as it was.
 * The game is a list of darts in the order they were thrown; everything else (who is up, what is lava, the lives) is worked out from it, so
 * taking a dart back is taking the last one off.
 */
export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 9;
export const DARTS_PER_ROUND = 3;

export const BULL = 25;
export const MISS = 0;
/** The sections of the board: 1 to 20, and the bull. */
export const SECTIONS: number[] = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL];

/** Which sections there are: the numbers and the bull, or also the double and the treble of every number. */
export type LavaFields = "numbers" | "all";
/** A double is 100 and the number, a treble 200 and the number: 120 is D20, 220 is T20. */
const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
export const SECTIONS_ALL: number[] = [...SECTIONS, ...NUMBERS.map((n) => 100 + n), ...NUMBERS.map((n) => 200 + n)];
export const sectionsFor = (fields: LavaFields | undefined): number[] => (fields === "all" ? SECTIONS_ALL : SECTIONS);
/** The number a section is on, and which part of it: the number itself, its double or its treble. */
export const fieldNumber = (section: number): number => (section >= 200 ? section - 200 : section >= 100 ? section - 100 : section);
export const fieldKind = (section: number): "s" | "d" | "t" => (section >= 200 ? "t" : section >= 100 ? "d" : "s");
/** The section a dart counts for, from what it is called ("T20", "D16", "20", "BULL"): the number alone unless doubles and trebles are on. */
export function fieldOfLabel(label: string, section: number, fields: LavaFields | undefined): number {
  if (fields !== "all" || section === MISS || section === BULL) return section;
  const m = /^([TD])(\d{1,2})$/.exec(label);
  if (!m) return section;
  return (m[1] === "T" ? 200 : 100) + Number(m[2]);
}

/** A small seeded random: the same seed and the same count always give the same number from 0 to 1. */
function random(seed: number, count: number): number {
  let t = (seed + count * 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type LavaGame = {
  lives: number;
  players: string[];
  /** Section hit by each dart, in order; MISS (0) is a dart that found none. */
  darts: number[];
  /** Doubles and trebles as sections of their own. Without it (and in older games) the numbers and the bull are the sections. */
  fields?: LavaFields;
  /** What decides which section opens again when all have been set on fire. */
  seed?: number;
};

/** What a dart did: nothing, set a section on fire, or hit one that was already burning. */
export type LavaOutcome = "miss" | "burn" | "lava";

export type LavaDart = {
  player: string;
  section: number;
  outcome: LavaOutcome;
  /** The dart that took the player's last life. */
  knockedOut: boolean;
  /** Which dart of the round it was, from 0. */
  nth: number;
  /** The section that opened again, as safe, because this dart set the last safe one on fire. */
  opened?: number;
};

export type LavaState = {
  /** Sections on fire, mapped to the player who lit them. */
  burned: Map<number, string>;
  lives: Record<string, number>;
  /** Whose round it is, and how many darts of it are thrown. */
  up: string;
  thrown: number;
  /** Every dart, with what it did. */
  log: LavaDart[];
  /** The darts of the round now going on (empty at the start of a round). */
  round: LavaDart[];
  winner: string | null;
};

export function newGame(lives: number, players: string[], fields: LavaFields = "numbers"): LavaGame {
  return { lives: Math.max(MIN_LIVES, Math.min(MAX_LIVES, lives)), players, darts: [], ...(fields === "all" ? { fields } : {}), seed: Math.floor(Math.random() * 2147483647) };
}

/** Works the game out from its darts. */
export function stateOf(g: LavaGame): LavaState {
  const lives: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, g.lives]));
  const burned = new Map<number, string>();
  const everything = sectionsFor(g.fields);
  const seed = g.seed ?? 1;
  let reopened = 0;
  const log: LavaDart[] = [];
  let up = g.players[0];
  let thrown = 0;
  let round: LavaDart[] = [];
  let winner: string | null = null;

  const nextAlive = (from: string): string => {
    const i = g.players.indexOf(from);
    for (let step = 1; step <= g.players.length; step++) {
      const p = g.players[(i + step) % g.players.length];
      if (lives[p] > 0) return p;
    }
    return from;
  };

  for (const section of g.darts) {
    if (winner) break;
    let outcome: LavaOutcome = "miss";
    if (section !== MISS) {
      if (burned.has(section)) {
        outcome = "lava";
        lives[up] -= 1;
      } else {
        outcome = "burn";
        burned.set(section, up);
      }
    }
    const knockedOut = outcome === "lava" && lives[up] <= 0;
    const dart: LavaDart = { player: up, section, outcome, knockedOut, nth: thrown };
    // Every section on fire: one opens again at random (never the one that was just hit, if there is another), and so on for as long as the game goes.
    if (outcome === "burn" && burned.size >= everything.length) {
      const pool = everything.filter((s) => s !== section);
      const pick = pool[Math.floor(random(seed, reopened) * pool.length)];
      burned.delete(pick);
      reopened += 1;
      dart.opened = pick;
    }
    log.push(dart);
    round.push(dart);
    thrown += 1;
    const alive = g.players.filter((p) => lives[p] > 0);
    if (g.players.length > 1 && alive.length === 1) {
      winner = alive[0];
      break;
    }
    if (knockedOut || thrown === DARTS_PER_ROUND) {
      up = nextAlive(up);
      thrown = 0;
      round = [];
    }
  }
  return { burned, lives, up, thrown, log, round, winner };
}

/** A dart thrown: a section, or MISS. Nothing happens once there is a winner. */
export function playDart(g: LavaGame, section: number): LavaGame {
  if (stateOf(g).winner) return g;
  return { ...g, darts: [...g.darts, section] };
}

/** The last dart taken back. */
export function undoDart(g: LavaGame): LavaGame {
  return g.darts.length === 0 ? g : { ...g, darts: g.darts.slice(0, -1) };
}

export const livesLeft = (s: LavaState, player: string) => s.lives[player] ?? 0;
export const isOut = (s: LavaState, player: string) => livesLeft(s, player) <= 0;

/** How many sections a player has set on fire. */
export const burnedBy = (s: LavaState, player: string) => [...s.burned.values()].filter((p) => p === player).length;

/** How many sections are still safe. */
export const safeLeft = (s: LavaState, fields?: LavaFields) => sectionsFor(fields).length - s.burned.size;

/** The label of a section: the number, "D20" or "T20", or "Bull". */
export const sectionLabel = (section: number) =>
  section === BULL ? "Bull" : section === MISS ? "Bom" : section >= 200 ? `T${section - 200}` : section >= 100 ? `D${section - 100}` : String(section);
