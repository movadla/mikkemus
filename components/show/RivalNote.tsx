"use client";

import { useAccess } from "@/lib/access";
import type { Career } from "@/lib/career";
import { lifeOf } from "@/lib/careerLife";
import { rivalQuip, rivalRecordLine } from "@/lib/show";

/** A line under a challenge from the rival: where the two of them stand, from the record against them. Only with the show, and only once they have met. */
export function RivalNote({ career, name }: { career: Career; name: string }) {
  const { show } = useAccess();
  const line = show ? rivalRecordLine(name, career.rivals?.[name]) : null;
  return line ? <p className="rival-note">{line}</p> : null;
}

/** What the rival says after a meeting with them: short, and the same every time for the same week. `playerWon` is who took it. Only with the show. */
export function RivalQuip({ career, name, playerWon }: { career: Career; name: string; playerWon: boolean }) {
  const { show } = useAccess();
  if (!show) return null;
  return <p className="rival-quip">{rivalQuip(career.id, lifeOf(career).week, name, playerWon)}</p>;
}
