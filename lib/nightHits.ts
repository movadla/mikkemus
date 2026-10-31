import { useMemo } from "react";
import { memberKey, type HitMap } from "./nightStats";
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
        // A team's match also tells each member's own share, under their name with the team mark.
        for (const [who, h] of Object.entries(e.hitsByMember ?? {})) if (h.hits + h.misses > 0) map[e.matchId][memberKey(who)] = (h.hits / (h.hits + h.misses)) * 100;
      }
    return map;
  }, [roster, teams]);
}
