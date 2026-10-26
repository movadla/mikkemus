"use client";

import { useMemo } from "react";
import { whenLabel } from "@/lib/formatDate";
import { buildMatchLog } from "@/lib/matchLog";
import { useRoster } from "@/lib/storage";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";

/**
 * The match that was played last, for the front page of the limited code, which has no statistics to show there: who played it and when,
 * and a button to play it again with the same people when they are all on record (a bot has a level to choose and a guest is not kept, so
 * a match with either is only shown). Names only, no result: the limited code sees no numbers.
 */
export function LastPlayedCard({ onReplay }: { onReplay: (players: string[]) => void }) {
  const roster = useRoster();
  const last = useMemo(() => buildMatchLog(roster)[0] ?? null, [roster]);
  if (!last || last.sides.length < 2) return null;
  const names = last.sides.map((s) => s.name);
  // Everyone alone and on record: then the same match can be started straight away.
  const replayable = last.sides.every((s) => s.kind === "player" && roster.some((r) => r.name === s.name && r.kind !== "team"));
  return (
    <section className="card mb-6" style={{ background: "var(--color-surface)" }} aria-label="Sist spilt">
      <p className="section-label mb-3">SIST SPILT · {whenLabel(last.date).toUpperCase()}</p>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex -space-x-2 shrink-0" aria-hidden>
          {last.sides.slice(0, 4).map((s) => (
            <Avatar key={s.name} name={s.name} photo={roster.find((r) => r.name === s.name)?.photo} size="m" />
          ))}
        </div>
        <p className="font-display min-w-0" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)", lineHeight: 1.15 }}>
          {names.join(" mot ")}
        </p>
      </div>
      {replayable && (
        <Button block onClick={() => onReplay(names)}>
          Spill igjen
        </Button>
      )}
    </section>
  );
}
