import { bracketRounds, isKnockout } from "./knockout";
import { isPilot, pilotStages } from "./pilot";
import type { Tournament, TournamentMatch } from "./tournament";

/** One step of a tournament as the strip at the top shows it: done, the one being played, or still to come. */
export type Stage = { label: string; state: "done" | "now" | "next" };

/** The pilot's lanes (winners, losers) are one step in the strip, as the two lanes are played side by side. */
const PILOT_STEPS: { label: string; stages: string[] }[] = [
  { label: "Heat", stages: ["heat"] },
  { label: "Baner", stages: ["winners", "losers"] },
  { label: "Lucky", stages: ["lucky"] },
  { label: "Kvart", stages: ["quarter"] },
  { label: "Semi", stages: ["semi"] },
  { label: "Finale", stages: ["final"] },
];

const decided = (ms: TournamentMatch[]) => ms.length > 0 && ms.every((m) => !!m.winner);

/** The steps of the tournament in order, with where it has got to: the first step that is not finished is the one being played. */
export function stageStrip(t: Tournament): Stage[] {
  const steps: { label: string; matches: TournamentMatch[] }[] = isPilot(t)
    ? PILOT_STEPS.map((s) => ({ label: s.label, matches: pilotStages(t).filter((p) => s.stages.includes(p.stage)).flatMap((p) => p.matches) })).filter((s) => s.matches.length > 0)
    : isKnockout(t)
      ? bracketRounds(t).map((r) => ({ label: r.short, matches: r.matches }))
      : [];
  const now = steps.findIndex((s) => !decided(s.matches));
  return steps.map((s, i) => ({ label: s.label, state: now === -1 || i < now ? "done" : i === now ? "now" : "next" }));
}
