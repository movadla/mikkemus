"use client";

import { useAccess } from "@/lib/access";
import type { Career } from "@/lib/career";
import { TrophyArt } from "../CareerTrophy";

const PER_ROW = 5;

/** The year of a trophy, in two digits ('26), or nothing when the date does not read. */
const yearOf = (at: string) => {
  const y = new Date(at).getFullYear();
  return Number.isFinite(y) ? `'${String(y).slice(-2)}` : "";
};

/**
 * The cups the player has won, on a small shelf at home: the newest first, two rows at most, each with its year. Only to look at. Only with the show.
 */
export function TrophyShelf({ career }: { career: Career }) {
  const { show } = useAccess();
  if (!show || career.trophies.length === 0) return null;
  const shown = career.trophies.slice(0, PER_ROW * 2);
  const rows = [shown.slice(0, PER_ROW), shown.slice(PER_ROW)].filter((r) => r.length > 0);
  return (
    <div className="trophy-shelf" role="img" aria-label={`Pokalhylle: ${career.trophies.length} ${career.trophies.length === 1 ? "pokal" : "pokaler"}`}>
      {rows.map((row, i) => (
        <div key={i} className="trophy-shelf-row">
          {row.map((t, j) => (
            <span key={`${t.at}-${j}`} className="trophy-shelf-cup">
              <span className="trophy-shelf-art">
                <TrophyArt kind={t.tier} bare variant={t.name} />
              </span>
              <small className="tabular">{yearOf(t.at)}</small>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
