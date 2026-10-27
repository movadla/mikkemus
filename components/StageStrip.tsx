import { cupColor } from "@/lib/botCup";
import { stageStrip } from "@/lib/stages";
import type { Tournament } from "@/lib/tournament";

/**
 * Where the tournament has got to, as a strip of dots in glass: a dot for each step (Heat, Kvart, Semi, Finale), filled for what is
 * played, ringed for the one being played, empty for what is to come. Nothing but the dots and their names. In the colour of the cup.
 */
export function StageStrip({ tournament, large = false }: { tournament: Tournament; large?: boolean }) {
  const stages = stageStrip(tournament);
  if (stages.length < 2) return null;
  return (
    <ol aria-label="Fremdrift" className={`stage-strip ${large ? "stage-strip-large" : ""}`} style={{ "--stage": cupColor(tournament.cup?.kind) } as React.CSSProperties}>
      {stages.map((s) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === "now" ? "step" : undefined}>
          <i aria-hidden />
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
