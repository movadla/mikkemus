"use client";

import type { ReactNode } from "react";
import { venueOf, type VenueId } from "@/lib/venues";
import { picturesFor } from "./eventPictures";
import { RoomBackdrop } from "./RoomBackdrop";
import { VenuePicker } from "./VenuePicker";

/**
 * A game played in a place: the picture of the room from inside lies behind the board, and the screen is in the dark theme whichever theme the app
 * is in, so what is written on it can be read on the picture.
 */
export function GameVenue({ venue, children }: { venue: VenueId; children: ReactNode }) {
  const v = venueOf(venue);
  const pics = picturesFor({ id: v.tier, key: v.key });
  return (
    <>
      {pics && <RoomBackdrop stage={0} src={pics.inside} focus={pics.insideFocus} dim={48} />}
      <div data-theme-scope="dark" className="game-venue room-over">
        {children}
      </div>
    </>
  );
}

/** Where the game is played, on the setup screen: the same row of pictures as for a tournament. */
export function VenueSection({ value, onChange }: { value: VenueId; onChange: (v: VenueId) => void }) {
  return (
    <div className="mt-4">
      <p className="section-label mb-2">STED · {venueOf(value).name.toUpperCase()}</p>
      <VenuePicker value={value} onChange={onChange} />
    </div>
  );
}
