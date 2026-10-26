import { emptyProgress } from "./game";
import { finishCdf, stateOf } from "./odds/forward";
import { evidenceFor } from "./odds/match";
import { modelFor, type RuleSet } from "./odds/model";
import { SEED_ORDER } from "./odds/seeding";
import { learnPrior, skillNodes, SCENARIOS, type Evidence } from "./odds/skill";
import { MED_TO_SIGMA } from "./odds/throwModel";
import { raceWinProbs } from "./odds/winProb";
import { shownHitPct, type MatchHistoryEntry, type PlayerRecord } from "./playerRows";
import { expectedScore, PROVISIONAL_MATCHES, START_RATING } from "./rating";

/** How a player has been doing over their last ten matches, next to how they usually do. */
export type FormInfo = {
  /** Matches counted (up to ten). */
  n: number;
  wins: number;
  losses: number;
  /** Oldest first: true for a win. */
  results: boolean[];
  /** Hit share in percent: over these matches and over the matches before them (null with fewer than three). */
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
  /** Chance of beating a typical player of the group over one match (0 to 1): the darts and the results together. */
  strength: number;
  /** The mean distance the model believes the player throws at, in mm, from their darts alone. */
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
  return darts === 0 ? null : entries.reduce((s, m) => s + shownHitPct(m) * m.dartsUsed, 0) / darts;
}

function weightedMed(entries: MatchHistoryEntry[]): number | null {
  const m = entries.filter((e) => e.med !== null);
  const w = m.reduce((s, e) => s + (e.throws ?? e.dartsUsed), 0);
  return w === 0 ? null : m.reduce((s, e) => s + (e.med as number) * (e.throws ?? e.dartsUsed), 0) / w;
}

/** Matches before the recent ones that it takes to say how someone usually does. */
const MIN_BEFORE = 3;

export function formOf(record: PlayerRecord, last = 10): FormInfo {
  const all = entriesOf(record);
  const recent = all.slice(-last);
  const wins = recent.filter((m) => m.won).length;
  // The usual is the matches before the recent ones: compared with a figure that contains them, a player with ten
  // matches or fewer would always be exactly as usual. Needs a few matches behind it to say anything.
  const before = all.slice(0, all.length - recent.length);
  const baseline = before.length >= MIN_BEFORE ? before : [];
  const hit5 = weightedHit(recent);
  const hitAll = weightedHit(baseline);
  const dHit = hit5 !== null && hitAll !== null ? hit5 - hitAll : null;
  const med5 = weightedMed(recent);
  const medAll = weightedMed(baseline);
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
    // Nobody starts from what the group has said about them: with no darts a player is a typical one of the group.
    const nodes = skillNodes(evidenceFor(r.name, records, rules), SCENARIOS, prior);
    const sigmas = nodes.map((n) => n.sigma);
    const seedIndex = SEED_ORDER.indexOf(r.name.trim().toLowerCase() as (typeof SEED_ORDER)[number]);
    return { record: r, sigmas, med: sigmas[Math.floor(sigmas.length / 2)] / MED_TO_SIGMA, seedRank: seedIndex >= 0 ? seedIndex + 1 : null };
  });
  return { prior, rows };
}

/** Matches, alone and in teams together, after which the number of matches no longer holds a strength back. */
export const MATCHES_TO_TRUST = 10;

/** Every match a person has played: their own, and those of the teams they are in. */
export function totalMatches(person: PlayerRecord, records: PlayerRecord[]): number {
  const name = person.name.trim().toLowerCase();
  const inTeams = records.filter((t) => t.kind === "team" && (t.members ?? []).some((m) => m.trim().toLowerCase() === name));
  return person.matchesPlayed + inTeams.reduce((s, t) => s + t.matchesPlayed, 0);
}

/**
 * The table of who is best, from the matches alone. The darts (measured distances, and how often the darts counted
 * for the matches Scolia did not measure) say how likely someone would be to beat a typical player of the group;
 * the results say it too, through the rating, and count for more the more matches are rated. Both are pulled
 * towards a typical player until there are ten matches behind them (MATCHES_TO_TRUST). The group's own
 * seeding (lib/odds/seeding.ts) is not in it, only shown next to it. Anyone with no matches is placed last.
 */
export function buildSeedTable(records: PlayerRecord[], rules: RuleSet): SeedRow[] {
  const { prior, rows } = skillTable(records, rules);
  const rated = rows.filter((x) => (x.record.ratedMatches ?? 0) > 0);
  const meanRating = rated.length > 0 ? rated.reduce((s, x) => s + (x.record.rating ?? START_RATING), 0) / rated.length : START_RATING;
  const withStrength = rows.map((x) => {
    const fromDarts = winChanceAgainst(x.med, prior.med, rules);
    const n = x.record.ratedMatches ?? 0;
    const fromResults = expectedScore(x.record.rating ?? START_RATING, meanRating);
    const w = n / (n + PROVISIONAL_MATCHES);
    const raw = (1 - w) * fromDarts + w * fromResults;
    // Few matches say little: one very good round must not put someone on top. The pull towards a typical player
    // fades over the first MATCHES_TO_TRUST matches, alone and in teams together, and is gone after that. It fades
    // slowly at first (the square), so four matches still count for little.
    const trust = Math.min(1, totalMatches(x.record, records) / MATCHES_TO_TRUST) ** 2;
    return { r: x.record, med: x.med, seedRank: x.seedRank, strength: 0.5 + trust * (raw - 0.5) };
  });
  // Those who have not played a match yet go last, whatever the group said about them, until they have.
  const hasPlayed = (x: (typeof withStrength)[number]) => (totalMatches(x.r, records) > 0 ? 1 : 0);
  withStrength.sort((a, b) => hasPlayed(b) - hasPlayed(a) || b.strength - a.strength || a.r.name.localeCompare(b.r.name, "no"));
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
      rating: x.r.rating ?? START_RATING,
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
