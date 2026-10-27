import { totalMarks, type TurnAggregate } from "./game";
import { withForcedRings, type GameVariant } from "./rules";
import type { CupConfig } from "./botCup";
import type { Participant, PilotInfo, Tournament, TournamentMatch, TournamentMode } from "./tournament";

/**
 * Ly Pilotturnering: sixteen play, four at a time on the board, and the order they finish in decides who goes where.
 *
 *  - Heat A to D, seeded in a snake (1, 8, 9, 16 in A; 2, 7, 10, 15 in B; and so on). The first two of each heat go to the winners'
 *    lanes, the last two to the losers' lanes, the two of a pair to different lanes.
 *  - Two winners' lanes and two losers' lanes, of four each. The first two of a winners' lane are through to the quarter-finals;
 *    the last two go to lucky loser. The first two of a losers' lane go to lucky loser; the last two are out.
 *  - Four lucky loser matches, one against one: the two who were last in a winners' lane each meet one of the two who were first in
 *    the losers' lane of the same number (the better of the first against the weaker of the others). The winners are through to
 *    the quarter-finals.
 *  - Eight in the quarter-finals, one against one: someone straight through meets a winner from lucky loser, from the other lane.
 *    From here the rings are forced (lib/rules.ts). Then the semi-finals and the final. No bronze match.
 *
 * In a match of four the first to close every row wins; the others are placed by how many crosses they are missing, and a tie is a
 * bull-off (lib/bullOff.ts). The whole tournament is made when it is, with the places that cannot be known yet left empty and
 * remembering which result fills them, as in lib/knockout.ts.
 */

export const PILOT_SIZE = 16;

export function isPilot(t: Pick<Tournament, "format">): boolean {
  return t.format === "pilot";
}

/** Who starts in each heat, by seed (1 is the strongest): a snake over four heats. */
export const HEAT_SEEDS: number[][] = [
  [1, 8, 9, 16],
  [2, 7, 10, 15],
  [3, 6, 11, 14],
  [4, 5, 12, 13],
];

/** The order the matches are played in. */
const ORDER = ["h1", "h2", "h3", "h4", "w1", "w2", "l1", "l2", "k1", "k2", "k3", "k4", "q1", "q2", "q3", "q4", "s1", "s2", "f"];

type Spec = { id: string; stage: PilotInfo["stage"]; label: string; slots?: { from: string; place: number }[]; size?: number };

const SPECS: Spec[] = [
  { id: "h1", stage: "heat", label: "Heat A" },
  { id: "h2", stage: "heat", label: "Heat B" },
  { id: "h3", stage: "heat", label: "Heat C" },
  { id: "h4", stage: "heat", label: "Heat D" },
  // The lanes mix the heats: the first and the second of a heat go to different winners' lanes, and the third and the fourth to different
  // losers' lanes, so two who shared a heat do not share a lane again. Still the winners' side and the losers' side apart.
  { id: "w1", stage: "winners", label: "Vinnerbane 1", slots: [{ from: "h1", place: 0 }, { from: "h2", place: 1 }, { from: "h3", place: 0 }, { from: "h4", place: 1 }] },
  { id: "w2", stage: "winners", label: "Vinnerbane 2", slots: [{ from: "h1", place: 1 }, { from: "h2", place: 0 }, { from: "h3", place: 1 }, { from: "h4", place: 0 }] },
  { id: "l1", stage: "losers", label: "Taperbane 1", slots: [{ from: "h1", place: 2 }, { from: "h2", place: 3 }, { from: "h3", place: 2 }, { from: "h4", place: 3 }] },
  { id: "l2", stage: "losers", label: "Taperbane 2", slots: [{ from: "h1", place: 3 }, { from: "h2", place: 2 }, { from: "h3", place: 3 }, { from: "h4", place: 2 }] },
  // Lucky loser, one against one: the last two of a winners' lane against the first two of the losers' lane of the same number. The third
  // of the winners' lane (the better of the two) meets the second of the losers' lane (the weaker), and the fourth meets the first.
  { id: "k1", stage: "lucky", label: "Lucky loser 1", slots: [{ from: "w1", place: 2 }, { from: "l1", place: 1 }] },
  { id: "k2", stage: "lucky", label: "Lucky loser 2", slots: [{ from: "w1", place: 3 }, { from: "l1", place: 0 }] },
  { id: "k3", stage: "lucky", label: "Lucky loser 3", slots: [{ from: "w2", place: 2 }, { from: "l2", place: 1 }] },
  { id: "k4", stage: "lucky", label: "Lucky loser 4", slots: [{ from: "w2", place: 3 }, { from: "l2", place: 0 }] },
  // Someone straight through meets the winner of a lucky loser match from the other lane.
  { id: "q1", stage: "quarter", label: "Kvartfinale 1", size: 4, slots: [{ from: "w1", place: 0 }, { from: "k3", place: 0 }] },
  { id: "q2", stage: "quarter", label: "Kvartfinale 2", size: 4, slots: [{ from: "w1", place: 1 }, { from: "k4", place: 0 }] },
  { id: "q3", stage: "quarter", label: "Kvartfinale 3", size: 4, slots: [{ from: "w2", place: 0 }, { from: "k1", place: 0 }] },
  { id: "q4", stage: "quarter", label: "Kvartfinale 4", size: 4, slots: [{ from: "w2", place: 1 }, { from: "k2", place: 0 }] },
  { id: "s1", stage: "semi", label: "Semifinale 1", size: 2, slots: [{ from: "q1", place: 0 }, { from: "q3", place: 0 }] },
  { id: "s2", stage: "semi", label: "Semifinale 2", size: 2, slots: [{ from: "q2", place: 0 }, { from: "q4", place: 0 }] },
  { id: "f", stage: "final", label: "Finale", size: 1, slots: [{ from: "s1", place: 0 }, { from: "s2", place: 0 }] },
];

/** The game the quarter-finals and on are played as: the same, with forced rings. */
export function forcedVariantOf(variant: GameVariant | undefined): GameVariant {
  return withForcedRings(variant ?? "standard", true);
}

/**
 * Makes the tournament from sixteen entrants, strongest first (that order is the seeding). Exactly sixteen: a cup fills what is
 * missing with bots before it gets here.
 */
export function createPilot(mode: TournamentMode, participants: Participant[], id: string, createdAt: string, variant?: GameVariant, cup?: CupConfig): Tournament {
  if (participants.length !== PILOT_SIZE) throw new Error(`Ly Pilotturnering er for ${PILOT_SIZE} spillere, ikke ${participants.length}.`);
  const names = participants.map((p) => p.name);
  const forced = forcedVariantOf(variant);
  const matches: TournamentMatch[] = SPECS.map((s) => {
    const heat = s.stage === "heat" ? HEAT_SEEDS[Number(s.id.slice(1)) - 1].map((seed) => names[seed - 1]) : undefined;
    const late = s.stage === "quarter" || s.stage === "semi" || s.stage === "final";
    return {
      id: s.id,
      round: "bracket",
      participantA: null,
      participantB: null,
      ...(heat ? { participants: heat } : {}),
      ...(s.size ? { bracketRoundSize: s.size } : {}),
      ...(late ? { variant: forced } : {}),
      pilot: { stage: s.stage, label: s.label, ...(s.slots ? { slots: s.slots } : {}) },
    };
  });
  return {
    id,
    mode,
    participants,
    groups: [],
    matches,
    status: "playoff",
    createdAt,
    matchSize: 4,
    variant,
    ...(cup ? { cup } : {}),
    format: "pilot",
    seeds: names,
  };
}

/** The names that fill a match, if everything that feeds it is decided: in seed order, so the strongest throws first. */
function filledBy(t: Tournament, m: TournamentMatch, byId: Map<string, TournamentMatch>): string[] | null {
  const slots = m.pilot?.slots;
  if (!slots) return null;
  const names: string[] = [];
  for (const s of slots) {
    const name = byId.get(s.from)?.placements?.[s.place];
    if (!name) return null;
    names.push(name);
  }
  const seeds = t.seeds ?? [];
  return names.sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b));
}

/** Puts the players in the matches whose feeds are all decided, and empties the ones whose feeds are not (after an undo). */
export function fillPilot(t: Tournament): Tournament {
  const byId = new Map(t.matches.map((m) => [m.id, m]));
  const matches = t.matches.map((m) => {
    if (m.winner || !m.pilot?.slots) return m;
    const names = filledBy(t, m, byId);
    const four = m.pilot.slots.length === 4;
    const next: TournamentMatch = { ...m };
    if (four) {
      if (names) next.participants = names;
      else delete next.participants;
    } else {
      next.participantA = names ? names[0] : null;
      next.participantB = names ? names[1] : null;
    }
    return next;
  });
  return { ...t, matches };
}

/** Records a result: the full finishing order, first place first. Fills the places it leads to, and ends the tournament with the final. */
export function recordPilotResult(t: Tournament, id: string, placements: string[], stats: Record<string, TurnAggregate>, opts: { simulated?: boolean } = {}): Tournament {
  const order = t.matches.reduce((n, m) => Math.max(n, m.decidedOrder ?? 0), 0) + 1;
  const when = new Date().toISOString();
  const matches = t.matches.map((m) => (m.id === id ? { ...m, winner: placements[0], placements, stats, decidedAt: when, decidedOrder: order, ...(opts.simulated ? { simulated: true as const } : {}) } : m));
  let next = fillPilot({ ...t, matches });
  const final = next.matches.find((m) => m.pilot?.stage === "final");
  if (final?.winner) next = { ...next, status: "done", winner: final.winner, completedAt: when };
  return next;
}

/** The match «Angre» takes back: the latest result that was thrown (a result the model decided after it goes with it). */
export function undoablePilotMatch(t: Tournament): TournamentMatch | null {
  const thrown = t.matches.filter((m) => m.winner && !m.simulated);
  if (thrown.length === 0) return null;
  return thrown.reduce((a, b) => ((b.decidedOrder ?? 0) > (a.decidedOrder ?? 0) ? b : a));
}

export function undoPilotResult(t: Tournament): Tournament | null {
  const target = undoablePilotMatch(t);
  if (!target) return null;
  const from = target.decidedOrder ?? 0;
  const matches = t.matches.map((m) => {
    if (!m.winner || (m.decidedOrder ?? 0) < from) return m;
    const reopened: TournamentMatch = { ...m };
    delete reopened.winner;
    delete reopened.placements;
    delete reopened.stats;
    delete reopened.decidedAt;
    delete reopened.decidedOrder;
    delete reopened.simulated;
    return reopened;
  });
  const next = fillPilot({ ...t, matches, status: "playoff" });
  delete next.winner;
  delete next.completedAt;
  return next;
}

/** The people in a match, in the order they throw (the strongest seed first). */
export function pilotPlayers(m: TournamentMatch): string[] {
  return m.participants ?? [m.participantA, m.participantB].filter((p): p is string => !!p);
}

/** Whether every place in the match is filled, which is when it can be played. */
export function isReady(m: TournamentMatch): boolean {
  const expected = m.pilot?.slots ? m.pilot.slots.length : 4;
  return !m.winner && pilotPlayers(m).length === expected;
}

/** The matches that can be played now, in the order they come. */
export function readyMatches(t: Tournament): TournamentMatch[] {
  const rank = (m: TournamentMatch) => ORDER.indexOf(m.id);
  return t.matches.filter(isReady).sort((a, b) => rank(a) - rank(b));
}

/** Whether the model may decide this match: a cup, and only bots in it. */
export function isPilotSimulable(t: Tournament, m: TournamentMatch): boolean {
  if (!t.cup || !isReady(m)) return false;
  return pilotPlayers(m).every((n) => t.participants.find((p) => p.name === n)?.isBot);
}

/** The match to throw next: the first one with someone of the house in it, and only when there is none the first of any. */
export function nextPilotMatch(t: Tournament): TournamentMatch | null {
  const ready = readyMatches(t);
  return ready.find((m) => !isPilotSimulable(t, m)) ?? ready[0] ?? null;
}

/** The matches after the next one that someone of the house plays in, in order. */
export function pilotQueue(t: Tournament, next: TournamentMatch | null): TournamentMatch[] {
  return readyMatches(t).filter((m) => m.id !== next?.id && !isPilotSimulable(t, m));
}

/** A small deterministic source in [0, 1): the same cup gives the same result after a reload. */
function unit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** The finishing order of a match of bots: drawn one place at a time, the stronger likelier to come first (a lower skill is stronger). */
export function simulatePilotMatch(t: Tournament, m: TournamentMatch): { placements: string[]; stats: Record<string, TurnAggregate> } {
  const seed = t.cup?.seed ?? 0;
  const players = pilotPlayers(m);
  const weight = (name: string) => Math.exp(-0.6 * (t.participants.find((p) => p.name === name)?.skill ?? 4));
  const left = [...players];
  const placements: string[] = [];
  for (let place = 0; left.length > 0; place++) {
    const total = left.reduce((s, n) => s + weight(n), 0);
    let pick = unit(`${seed}|pilot|${m.id}|${place}`) * total;
    let chosen = left[left.length - 1];
    for (const n of left) {
      pick -= weight(n);
      if (pick <= 0) {
        chosen = n;
        break;
      }
    }
    placements.push(chosen);
    left.splice(left.indexOf(chosen), 1);
  }
  const marks = totalMarks();
  const turns = 11 + Math.floor(unit(`${seed}|pilot|${m.id}|turns`) * 6);
  const stats: Record<string, TurnAggregate> = {};
  placements.forEach((name, i) => {
    const hits = i === 0 ? marks : Math.round(marks * (0.9 - 0.12 * i - 0.05 * unit(`${seed}|pilot|${m.id}|${name}|hits`)));
    const darts = i === 0 ? turns * 3 - Math.floor(unit(`${seed}|pilot|${m.id}|${name}|last`) * 3) : turns * 3;
    stats[name] = { hits, misses: Math.max(0, darts - Math.round(hits / 1.15)), darts, hitsByStep: {}, missesByStep: {} };
  });
  return { placements, stats };
}

/** How far into the course a match is: heats first, then the lanes, lucky loser, and so on to the final. */
function stageRank(m: TournamentMatch): number {
  return PILOT_STAGES.findIndex((s) => s.stage === m.pilot?.stage);
}

/**
 * Decides the matches that only bots play, but never before the house is through with its own: a match is decided only when it is in an
 * earlier stage than the first match the house has to throw. So the heats of bots wait until the heats of people are played, and a lane
 * of bots waits until the people's lane is. When the house has nothing to throw (it waits for the bots to be done), everything that can be
 * played is decided. The results are then on the course, as for any match. Returns the tournament and the matches decided, in order.
 */
export function playPilotBots(t: Tournament): { tournament: Tournament; decided: string[] } {
  let cur = t;
  const decided: string[] = [];
  for (let guard = 0; guard <= t.matches.length; guard++) {
    const ready = readyMatches(cur);
    const human = ready.find((x) => !isPilotSimulable(cur, x));
    const limit = human ? stageRank(human) : Number.POSITIVE_INFINITY;
    const m = ready.find((x) => isPilotSimulable(cur, x) && stageRank(x) < limit);
    if (!m) break;
    const r = simulatePilotMatch(cur, m);
    cur = recordPilotResult(cur, m.id, r.placements, r.stats, { simulated: true });
    decided.push(m.id);
  }
  return { tournament: cur, decided };
}

/** What fills a place that is still empty, in words: «1. i Heat A». */
export function pilotSlotLabel(t: Tournament, m: TournamentMatch, index: number): string {
  const slot = m.pilot?.slots?.[index];
  if (!slot) return "";
  const source = t.matches.find((x) => x.id === slot.from);
  return `${slot.place + 1}. i ${source?.pilot?.label ?? slot.from}`;
}

export const PILOT_STAGES: { stage: PilotInfo["stage"]; title: string }[] = [
  { stage: "heat", title: "Heat" },
  { stage: "winners", title: "Vinnerbaner" },
  { stage: "losers", title: "Taperbaner" },
  { stage: "lucky", title: "Lucky loser" },
  { stage: "quarter", title: "Kvartfinale" },
  { stage: "semi", title: "Semifinale" },
  { stage: "final", title: "Finale" },
];

/** The matches by stage, in the order they are played. */
export function pilotStages(t: Tournament): { stage: PilotInfo["stage"]; title: string; matches: TournamentMatch[] }[] {
  return PILOT_STAGES.map((s) => ({ ...s, matches: t.matches.filter((m) => m.pilot?.stage === s.stage).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)) }));
}

/** The stage the tournament is in now: the one with the next match in it. */
export function currentStage(t: Tournament): PilotInfo["stage"] | null {
  return nextPilotMatch(t)?.pilot?.stage ?? null;
}
