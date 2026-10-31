import { useMemo } from "react";
import type { HitMap } from "./nightStats";
import { shownHitPct } from "./playerRows";
import { useRoster, useTeamRecords } from "./storage";

/** The hit percentage each side got in the Mikke Mus matches the records kept, by match id and side name: what the evening's statistics read. */
export function useHitMap(): HitMap {
  const roster = useRoster();
  const teams = useTeamRecords();
  return useMemo(() => {
    const map: HitMap = {};
    for (const rec of [...roster, ...teams])
      for (const e of rec.matchHistory) {
        if (!e.matchId) continue;
        (map[e.matchId] ??= {})[rec.name] = shownHitPct(e);
      }
    return map;
  }, [roster, teams]);
}
