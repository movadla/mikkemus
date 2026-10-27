/**
 * Lava: one board for everyone, and every section is safe until someone hits it. A section that has been hit turns to lava, all of it (the
 * double, the treble and both singles), and from then on a dart in it costs a life. A dart outside the sections (a miss) costs nothing.
 * Three darts a round. A life gone and no more left means out, and the round ends there. The last one standing wins.
 *
 * The sections are the twenty numbers and the bull (25 and 50 are the same section). The game is a list of darts in the order they were
 * thrown; everything else (who is up, what is lava, the lives) is worked out from it, so taking a dart back is taking the last one off.
 */
export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 9;
export const DARTS_PER_ROUND = 3;

export const BULL = 25;
export const MISS = 0;
/** The sections of the board: 1 to 20, and the bull. */
export const SECTIONS: number[] = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL];

export type LavaGame = {
  lives: number;
  players: string[];
  /** Section hit by each dart, in order; MISS (0) is a dart that found none. */
  darts: number[];
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

export function newGame(lives: number, players: string[]): LavaGame {
  return { lives: Math.max(MIN_LIVES, Math.min(MAX_LIVES, lives)), players, darts: [] };
}

/** Works the game out from its darts. */
export function stateOf(g: LavaGame): LavaState {
  const lives: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, g.lives]));
  const burned = new Map<number, string>();
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
export const safeLeft = (s: LavaState) => SECTIONS.length - s.burned.size;

/** The label of a section: the number, or "Bull". */
export const sectionLabel = (section: number) => (section === BULL ? "Bull" : section === MISS ? "Bom" : String(section));
