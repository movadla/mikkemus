import { cupColor } from "@/lib/botCup";
import { stageStrip } from "@/lib/stages";
import type { Tournament } from "@/lib/tournament";
import { CheckIcon } from "./icons";

/**
 * Where the tournament has got to, as a strip in glass: a ticked dot for each step that is played, a pill with its name for the one
 * being played, and a numbered dot for each that is to come. Only the step you are in carries a name (the others are named for a screen
 * reader), so the strip reads at a glance. On the big screen every step keeps its name. In the colour of the cup.
 */
export function StageStrip({ tournament, large = false }: { tournament: Tournament; large?: boolean }) {
  const stages = stageStrip(tournament);
  if (stages.length < 2) return null;
  return (
    <ol aria-label="Fremdrift" className={`stage-strip ${large ? "stage-strip-large" : ""}`} style={{ "--stage": cupColor(tournament.cup?.kind) } as React.CSSProperties}>
      {stages.map((s, i) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === "now" ? "step" : undefined}>
          <b className="stage-mark">
            <i aria-hidden>{s.state === "done" ? <CheckIcon className="w-3 h-3" /> : i + 1}</i>
            <span className={s.state === "now" || large ? undefined : "sr-only"}>{s.label}</span>
          </b>
        </li>
      ))}
    </ol>
  );
}
