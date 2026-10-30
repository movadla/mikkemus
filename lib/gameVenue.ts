import { useCallback, useEffect, useState } from "react";
import { VENUES, type VenueId } from "./venues";

/** The games that are played in a place of their own choosing, and that remember it (on this device) until the next time. */
export type VenueGame = "countdown" | "lava" | "highstriker";

const key = (game: VenueGame) => `mikke-mus-game-venue-${game}`;

/** The place a game is played in: what was chosen last time, otherwise the pub. Only how it looks, so it stays on the device. */
export function useGameVenue(game: VenueGame): [VenueId, (v: VenueId) => void] {
  const [venue, setVenue] = useState<VenueId>("lu");
  useEffect(() => {
    // Read after the first paint, so the server and the first render agree.
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(key(game));
        const found = VENUES.find((v) => v.id === saved);
        if (found) setVenue(found.id);
      } catch {
        /* not kept: the pub */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [game]);
  const choose = useCallback(
    (next: VenueId) => {
      setVenue(next);
      try {
        localStorage.setItem(key(game), next);
      } catch {
        /* not kept */
      }
    },
    [game],
  );
  return [venue, choose];
}
