/**
 * Kveldsscore: the points of an evening, from the matches of every game played on it. A match is a list of sides (a player, or a team with its
 * people) in the order they finished. In a match between two sides the winner's people get one point each; with three or more the places give
 * 3, 2 and 1 points (and nothing after that). A match that was overridden says who won, or that it was a draw (no points); the original result
 * is kept, so it can be put back. A match that is taken out of the evening stays in the list, marked, so that it can be brought back.
 *
 * Only matches between people count: a match with a bot in it is never written (see lib/nightScoreStorage.ts).
 */
import type { Feat, NightBonus } from "./bonus";
import { FEAT_NAMES } from "./bonus";

export type NightGame = "enkeltkamp" | "turnering" | "bullduel" | "301" | "501" | "highstriker" | "lava" | "halvit" | "killer" | "annet";

export const NIGHT_GAME_NAMES: Record<NightGame, string> = {
  enkeltkamp: "Enkeltkamp",
  turnering: "Turnering",
  bullduel: "Bull-duell",
  "301": "301",
  "501": "501",
  highstriker: "Highstriker",
  lava: "Lava",
  halvit: "Halv It",
  killer: "Killer",
  annet: "Annet",
};

/** The short mark on a line: what game it was. */
export const NIGHT_GAME_MARKS: Record<NightGame, string> = { enkeltkamp: "1v1", turnering: "CUP", bullduel: "BULL", "301": "301", "501": "501", highstriker: "HS", lava: "LAVA", halvit: "½", killer: "KILL", annet: "•••" };

export type NightSide = {
  /** The name of the side: a player, or the name of a team. */
  name: string;
  /** The people on it: the player alone, or the members of a team. They are the ones who get the points. */
  members: string[];
};

export type NightMatch = {
  id: string;
  /** The evening it belongs to. */
  evening: string;
  /** When it was played, ISO. */
  at: string;
  game: NightGame;
  sides: NightSide[];
  /** The names of the sides in the order they finished: the winner first. */
  placements: string[];
  /** The result as overridden: the order of the sides (the winner first), or a draw. The original is `placements`. */
  override?: { placements: string[] } | { draw: true };
  /** Taken out of the evening. */
  deleted?: boolean;
  /** Written in by hand. */
  manual?: boolean;
  /** Feats that give a person an extra point (180 in 301/501, three bulls, a checkout of 100 or more), when the game was set to count them. */
  bonus?: NightBonus[];
  /** The match is a series (best of 3, say): what each side won, and how long it was. The series is one match in the evening, and its winner gets the point. */
  series?: { bestOf: number; wins: Record<string, number> };
  /** Where the match can be opened from: a match page, a tournament. */
  source?: { kind: "match"; id: string } | { kind: "tournament"; id: string } | { kind: "game"; id: string };
};

export type Evening = { id: string; startedAt: string };

/** The places that give points in a match of three or more sides. */
export const PLACE_POINTS = [3, 2, 1];

/** What the match came to: the order of the sides, or null for a draw. */
export function resultOf(m: NightMatch): string[] | null {
  if (m.override) return "draw" in m.override ? null : m.override.placements;
  return m.placements;
}

export const isOverridden = (m: NightMatch): boolean => !!m.override;

/** The points each person got from a match. A match taken out of the evening, and a draw, give none. */
export function pointsOf(m: NightMatch): Record<string, number> {
  const out: Record<string, number> = {};
  const order = resultOf(m);
  for (const s of m.sides) for (const p of s.members) out[p] ??= 0;
  if (m.deleted) return out;
  // A draw gives no place points; the feats still count.
  (order ? m.sides : []).forEach((s) => {
    const place = (order ?? []).indexOf(s.name);
    if (place === -1) return;
    const points = m.sides.length === 2 ? (place === 0 ? 1 : 0) : (PLACE_POINTS[place] ?? 0);
    for (const p of s.members) out[p] = (out[p] ?? 0) + points;
  });
  // The extra points are for the person who did it, and count whatever the result was.
  for (const b of m.bonus ?? []) if (b.who in out) out[b.who] += 1;
  return out;
}

/** The feats of a match as a sentence: «Lars: 180, Vadla: tre i bull». */
export const bonusText = (m: NightMatch): string => (m.bonus ?? []).map((b) => `${b.who}: ${FEAT_NAMES[b.feat as Feat].toLowerCase()}`).join(", ");

export type NightRow = { name: string; points: number; matches: number; wins: number; losses: number; /** The extra points among the points. */ bonus: number };

/** The table of an evening: the people with the most points first, then the most wins, then the fewest matches (the same points in fewer matches is better). */
export function tableOf(matches: NightMatch[]): NightRow[] {
  const rows = new Map<string, NightRow>();
  for (const m of matches) {
    if (m.deleted) continue;
    const points = pointsOf(m);
    const order = resultOf(m);
    for (const s of m.sides) {
      const won = !!order && order[0] === s.name;
      const lost = !!order && order[0] !== s.name;
      for (const p of s.members) {
        const row = rows.get(p) ?? { name: p, points: 0, matches: 0, wins: 0, losses: 0, bonus: 0 };
        row.points += points[p] ?? 0;
        row.bonus += (m.bonus ?? []).filter((b) => b.who === p).length;
        row.matches += 1;
        if (won) row.wins += 1;
        if (lost) row.losses += 1;
        rows.set(p, row);
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.matches - b.matches || a.name.localeCompare(b.name, "no"));
}

/** How a side is written in a line: «Vadla/Monge» for a team (the people), the name for a player. */
export const sideLabel = (s: NightSide): string => (s.members.length > 1 ? s.members.join("/") : s.name);

export type NightLine = {
  /** «Vadla/Monge vs. Hans/Erlend», or the players of a match of more than two. */
  title: string;
  /** «1-0», «0-1» or «0-0» for a draw; empty for a match of more than two sides. */
  score: string;
  /** For a match of more than two sides, who won; for a draw, a word; for a series, how long it was. */
  tag?: string;
  /** The feats with an extra point, when there are any. */
  bonus?: string;
};

/** A match as a line of the list. In the order the sides were put in, not the order they finished, so the line reads the same whoever won. */
export function lineOf(m: NightMatch): NightLine {
  const line = lineWithoutBonus(m);
  return m.bonus && m.bonus.length > 0 ? { ...line, bonus: bonusText(m) } : line;
}

function lineWithoutBonus(m: NightMatch): NightLine {
  const order = resultOf(m);
  if (m.sides.length === 2) {
    const [a, b] = m.sides;
    // A series is told by its games (2-1); once the result is overridden it is told by who won, as any match.
    if (m.series && !m.override) return { title: `${sideLabel(a)} vs. ${sideLabel(b)}`, score: `${m.series.wins[a.name] ?? 0}-${m.series.wins[b.name] ?? 0}`, tag: `Best av ${m.series.bestOf}` };
    const score = !order ? "0-0" : order[0] === a.name ? "1-0" : "0-1";
    return { title: `${sideLabel(a)} vs. ${sideLabel(b)}`, score, ...(!order ? { tag: "Uavgjort" } : {}) };
  }
  const winner = order ? m.sides.find((s) => s.name === order[0]) : null;
  return { title: m.sides.map(sideLabel).join(", "), score: "", tag: winner ? `Vinner ${sideLabel(winner)}` : "Uavgjort" };
}

/** A match with the sides as they were put in, the winner marked: for a result written in by hand or one that is overridden. */
export function placementsFor(m: Pick<NightMatch, "sides">, winnerName: string): string[] {
  return [winnerName, ...m.sides.map((s) => s.name).filter((n) => n !== winnerName)];
}

/** The evening a match belongs to: the latest one that began before it (or the first, if it was played before any began). */
export function eveningOf(evenings: Evening[], at: string): Evening | null {
  const sorted = [...evenings].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let found: Evening | null = null;
  for (const e of sorted) if (e.startedAt <= at) found = e;
  return found ?? sorted[0] ?? null;
}

/** The matches of an evening, newest first. */
export const matchesOf = (matches: NightMatch[], evening: string): NightMatch[] => matches.filter((m) => m.evening === evening).sort((a, b) => b.at.localeCompare(a.at));

/** How many matches count in an evening (those not taken out). */
export const countOf = (matches: NightMatch[]): number => matches.filter((m) => !m.deleted).length;
