import { BOT_LEVELS, type BotLevel } from "./botLevels";
import type { PlayerRecord } from "./playerRows";
import { buildSeedTable, skillTable, winChanceAgainst } from "./seedingTable";
import type { RuleSet } from "./odds/model";
import type { Participant } from "./tournament";

/**
 * How strong each entrant is, for seeding a knockout: the chance of beating a typical player of the group over one match. People
 * come from the seeding table (the matches, and nothing the group has said about them); a team is as strong as the average of its
 * members; a bot is placed on the same scale from the mean distance its level is calibrated to throw at. Someone nobody has any
 * matches for counts as a typical player, as the seeding table treats them.
 */

const LEVELS: BotLevel[] = ["1", "2", "3", "4", "5", "6"];

/** The mean distance in mm for a bot's skill, which in a cup is a number between the levels. */
export function medForSkill(skill: number): number {
  const s = Math.min(6, Math.max(1, skill));
  const lo = Math.floor(s);
  const hi = Math.min(6, lo + 1);
  const a = BOT_LEVELS[LEVELS[lo - 1]].targetMed;
  const b = BOT_LEVELS[LEVELS[hi - 1]].targetMed;
  return a + (b - a) * (s - lo);
}

export function strengthMap(records: PlayerRecord[], participants: Participant[], rules: RuleSet): Map<string, number> {
  const table = buildSeedTable(records, rules);
  const { prior } = skillTable(records, rules);
  const byName = new Map(table.map((r) => [r.name.trim().toLowerCase(), r.strength]));
  const bot = (skill: number) => winChanceAgainst(medForSkill(skill), prior.med, rules);
  const out = new Map<string, number>();
  for (const p of participants) {
    if (p.members && p.members.length > 0) {
      const parts = p.members.map((m) => (m.isBot ? bot(m.skill ?? Number(m.botLevel ?? "4")) : byName.get(m.name.trim().toLowerCase()) ?? 0.5));
      out.set(p.name, parts.reduce((s, v) => s + v, 0) / parts.length);
    } else if (p.isBot) {
      out.set(p.name, bot(p.skill ?? Number(p.botLevel ?? "4")));
    } else {
      out.set(p.name, byName.get(p.name.trim().toLowerCase()) ?? 0.5);
    }
  }
  return out;
}
