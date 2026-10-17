import { emptyProgress } from "./game";
import { finishCdf, stateOf } from "./odds/forward";
import { evidenceFor } from "./odds/match";
import { modelFor, type RuleSet } from "./odds/model";
import { SEED_ORDER, seededPrior } from "./odds/seeding";
import { learnPrior, skillNodes, SCENARIOS, type Evidence } from "./odds/skill";
import { MED_TO_SIGMA } from "./odds/throwModel";
import { raceWinProbs } from "./odds/winProb";
import type { MatchHistoryEntry, PlayerRecord } from "./playerRows";
import { initialRating } from "./rating";

/** How a player has been doing over their last five matches, next to how they usually do. */
export type FormInfo = {
  /** Matches counted (up to five). */
  n: number;
  wins: number;
  losses: number;
  /** Oldest first: true for a win. */
  results: boolean[];
  /** Crosses per dart, in percent: over these matches and over every match on record. */
  hit5: number | null;
  hitAll: number | null;
  /** The difference, in points. */
  dHit: number | null;
  /** Mean distance from the target in mm, when Scolia measured it. */
  med5: number | null;
  medAll: number | null;
  /** 0 to 1: wins and how the hit rate compares with the usual. Null with too few matches. */
  score: number | null;
  label: "På gang" | "Jevn" | "Svak" | "For få kamper";
};

export type SeedRow = {
  name: string;
  /** Chance of beating a typical player of the group over one match, from skill alone (0 to 1). */
  strength: number;
  /** The mean distance the model believes the player throws at, in mm: the seeding and the darts together. */
  med: number;
  /** Where the group put them to begin with (1 for the best), for the people on the list. */
  seedRank: number | null;
  /** Place now, and how many places the seeded players have climbed (positive) or dropped since the seeding. */
  rank: number;
  move: number | null;
  /** Elo rating (lib/rating.ts) and the matches behind it. */
  rating: number;
  ratedMatches: number;
  form: FormInfo;
  matches: number;
  wins: number;
};

const entriesOf = (r: PlayerRecord): MatchHistoryEntry[] => r.matchHistory.filter((m) => m.dartsUsed > 0);

/** Hit rate over matches, each weighed by its darts. */
function weightedHit(entries: MatchHistoryEntry[]): number | null {
  const darts = entries.reduce((s, m) => s + m.dartsUsed, 0);
  return darts === 0 ? null : entries.reduce((s, m) => s + m.hitPct * m.dartsUsed, 0) / darts;
}

function weightedMed(entries: MatchHistoryEntry[]): number | null {
  const m = entries.filter((e) => e.med !== null);
  const w = m.reduce((s, e) => s + (e.throws ?? e.dartsUsed), 0);
  return w === 0 ? null : m.reduce((s, e) => s + (e.med as number) * (e.throws ?? e.dartsUsed), 0) / w;
}

export function formOf(record: PlayerRecord, last = 5): FormInfo {
  const all = entriesOf(record);
  const recent = all.slice(-last);
  const wins = recent.filter((m) => m.won).length;
  const hit5 = weightedHit(recent);
  const hitAll = weightedHit(all);
  const dHit = hit5 !== null && hitAll !== null ? hit5 - hitAll : null;
  const med5 = weightedMed(recent);
  const medAll = weightedMed(all);
  let score: number | null = null;
  if (recent.length >= 3) {
    // Wins count most; how the darts are going against the player's own usual counts for the rest.
    const trend = dHit === null ? 0.5 : Math.max(0, Math.min(1, 0.5 + dHit / 40));
    score = 0.6 * (wins / recent.length) + 0.4 * trend;
  }
  const label: FormInfo["label"] = score === null ? "For få kamper" : score >= 0.62 ? "På gang" : score <= 0.38 ? "Svak" : "Jevn";
  return { n: recent.length, wins, losses: recent.length - wins, results: recent.map((m) => m.won), hit5, hitAll, dHit, med5, medAll, score, label };
}

/** The chance of beating a player who throws at `refMed`, over a match between two sides who each throw at the given distances. */
export function winChanceAgainst(medMM: number, refMed: number, rules: RuleSet): number {
  const cdf = (med: number) => {
    const model = modelFor(rules, med * MED_TO_SIGMA);
    return finishCdf({ start: stateOf(model, emptyProgress()), models: [model] });
  };
  const a = cdf(medMM);
  const b = cdf(refMed);
  // Who throws first matters a little: average the two ways round.
  return (raceWinProbs([a, b])[0] + raceWinProbs([b, a])[1]) / 2;
}

/** What the model believes about each person's throwing, from the seeding and the darts together. */
export type SkillRow = {
  record: PlayerRecord;
  /** The seven equally likely spreads (σ) the person might throw at: what is still unsure about them. */
  sigmas: number[];
  /** The middle one, as a mean distance from the target in mm. */
  med: number;
  seedRank: number | null;
};

export function skillTable(records: PlayerRecord[], rules: RuleSet): { prior: ReturnType<typeof learnPrior>; rows: SkillRow[] } {
  const people = records.filter((r) => r.kind !== "team");
  // The group's own starting point, from those with enough measured darts (the same as the odds use).
  const prior = learnPrior(people.map((r) => evidenceFor(r.name, records)).filter((e): e is Evidence => !!e));
  const rows = people.map((r) => {
    const nodes = skillNodes(evidenceFor(r.name, records, rules), SCENARIOS, seededPrior(r.name, prior) ?? prior);
    const sigmas = nodes.map((n) => n.sigma);
    const seedIndex = SEED_ORDER.indexOf(r.name.trim().toLowerCase() as (typeof SEED_ORDER)[number]);
    return { record: r, sigmas, med: sigmas[Math.floor(sigmas.length / 2)] / MED_TO_SIGMA, seedRank: seedIndex >= 0 ? seedIndex + 1 : null };
  });
  return { prior, rows };
}

/**
 * The table of who is best. What the group said about the regulars (lib/odds/seeding.ts) is the starting point
 * of each person's skill, and what they have thrown since (measured distances, and how often the darts counted
 * for the matches Scolia did not measure) moves it, more and more the more there is. The strength is then how
 * likely they would be to beat a typical player of the group.
 */
export function buildSeedTable(records: PlayerRecord[], rules: RuleSet): SeedRow[] {
  const { prior, rows } = skillTable(records, rules);
  const withStrength = rows.map((x) => ({ r: x.record, med: x.med, seedRank: x.seedRank, strength: winChanceAgainst(x.med, prior.med, rules) }));
  withStrength.sort((a, b) => b.strength - a.strength || a.r.name.localeCompare(b.r.name, "no"));
  // Among the people on the seeding list: where each stands now, against where the group put them.
  const seededNow = withStrength.filter((x) => x.seedRank !== null);
  return withStrength.map((x, i) => {
    const nowAmongSeeded = seededNow.indexOf(x) + 1;
    return {
      name: x.r.name,
      strength: x.strength,
      med: x.med,
      seedRank: x.seedRank,
      rank: i + 1,
      move: x.seedRank !== null ? x.seedRank - nowAmongSeeded : null,
      rating: x.r.rating ?? initialRating(x.r.name),
      ratedMatches: x.r.ratedMatches ?? 0,
      form: formOf(x.r),
      matches: x.r.matchesPlayed,
      wins: x.r.matchesWon,
    };
  });
}

/** What a tournament needs of each side: its name, who is in it, and the spreads each of them might throw at. */
export type EntrantInput = { name: string; members: string[]; sigmas: number[][]; photo?: string };

/**
 * The people, or the teams, as sides for a tournament. A team is its members, each with their own skill from
 * their own records (so a team is as good as the two of them throwing in turn); a member nobody has any record of
 * counts as an unknown player of the group.
 */
export function entrantInputs(records: PlayerRecord[], rules: RuleSet, kind: "player" | "team"): EntrantInput[] {
  const { prior, rows } = skillTable(records, rules);
  const unknown = skillNodes(null, SCENARIOS, prior).map((n) => n.sigma);
  const byName = new Map(rows.map((r) => [r.record.name.trim().toLowerCase(), r.sigmas]));
  if (kind === "player") return rows.map((r) => ({ name: r.record.name, members: [r.record.name], sigmas: [r.sigmas], photo: r.record.photo }));
  return records
    .filter((r) => r.kind === "team" && (r.members?.length ?? 0) > 0)
    .map((t) => ({ name: t.name, members: t.members ?? [], sigmas: (t.members ?? []).map((m) => byName.get(m.trim().toLowerCase()) ?? unknown), photo: t.photo }));
}
