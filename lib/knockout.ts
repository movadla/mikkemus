import type { TurnAggregate } from "./game";
import { bracketRoundLabel, bracketSeedOrder, nextPowerOfTwo, type Participant, type Tournament, type TournamentMatch, type TournamentMode } from "./tournament";
import type { GameVariant } from "./rules";
import type { CupConfig } from "./botCup";

/**
 * The straight knockout: every tournament from now on. The whole bracket is made when the tournament is, with the rounds that
 * cannot be known yet left as empty places that remember which match fills them (feedA/feedB). A result fills the next place,
 * so what is drawn on the bracket is always the matches as they stand — before the first one and after every one.
 *
 * The entrants are given strongest first; that order is the seeding (1 meets the lowest, 2 the second lowest, and so on), and
 * the places left over when the number is not a power of two are byes for the top seeds. The semi-final losers play for third.
 */

export function isKnockout(t: Pick<Tournament, "format">): boolean {
  return t.format === "knockout";
}

const matchId = (size: number, index: number, bronze = false) => `bracket-${size}-${index}${bronze ? "-bronze" : ""}`;

function emptyMatch(size: number, index: number, feedA: string, feedB: string, bronze = false): TournamentMatch {
  return {
    id: matchId(size, index, bronze),
    round: "bracket",
    bracketRoundSize: size,
    isBronzeMatch: bronze,
    participantA: null,
    participantB: null,
    feedA,
    feedB,
    ...(bronze ? { feedKind: "loser" as const } : {}),
  };
}

/** The matches of an empty bracket for `n` entrants, in the order they are played: round by round. There is no match for third place: the two who lose the semi-finals share it. */
export function bracketSkeleton(entrants: (string | null)[]): TournamentMatch[] {
  const size = nextPowerOfTwo(entrants.length);
  const order = bracketSeedOrder(size);
  const slots = order.map((seed) => entrants[seed - 1] ?? null);
  const matches: TournamentMatch[] = [];
  const first = size / 2;
  for (let i = 0; i < first; i++) {
    matches.push({ id: matchId(first, i), round: "bracket", bracketRoundSize: first, isBronzeMatch: false, participantA: slots[2 * i], participantB: slots[2 * i + 1] });
  }
  for (let count = first / 2; count >= 1; count /= 2) {
    for (let i = 0; i < count; i++) matches.push(emptyMatch(count, i, matchId(count * 2, 2 * i), matchId(count * 2, 2 * i + 1)));
  }
  return matches;
}

const loserOf = (m: TournamentMatch): string | null => (m.winner ? (m.winner === m.participantA ? m.participantB : m.participantA) : null);

/** Moves every decided match's winner (or loser, for the bronze match) into the place it feeds, and gives a bye its walkover. Idempotent. */
function settle(matches: TournamentMatch[]): TournamentMatch[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const out = matches.map((m) => ({ ...m }));
  const outById = new Map(out.map((m) => [m.id, m]));
  for (const m of out) {
    for (const side of ["A", "B"] as const) {
      const feed = side === "A" ? m.feedA : m.feedB;
      if (!feed) continue;
      const source = outById.get(feed) ?? byId.get(feed);
      if (!source?.winner) continue;
      const who = m.feedKind === "loser" ? loserOf(source) : source.winner;
      if (who) {
        if (side === "A") m.participantA = who;
        else m.participantB = who;
      }
    }
    // A bye: the only entrant goes through without a game, and fills its place in the next round on the same pass.
    if (!m.winner && m.participantA && !m.participantB && !m.feedA && !m.feedB) {
      m.winner = m.participantA;
      m.isBye = true;
    } else if (!m.winner && !m.participantA && m.participantB && !m.feedA && !m.feedB) {
      m.winner = m.participantB;
      m.isBye = true;
    }
  }
  return out;
}

/**
 * A new knockout. `entrants` are in seed order, strongest first. At least two.
 */
export function createKnockout(mode: TournamentMode, entrants: Participant[], id: string, createdAt: string, variant: GameVariant = "standard", cup?: CupConfig): Tournament {
  const names = entrants.map((p) => p.name);
  // Two passes: a bye in the first round fills the second, which may in turn be decided by nothing at all.
  const matches = settle(settle(bracketSkeleton(names)));
  return finish({ id, mode, participants: entrants, groups: [], matches, status: "playoff", createdAt, matchSize: 2, variant, format: "knockout", seeds: names, ...(cup ? { cup } : {}) });
}

/** Marks the tournament done when the final has a winner. */
function finish(t: Tournament): Tournament {
  const final = t.matches.find((m) => m.bracketRoundSize === 1 && !m.isBronzeMatch);
  if (final?.winner && t.status !== "done") return { ...t, status: "done", winner: final.winner, completedAt: new Date().toISOString() };
  return t;
}

/** Records one result in a knockout and moves everyone on. */
export function recordKnockoutResult(t: Tournament, id: string, placements: string[], stats: Record<string, TurnAggregate>, opts: { simulated?: boolean } = {}): Tournament {
  const when = new Date().toISOString();
  const order = Math.max(0, ...t.matches.map((m) => m.decidedOrder ?? 0)) + 1;
  const matches = settle(
    t.matches.map((m) => (m.id === id ? { ...m, winner: placements[0], placements, stats, decidedAt: when, decidedOrder: order, ...(opts.simulated ? { simulated: true } : {}) } : m)),
  );
  return finish({ ...t, matches });
}

/** The next match that can be played: both places filled, no winner. In the order they are played. */
export function nextPlayable(t: Tournament): TournamentMatch | null {
  return t.matches.find((m) => !m.winner && !!m.participantA && !!m.participantB) ?? null;
}

/** The matches fed, directly or further on, by this one. */
function downstream(matches: TournamentMatch[], id: string): TournamentMatch[] {
  const found: TournamentMatch[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const m of matches) {
      if ((m.feedA === from || m.feedB === from) && !found.includes(m)) {
        found.push(m);
        queue.push(m.id);
      }
    }
  }
  return found;
}

/** The match the Angre button would take back: the latest one thrown by hand, if nothing played by hand follows from it. */
export function undoableMatch(t: Tournament): TournamentMatch | null {
  if (!isKnockout(t)) return null;
  const played = t.matches.filter((m) => m.winner && !m.isBye && !m.simulated && m.decidedOrder);
  if (played.length === 0) return null;
  const last = played.reduce((a, b) => (a.decidedOrder! >= b.decidedOrder! ? a : b));
  const after = downstream(t.matches, last.id);
  return after.some((m) => m.winner && !m.simulated) ? null : last;
}

/**
 * Takes the latest result back and reopens that match. What it had decided further on (only ever matches the model decided) is
 * taken back with it, and the places it had filled are empty again. Null when there is nothing that can be taken back.
 */
export function undoLastResult(t: Tournament): Tournament | null {
  const target = undoableMatch(t);
  if (!target) return null;
  const clear = new Set([target.id, ...downstream(t.matches, target.id).map((m) => m.id)]);
  const emptied = new Set(downstream(t.matches, target.id).map((m) => m.id));
  const matches = t.matches.map((m) => {
    if (!clear.has(m.id)) return m;
    const reopened: TournamentMatch = { ...m };
    delete reopened.winner;
    delete reopened.placements;
    delete reopened.stats;
    delete reopened.decidedAt;
    delete reopened.decidedOrder;
    delete reopened.simulated;
    delete reopened.isBye;
    if (emptied.has(m.id)) {
      // The places that came from a feed are empty until the feed is decided again.
      if (m.feedA) reopened.participantA = null;
      if (m.feedB) reopened.participantB = null;
    }
    return reopened;
  });
  const next: Tournament = { ...t, matches: settle(matches), status: "playoff" };
  delete next.winner;
  delete next.completedAt;
  return next;
}

/* ---------- reading the bracket ---------- */

export type BracketRound = { size: number; label: string; short: string; matches: TournamentMatch[] };

const SHORT: Record<number, string> = { 1: "Finale", 2: "Semi", 4: "Kvart" };

/** The rounds, first to last, without the bronze match. */
export function bracketRounds(t: Tournament): BracketRound[] {
  const sizes = Array.from(new Set(t.matches.filter((m) => !m.isBronzeMatch).map((m) => m.bracketRoundSize!))).sort((a, b) => b - a);
  return sizes.map((size) => ({
    size,
    label: bracketRoundLabel(size),
    short: SHORT[size] ?? `R${size * 2}`,
    matches: t.matches.filter((m) => m.bracketRoundSize === size && !m.isBronzeMatch),
  }));
}

export function bronzeMatch(t: Tournament): TournamentMatch | null {
  return t.matches.find((m) => m.isBronzeMatch) ?? null;
}

/** "Vinner Kvartfinale 2" for a place that nobody holds yet. */
export function placeholderLabel(t: Tournament, m: TournamentMatch, side: "A" | "B"): string {
  const feed = side === "A" ? m.feedA : m.feedB;
  const source = feed ? t.matches.find((x) => x.id === feed) : undefined;
  if (!source) return "Frist plass";
  const index = t.matches.filter((x) => x.bracketRoundSize === source.bracketRoundSize && !x.isBronzeMatch).findIndex((x) => x.id === source.id) + 1;
  const name = source.bracketRoundSize === 2 ? "Semifinale" : source.bracketRoundSize === 4 ? "Kvartfinale" : `${source.bracketRoundSize ?? 1}-delsfinale`;
  return `${m.feedKind === "loser" ? "Taper" : "Vinner"} ${name} ${index}`;
}

export function seedOf(t: Tournament, name: string): number | null {
  const i = t.seeds?.indexOf(name) ?? -1;
  return i === -1 ? null : i + 1;
}

/** A side belongs to the house when a real person is on it; a bot, or a team of bots, does not. */
export function isHouse(p: Participant): boolean {
  return p.members ? p.members.some((m) => !m.isBot) : !p.isBot;
}

export function isHouseName(t: Tournament, name: string): boolean {
  const p = t.participants.find((x) => x.name === name);
  return !!p && isHouse(p);
}

/** The place in the bracket someone went out in, or null while they are still in it. A semi-final loser is out of the title race. */
export function outIn(t: Tournament, name: string): TournamentMatch | null {
  for (const m of t.matches) {
    if (!m.winner || m.isBye) continue;
    if ((m.participantA === name || m.participantB === name) && m.winner !== name) {
      return m;
    }
  }
  return null;
}

/** Whether anyone of the house can still win the cup. */
export function houseAlive(t: Tournament): boolean {
  return t.participants.some((p) => isHouse(p) && !outIn(t, p.name));
}

/** The match a side plays next, if it has one lined up or waiting on an earlier result. */
export function upcomingFor(t: Tournament, name: string): TournamentMatch | null {
  return t.matches.find((m) => !m.winner && (m.participantA === name || m.participantB === name)) ?? null;
}

/** Everything a side played on the way, in order, as the opponent, the round and the result. */
export function roadOf(t: Tournament, name: string): { match: TournamentMatch; opponent: string | null; won: boolean; label: string }[] {
  return t.matches
    .filter((m) => m.winner && (m.participantA === name || m.participantB === name))
    .map((m) => ({
      match: m,
      opponent: m.participantA === name ? m.participantB : m.participantA,
      won: m.winner === name,
      label: m.pilot?.label ?? (m.isBronzeMatch ? "Bronsefinale" : bracketRoundLabel(m.bracketRoundSize ?? 1)),
    }));
}

export type Award = { title: string; name: string; detail: string };

/** The small prizes of a finished cup: from what was thrown, not from the model's own matches. */
export function awards(t: Tournament): Award[] {
  const out: Award[] = [];
  const played = t.matches.filter((m) => m.winner && !m.isBye && m.stats);
  let bestRate: { name: string; pct: number } | null = null;
  let fewest: { name: string; darts: number } | null = null;
  for (const m of played) {
    for (const [name, s] of Object.entries(m.stats ?? {})) {
      if (m.simulated) continue;
      const shots = s.hits + s.misses;
      if (shots >= 12) {
        const pct = Math.round((s.hits / shots) * 100);
        if (!bestRate || pct > bestRate.pct) bestRate = { name, pct };
      }
      if (name === m.winner && s.darts > 0 && (!fewest || s.darts < fewest.darts)) fewest = { name, darts: s.darts };
    }
  }
  if (bestRate) out.push({ title: "Best treffprosent", name: bestRate.name, detail: `${bestRate.pct} % i én kamp` });
  if (fewest) out.push({ title: "Færrest piler i en seier", name: fewest.name, detail: `${fewest.darts} piler` });
  let upset: { name: string; over: string; gap: number } | null = null;
  for (const m of played) {
    const a = seedOf(t, m.participantA ?? ""), b = seedOf(t, m.participantB ?? "");
    if (!a || !b || m.isBronzeMatch) continue;
    const winnerSeed = m.winner === m.participantA ? a : b;
    const loserSeed = m.winner === m.participantA ? b : a;
    const gap = winnerSeed - loserSeed;
    if (gap > 0 && (!upset || gap > upset.gap)) upset = { name: m.winner!, over: (m.winner === m.participantA ? m.participantB : m.participantA)!, gap };
  }
  if (upset) out.push({ title: "Største skrell", name: upset.name, detail: `slo ${upset.over}, ${upset.gap} plasser høyere seedet` });
  return out;
}

/* ---------- seeding and the draw ---------- */

/** A small seeded random source: the same draw gives the same order. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The entrants strongest first. `strength` is how good a side is (higher is better); ties keep the order they came in. */
export function seedByStrength<T extends { name: string }>(entrants: T[], strength: (name: string) => number): T[] {
  return entrants
    .map((e, i) => ({ e, i, s: strength(e.name) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.e);
}

/** An open draw: everyone in an order that only the seed decides. */
export function openDraw<T>(entrants: T[], seed: number): T[] {
  const r = rng(seed);
  const order = [...entrants];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Two entrants of the draw swapped: the order a hand-made change gives. */
export function swapEntrants<T>(order: T[], i: number, j: number): T[] {
  const out = [...order];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Who meets whom in the first round for an order of entrants — for the draw screen, before there is a tournament. */
export function firstRoundPairs(names: string[]): { a: string | null; b: string | null }[] {
  const size = nextPowerOfTwo(names.length);
  const order = bracketSeedOrder(size);
  const slots = order.map((seed) => names[seed - 1] ?? null);
  const pairs: { a: string | null; b: string | null }[] = [];
  for (let i = 0; i < slots.length; i += 2) pairs.push({ a: slots[i], b: slots[i + 1] });
  return pairs;
}

/**
 * The matches on one entrant's route through the bracket: the ones they are in, and, while they are still alive, the matches their wins
 * lead to (followed through the feeds, the match a winner goes to). So it is the road so far and the road ahead, and it ends where they
 * lost. Used to light one entrant's way in the tree.
 */
export function routeOf(t: Tournament, name: string): Set<string> {
  const ids = new Set<string>();
  const mine = t.matches.filter((m) => m.participantA === name || m.participantB === name);
  mine.forEach((m) => ids.add(m.id));
  // Their last bracket match: if they won it, or it is still to be played, it leads on.
  const last = [...mine].reverse().find((m) => !m.isBronzeMatch);
  let at: TournamentMatch | undefined = last && (!last.winner || last.winner === name) ? last : undefined;
  while (at) {
    const here: TournamentMatch = at;
    const onward = t.matches.find((m) => !m.isBronzeMatch && (m.feedA === here.id || m.feedB === here.id));
    if (!onward) break;
    ids.add(onward.id);
    at = onward;
  }
  return ids;
}

/** «Vinner Semifinale 2» as the short mark in a bracket box: «Vinner S2». «Taper Kvartfinale 1» is «Taper K1», «Vinner 8-delsfinale 3» is «Vinner 8D 3». */
export function placeholderShort(label: string): string {
  const m = /^(Vinner|Taper) (Semifinale|Kvartfinale|(\d+)-delsfinale) (\d+)$/.exec(label);
  if (!m) return label;
  const round = m[2] === "Semifinale" ? "S" : m[2] === "Kvartfinale" ? "K" : `${m[3]}D `;
  return `${m[1]} ${round}${m[4]}`;
}
