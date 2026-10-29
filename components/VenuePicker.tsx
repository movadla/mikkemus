"use client";

import { VENUES, type VenueId } from "@/lib/venues";
import { picturesFor } from "./eventPictures";

/**
 * Where the tournament is played, as a row of pictures to choose from: the pub, the halls, the arenas, the studio. They are the places of the
 * career, so a tournament between friends looks like one of those. Swipe sideways; the chosen one has a frame in the colour of the app.
 */
export function VenuePicker({ value, onChange }: { value: VenueId; onChange: (v: VenueId) => void }) {
  return (
    <div className="venue-row" role="radiogroup" aria-label="Sted">
      {VENUES.map((v) => {
        const pics = picturesFor({ id: v.tier, key: v.key });
        return (
          <button key={v.id} type="button" role="radio" aria-checked={value === v.id} onClick={() => onChange(v.id)} className="venue-tile tactile">
            {pics && (
              // eslint-disable-next-line @next/next/no-img-element -- one fixed picture from public/career
              <img src={pics.outside} alt="" draggable={false} style={{ objectPosition: pics.outsideFocus }} />
            )}
            <span className="venue-name">
              <b>{v.name}</b>
              <small>{v.line}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
