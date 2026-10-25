"use client";

import { useRoster } from "@/lib/storage";
import { PlayerStatsAccordion } from "./PlayerStatsAccordion";

/** Every player as a line to open (Singel and Lag, by hand or Scolia), then every team with a record of its own.
 *  A team opens to the same numbers as a person alone, and links on to its own page, where the name, the picture and the rest are changed. */
export function PlayerStatCards() {
  const roster = useRoster();
  const players = roster.filter((p) => p.kind !== "team");
  const teams = roster.filter((p) => p.kind === "team");

  return (
    <>
      {roster.length === 0 && (
        <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
          Ingen spillere ennå
        </p>
      )}

      {teams.length > 0 && players.length > 0 && <p className="section-label mb-2">SPILLERE</p>}
      <PlayerStatsAccordion players={players} all={roster} />

      {teams.length > 0 && (
        <>
          <p className="section-label mb-2 mt-8">LAG</p>
          <PlayerStatsAccordion players={teams} all={roster} />
        </>
      )}
    </>
  );
}
