/**
 * The ranking of a field in the career, by strength: the one list the opening, the draw and the seeding of a tournament all read, so the number by a
 * name is the same on every screen. A lone bot is as the world list has it (its fixed strength); a team is the mean of its people; the player's own
 * side is the strength the player has in the career (a team's own side with the partner in it, as the career gives it).
 */
import { medOfLevel } from "./opponentStats";
import { opponentOf } from "./opponents";
import type { Participant } from "./tournament";

/** Mean distance of the darts from the target, in mm: lower is stronger. */
export function fieldMed(p: Participant, own: { name: string; med: number }): number {
  if (p.members) {
    // Their own team: the human is in it.
    if (p.members.some((m) => !m.isBot)) return own.med;
    return p.members.reduce((s, m) => s + medOfLevel(m.skill ?? Number(m.botLevel ?? 4)), 0) / p.members.length;
  }
  return p.name === own.name || !p.isBot ? own.med : opponentOf(p.name).med;
}

/** The field strongest first, with a stable order for the equal. */
export function rankField(field: Participant[], own: { name: string; med: number }): Participant[] {
  return field
    .map((p, i) => ({ p, i, med: fieldMed(p, own) }))
    .sort((a, b) => a.med - b.med || a.i - b.i)
    .map((x) => x.p);
}
