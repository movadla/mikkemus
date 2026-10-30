/**
 * Killer: every player throws one dart to get a number of their own (a number someone has is not given again). To become a killer you have to hit
 * your own number three times (a double counts for two and a treble for three). A killer takes lives from the others by hitting their numbers (a
 * double takes two lives, a treble three), and loses a life by hitting their own. A killer who loses a life is not a killer any more: hits on their own
 * number then give the lives back (a double two, a treble three), and when they are at full lives again they are a killer again. A player with no lives
 * is out, and the last one standing wins.
 *
 * Three darts a round. A team has one number and its lives together, and its members throw a round each, in turn (in the first part, the first of
 * them throws for the team). The game is a list of darts, in the order they were thrown, as in Lava: a section id (the number, 100 and the number for
 * its double, 200 and the number for its treble, the bull is 25 and a miss is 0); everything else is worked out from it, so taking a dart back is
 * taking the last one off.
 */
import { BULL, MISS, fieldKind, fieldNumber } from "./lava";

export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 9;
export const DARTS_PER_ROUND = 3;
/** Hits on your own number to become a killer. */
export const HITS_TO_KILLER = 3;

export type KillerMember = { name: string; isBot: boolean; botLevel?: number };

export type KillerGame = {
  lives: number;
  players: string[];
  /** The section each dart hit, in order; MISS (0) is a dart that found none. */
  darts: number[];
  /** The people of the sides that are teams. */
  rosters?: Record<string, KillerMember[]>;
};

/**
 * What a dart did.
 * claim: got a number. taken: that number is someone's, throw again. again: no number (a miss, the bull): throw again.
 * progress: a hit on the own number, short of three. killer: the third, or the lives back to full for one who was a killer: a killer. self: a killer hit
 * their own number, a life lost (and the status). selfout: that was the last life. heal: lives given back by a hit on the own number. hit: a killer took lives
 * from another. kill: and it was the last. nothing/miss: no effect.
 */
export type KillerEffect = "claim" | "taken" | "again" | "progress" | "killer" | "self" | "selfout" | "heal" | "hit" | "kill" | "nothing" | "miss";

export type KillerDart = {
  player: string;
  /** Who of a team threw it. */
  by?: string;
  section: number;
  /** The number it was on (0 for a miss and the bull). */
  number: number;
  effect: KillerEffect;
  /** Whose number a killer hit, and how many lives that took. */
  victim?: string;
  livesLost?: number;
  /** Which dart of the round it was, from 0 (in the first part there are no rounds: 0). */
  nth: number;
};

export type KillerState = {
  phase: "claim" | "play";
  numbers: Record<string, number | null>;
  /** Hits on the own number, up to three. */
  hits: Record<string, number>;
  killer: Record<string, boolean>;
  /** Was a killer and lost a life: the lives have to be won back, by hitting the own number, to be one again. */
  regain: Record<string, boolean>;
  lives: Record<string, number>;
  /** Players each has taken out. */
  kills: Record<string, number>;
  /** Rounds each has thrown (in the second part). */
  rounds: Record<string, number>;
  up: string;
  /** How many darts of the round now going on are thrown. */
  thrown: number;
  /** Who throws, when the side up is a team. */
  member: KillerMember | null;
  log: KillerDart[];
  round: KillerDart[];
  winner: string | null;
};

export function newGame(lives: number, players: string[], rosters?: Record<string, KillerMember[]>): KillerGame {
  return { lives: Math.max(MIN_LIVES, Math.min(MAX_LIVES, lives)), players, darts: [], ...(rosters && Object.keys(rosters).length > 0 ? { rosters } : {}) };
}

/** How much a dart in the section counts for: a single is 1, a double 2 and a treble 3. */
export const multiplierOf = (section: number): number => (fieldKind(section) === "t" ? 3 : fieldKind(section) === "d" ? 2 : 1);

/** Works the game out from its darts. */
export function stateOf(g: KillerGame): KillerState {
  const numbers: Record<string, number | null> = Object.fromEntries(g.players.map((p) => [p, null]));
  const hits: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, 0]));
  const killer: Record<string, boolean> = Object.fromEntries(g.players.map((p) => [p, false]));
  const regain: Record<string, boolean> = Object.fromEntries(g.players.map((p) => [p, false]));
  const lives: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, g.lives]));
  const kills: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, 0]));
  const rounds: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, 0]));
  const log: KillerDart[] = [];
  let phase: "claim" | "play" = "claim";
  let up = g.players[0];
  let thrown = 0;
  let round: KillerDart[] = [];
  let winner: string | null = null;

  const nextAlive = (from: string): string => {
    const i = g.players.indexOf(from);
    for (let step = 1; step <= g.players.length; step++) {
      const p = g.players[(i + step) % g.players.length];
      if (lives[p] > 0) return p;
    }
    return from;
  };
  const memberOf = (p: string): KillerMember | null => {
    const roster = g.rosters?.[p];
    if (!roster || roster.length === 0) return null;
    return phase === "claim" ? roster[0] : roster[rounds[p] % roster.length];
  };

  for (const section of g.darts) {
    if (winner) break;
    const by = memberOf(up)?.name;
    const number = section === MISS || section === BULL ? 0 : fieldNumber(section);
    const mult = number === 0 ? 0 : multiplierOf(section);
    const dart: KillerDart = { player: up, ...(by ? { by } : {}), section, number, effect: "miss", nth: phase === "claim" ? 0 : thrown };

    if (phase === "claim") {
      if (number === 0) dart.effect = "again";
      else if (Object.values(numbers).includes(number)) dart.effect = "taken";
      else {
        numbers[up] = number;
        dart.effect = "claim";
      }
      log.push(dart);
      if (dart.effect === "claim") {
        const next = g.players.find((p) => numbers[p] === null);
        if (next) up = next;
        else {
          phase = "play";
          up = g.players[0];
          thrown = 0;
          round = [];
        }
      }
      continue;
    }

    if (number === 0) dart.effect = "miss";
    else if (number === numbers[up]) {
      if (killer[up]) {
        // A killer who hits their own number loses a life, and with it the status.
        lives[up] -= 1;
        killer[up] = false;
        regain[up] = true;
        dart.effect = lives[up] <= 0 ? "selfout" : "self";
      } else if (lives[up] < g.lives) {
        // Short of lives: the own number gives them back, and a killer who lost the status is one again at full lives.
        lives[up] = Math.min(g.lives, lives[up] + mult);
        if (lives[up] >= g.lives && regain[up]) {
          killer[up] = true;
          regain[up] = false;
          dart.effect = "killer";
        } else dart.effect = "heal";
      } else {
        hits[up] = Math.min(HITS_TO_KILLER, hits[up] + mult);
        if (hits[up] >= HITS_TO_KILLER) {
          killer[up] = true;
          dart.effect = "killer";
        } else dart.effect = "progress";
      }
    } else {
      const victim = g.players.find((p) => p !== up && lives[p] > 0 && numbers[p] === number);
      if (victim && killer[up]) {
        const lost = Math.min(mult, lives[victim]);
        lives[victim] -= mult;
        // A killer who is hit and lives on is not a killer any more.
        if (lives[victim] > 0 && killer[victim]) {
          killer[victim] = false;
          regain[victim] = true;
        }
        dart.victim = victim;
        dart.livesLost = lost;
        if (lives[victim] <= 0) {
          dart.effect = "kill";
          kills[up] += 1;
        } else dart.effect = "hit";
      } else dart.effect = "nothing";
    }
    thrown += 1;
    log.push(dart);
    round.push(dart);
    const alive = g.players.filter((p) => lives[p] > 0);
    if (g.players.length > 1 && alive.length === 1) {
      winner = alive[0];
      break;
    }
    if (lives[up] <= 0 || thrown === DARTS_PER_ROUND) {
      rounds[up] += 1;
      up = nextAlive(up);
      thrown = 0;
      round = [];
    }
  }
  return { phase, numbers, hits, killer, regain, lives, kills, rounds, up, thrown, member: winner ? null : memberOf(up), log, round, winner };
}

/** A dart thrown. Nothing happens once there is a winner. */
export function playDart(g: KillerGame, section: number): KillerGame {
  if (stateOf(g).winner) return g;
  return { ...g, darts: [...g.darts, section] };
}

/** The last dart taken back. */
export function undoDart(g: KillerGame): KillerGame {
  return g.darts.length === 0 ? g : { ...g, darts: g.darts.slice(0, -1) };
}

export const livesLeft = (s: KillerState, player: string) => s.lives[player] ?? 0;
export const isOut = (s: KillerState, player: string) => livesLeft(s, player) <= 0;

/** The sections that cannot be hit for a result, as the board shows them sunk: the numbers someone has (in the first part, so they cannot be chosen
 *  again), or in the second part every number but those a player still alive has. The bull is never a target. */
export function sunkSections(s: KillerState, game: KillerGame): Set<number> {
  const sunk = new Set<number>([BULL]);
  const alive = new Set(game.players.filter((p) => s.lives[p] > 0).map((p) => s.numbers[p]).filter((n): n is number => n !== null));
  const taken = new Set(Object.values(s.numbers).filter((n): n is number => n !== null));
  for (let n = 1; n <= 20; n++) {
    const gone = s.phase === "claim" ? taken.has(n) : !alive.has(n);
    if (gone) [n, 100 + n, 200 + n].forEach((x) => sunk.add(x));
  }
  return sunk;
}

/** How a number is said: «20», «D20» or «T20» for what was hit. */
export function hitLabel(section: number): string {
  if (section === MISS) return "bom";
  if (section === BULL) return "bull";
  const k = fieldKind(section);
  return `${k === "t" ? "T" : k === "d" ? "D" : ""}${fieldNumber(section)}`;
}
