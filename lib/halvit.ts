/**
 * Halv It: ten rounds, each with its own target. Hit it and the points go on the score; miss it (a «bom») and the whole score is halved, rounded
 * up. The one with the most after round 10 wins; a tie is settled by one dart each at the bull until one is left.
 *
 * Everyone throws once in every round, in the order they were put in; a team throws one member at a time, a round each. The game is a list of what
 * each throw made, in order; everything else (whose throw it is, the scores, the round) is worked out from it, so taking one back is taking the last
 * one off. After the tenth round, the entries are the darts at the bull of the tie-break: a hit (points 0, not a bom) or a bom.
 */
export const ROUNDS_IN_ALL = 10;

/** How a round is written in: the sum the darts made, a yes or a no, or the bull with a value of its own. */
export type HalvItInput = "sum" | "yesno" | "bull";

export type HalvItRound = {
  n: number;
  /** The name of the target, as it is told: «Dobbel». */
  name: string;
  input: HalvItInput;
  /** What a yes is worth (yesno). */
  worth?: number;
  /** The largest sum the three darts can make on this target. */
  max?: number;
  /** A sum has to be a multiple of this to be possible (all the darts are worth a multiple of it). */
  step?: number;
  /** The least a sum has to be to count: below it is a bom. */
  min?: number;
};

export const ROUNDS: HalvItRound[] = [
  { n: 1, name: "20-feltet", input: "sum", max: 180, step: 20 },
  { n: 2, name: "Dobbel", input: "sum", max: 120, step: 2 },
  { n: 3, name: "Eksakt 57", input: "yesno", worth: 57 },
  { n: 4, name: "60 ut", input: "yesno", worth: 60 },
  { n: 5, name: "Trippel", input: "sum", max: 180, step: 3 },
  { n: 6, name: "46 eller mer", input: "sum", max: 180, min: 46 },
  { n: 7, name: "Bull", input: "sum", max: 150, step: 25 },
  { n: 8, name: "Trippel 20", input: "sum", max: 180, step: 60 },
  { n: 9, name: "Siste pil i bull", input: "bull" },
  { n: 10, name: "40 ut", input: "yesno", worth: 40 },
];

/** What a bull is worth in round 9: the outer or the inner. */
export const BULL_VALUES = [25, 50] as const;

export type HalvItMember = { name: string; isBot: boolean; botLevel?: number };

export type HalvItEntry = {
  /** Points the throw made (0 for a bom, and for a hit in the tie-break). */
  points: number;
  /** The target was missed: the score is halved. */
  bom: boolean;
};

export type HalvItGame = {
  players: string[];
  entries: HalvItEntry[];
  /** The people of the sides that are teams. A team has one score; its members throw a round each, in turn. */
  rosters?: Record<string, HalvItMember[]>;
};

export function newGame(players: string[], rosters?: Record<string, HalvItMember[]>): HalvItGame {
  return { players, entries: [], ...(rosters && Object.keys(rosters).length > 0 ? { rosters } : {}) };
}

/** Half of a score, rounded up: 85 becomes 43. */
export const halve = (score: number): number => Math.ceil(score / 2);

/** Whether a sum written in could be what three darts made on this round's target (a double round cannot make an odd sum). */
export function possibleSum(round: HalvItRound, sum: number): boolean {
  if (round.input !== "sum") return false;
  if (sum < 0 || sum > (round.max ?? 180)) return false;
  // Below the least, it is a bom: any sum is accepted for it, and it counts as one.
  if (round.min !== undefined) return true;
  return sum % (round.step ?? 1) === 0;
}

/** What a sum written in is worth: its points, or a bom when it is nothing or under the least. */
export function entryForSum(round: HalvItRound, sum: number): HalvItEntry {
  if (sum <= 0 || (round.min !== undefined && sum < round.min)) return { points: 0, bom: true };
  return { points: sum, bom: false };
}

export type HalvItThrow = {
  player: string;
  /** Who of a team threw it. */
  by?: string;
  /** The round, from 1; above 10 is the tie-break. */
  round: number;
  entry: HalvItEntry;
  /** The score before and after. */
  before: number;
  after: number;
};

export type HalvItState = {
  scores: Record<string, number>;
  /** The throws, with what each did to the score. */
  log: HalvItThrow[];
  /** The round that is up (11 and over is the tie-break), whose throw it is and who of the team throws it. */
  round: number;
  up: string;
  member: HalvItMember | null;
  /** The side is the last of the round, so that the round ends with it. */
  tieBreak: boolean;
  /** Those still in the tie-break, in order. */
  contenders: string[];
  winner: string | null;
};

/** Works the game out from its entries. */
export function stateOf(g: HalvItGame): HalvItState {
  const scores: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, 0]));
  const log: HalvItThrow[] = [];
  const thrown: Record<string, number> = {};
  const memberOf = (p: string): HalvItMember | null => {
    const roster = g.rosters?.[p];
    return roster && roster.length > 0 ? roster[(thrown[p] ?? 0) % roster.length] : null;
  };
  let winner: string | null = null;
  let contenders: string[] = [];
  let round = 1;
  let at = 0;
  let order = g.players;
  let hits: string[] = [];

  for (const entry of g.entries) {
    if (winner) break;
    const player = order[at];
    const by = memberOf(player)?.name;
    const before = scores[player];
    if (round <= ROUNDS_IN_ALL) scores[player] = entry.bom ? halve(before) : before + entry.points;
    log.push({ player, ...(by ? { by } : {}), round, entry, before, after: scores[player] });
    thrown[player] = (thrown[player] ?? 0) + 1;
    if (round > ROUNDS_IN_ALL && !entry.bom) hits.push(player);
    at += 1;
    if (at < order.length) continue;
    // The round is over.
    at = 0;
    if (round < ROUNDS_IN_ALL) {
      round += 1;
      continue;
    }
    if (round === ROUNDS_IN_ALL) {
      const top = Math.max(...g.players.map((p) => scores[p]));
      contenders = g.players.filter((p) => scores[p] === top);
      if (contenders.length === 1) {
        winner = contenders[0];
        break;
      }
      order = contenders;
      round += 1;
      hits = [];
      continue;
    }
    // A round of the tie-break: those who hit go on, and when nobody hit, everyone goes again.
    if (hits.length === 1) {
      winner = hits[0];
      break;
    }
    contenders = hits.length > 1 ? hits : contenders;
    order = contenders;
    round += 1;
    hits = [];
  }
  const up = winner ? log[log.length - 1].player : order[at];
  return { scores, log, round, up, member: winner ? null : memberOf(up), tieBreak: round > ROUNDS_IN_ALL, contenders: round > ROUNDS_IN_ALL ? order : [], winner };
}

/** A throw taken in: nothing happens once there is a winner. */
export function playEntry(g: HalvItGame, entry: HalvItEntry): HalvItGame {
  if (stateOf(g).winner) return g;
  return { ...g, entries: [...g.entries, entry] };
}

/** The last throw taken back. */
export function undoEntry(g: HalvItGame): HalvItGame {
  return g.entries.length === 0 ? g : { ...g, entries: g.entries.slice(0, -1) };
}

/** How many times a side has had its score halved in the ten rounds. */
export const halvingsOf = (s: HalvItState, player: string): number => s.log.filter((t) => t.player === player && t.round <= ROUNDS_IN_ALL && t.entry.bom).length;

/** The most a side made in one round. */
export const bestRoundOf = (s: HalvItState, player: string): number => Math.max(0, ...s.log.filter((t) => t.player === player && t.round <= ROUNDS_IN_ALL).map((t) => t.entry.points));
