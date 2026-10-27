import { cupColor, type CupConfig } from "@/lib/botCup";
import { CupEmblem } from "./ui/CupEmblem";

/** The cup a tournament is played for, as a small line under the title: its emblem in its own colour, and the trophy. */
export function CupLine({ cup }: { cup: Pick<CupConfig, "kind" | "trophy"> }) {
  const colour = cupColor(cup.kind);
  return (
    <p className="flex items-center gap-1.5 min-w-0" style={{ color: colour, fontSize: "var(--text-small)", fontWeight: 600 }}>
      <CupEmblem kind={cup.kind} className="w-4 h-4 shrink-0" />
      <span className="truncate">{cup.trophy}</span>
    </p>
  );
}
