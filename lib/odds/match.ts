import type { BotLevel } from "../botLevels";
import { sigmaForLevel } from "../botStrategy";
import type { PlayerProgress } from "../game";
import type { PlayerRecord } from "../playerRows";
import type { OddsInput, OddsMember, OddsSide } from "./index";
import { HIT_WEIGHT, medFromCrossRate } from "./hitRate";
import type { RuleSet } from "./model";
import { addEvidence, knownSkill, learnPrior, skillNodes, weighEvidence, SCENARIOS, type Evidence, type Prior } from "./skill";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What the records say about how well someone throws: the mean distance of their darts from the
 * target, from their own matches and from the matches they threw in for a team (where the team's
 * record holds each member's figures), newest weighing most. Matches from before the measurements
 * were kept per match are covered by the career totals, as one older block.
 *
 * With `rules`, matches played without Scolia count too, from how often the darts counted
 * (lib/odds/hitRate.ts): a coarse reading, so a dart read that way weighs HIT_WEIGHT of a measured one.
 * For a team member that is their own cross rate in team matches (kept per member on the team's record),
 * for the darts that were not measured.
 */
export function evidenceFor(name: string, roster: PlayerRecord[], rules?: RuleSet): Evidence | null {
  const own = roster.find((r) => r.kind !== "team" && same(r.name, name));
  type Entry = { date: string; n: number; meanR: number };
  const list: Entry[] = [];
  let counted = 0;
  let countedSum = 0;
  own?.matchHistory.forEach((h) => {
    if (h.med === null) {
      if (rules && h.dartsUsed > 0) list.push({ date: h.date, n: h.dartsUsed * HIT_WEIGHT, meanR: medFromCrossRate(Math.max(0, h.hitPct) / 100, rules) });
      return;
    }
    const n = h.throws ?? h.dartsUsed;
    list.push({ date: h.date, n, meanR: h.med });
    counted += n;
    countedSum += n * h.med;
  });
  roster
    .filter((r) => r.kind === "team")
    .forEach((team) =>
      team.matchHistory.forEach((h) => {
        const mine = h.byMember && Object.entries(h.byMember).find(([k]) => same(k, name));
        if (mine && mine[1].throws > 0) list.push({ date: h.date, n: mine[1].throws, meanR: mine[1].sumR / mine[1].throws });
      }),
    );
  if (rules) {
    roster
      .filter((r) => r.kind === "team")
      .forEach((team) => {
        const found = team.memberStats && Object.entries(team.memberStats).find(([k]) => same(k, name));
        const s = found?.[1];
        const unmeasured = s ? s.darts - s.throws : 0;
        if (s && s.darts > 0 && unmeasured >= 1) list.push({ date: "", n: unmeasured * HIT_WEIGHT, meanR: medFromCrossRate(s.hits / s.darts, rules) });
      });
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  // Darts in the career totals that no history entry accounts for: an older block, oldest of all.
  if (own && own.accuracy.throws - counted >= 20) {
    const n = own.accuracy.throws - counted;
    const meanR = (own.accuracy.sumDistance - countedSum) / n;
    if (meanR > 0) list.unshift({ date: "", n, meanR });
  }
  return weighEvidence(list);
}

export type OddsMatch = {
  rules: RuleSet;
  /** The sides in the order they play (the match's `players`) and who is up. */
  players: string[];
  currentIdx: number;
  progress: PlayerProgress;
  teamRosters: Record<string, { name: string; isBot: boolean; botLevel?: BotLevel }[]>;
  teamMemberIdx: Record<string, number>;
  botLevels: Record<string, BotLevel>;
  roster: PlayerRecord[];
  /** The darts of this match so far, per side with a figure per thrower — more evidence, most recent of all. */
  live: Record<string, { byMember?: Record<string, { throws: number; sumR: number }>; throws: number; distance: number }>;
};

/** The skill of one thrower: a bot is known exactly; a person is whatever their record and today's darts say. */
function skillOf(name: string, bot: BotLevel | null | undefined, m: OddsMatch, side: string, prior: Prior) {
  if (bot) return knownSkill(sigmaForLevel(bot) , SCENARIOS);
  const liveSide = m.live[side];
  const lm = liveSide?.byMember?.[name] ?? (liveSide?.byMember === undefined && liveSide && !m.teamRosters[side] ? { throws: liveSide.throws, sumR: liveSide.distance } : undefined);
  const today: Evidence | null = lm && lm.throws > 0 ? { n: lm.throws, meanR: lm.sumR / lm.throws } : null;
  return skillNodes(addEvidence(evidenceFor(name, m.roster, m.rules), today), SCENARIOS, prior);
}

/** The odds engine's input from a match in progress, sides in throwing order starting with whoever is up. */
export function buildOddsInput(m: OddsMatch): OddsInput {
  const prior = learnPrior(m.roster.filter((r) => r.kind !== "team").map((r) => evidenceFor(r.name, m.roster)).filter((e): e is Evidence => !!e));
  const n = m.players.length;
  const sides: OddsSide[] = [];
  for (let i = 0; i < n; i++) {
    const name = m.players[(m.currentIdx + i) % n];
    const team = m.teamRosters[name];
    const members: OddsMember[] =
      team && team.length > 0
        ? team.map((t) => ({ name: t.name, skill: skillOf(t.name, t.isBot ? t.botLevel ?? "3" : null, m, name, prior) }))
        : [{ name, skill: skillOf(name, m.botLevels[name], m, name, prior) }];
    sides.push({ name, progress: m.progress[name], members, nextMember: team && team.length > 0 ? (m.teamMemberIdx[name] ?? 0) % team.length : 0 });
  }
  return { rules: m.rules, sides };
}
