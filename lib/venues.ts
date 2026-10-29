/**
 * The places a tournament can be played in outside the career: the same halls, pubs and arenas the career has pictures of, so a cup between
 * friends looks like the real thing. A venue stands on one of the steps of the career (its colour, its trophy and the size of its opening), and
 * may have pictures of its own (an invitation's key in components/eventPictures.ts).
 *
 * What venue a tournament is played at is only how it looks, so it is kept on the device (not with the tournament in the database): another device
 * shows the one that fits its size.
 */
import type { CupKind } from "./botCup";
import type { TierId } from "./career";
import type { Tournament } from "./tournament";

export type VenueId = "lu" | "region" | "nm" | "gs" | "vm" | "wc" | "tv" | "trondheim" | "stavanger";

export type Venue = {
  id: VenueId;
  name: string;
  /** One line about the place, under its name in the picker. */
  line: string;
  /** The step of the career it stands on: its colour, its trophy, how big its opening is. */
  tier: TierId;
  /** The key of the invitation that has pictures of the place, when it is not the step's own. */
  key?: string;
};

export const VENUES: Venue[] = [
  { id: "lu", name: "Ly-puben", line: "Fredagskveld på puben", tier: "lu" },
  { id: "region", name: "Regionhallen", line: "Hallen i regionen", tier: "region" },
  { id: "nm", name: "Nasjonalarenaen", line: "Kampen om Norge", tier: "nm" },
  { id: "gs", name: "Grand Slam-hallen", line: "Civic Hall om kvelden", tier: "gs" },
  { id: "vm", name: "VM-arenaen", line: "Hele verden ser på", tier: "vm" },
  { id: "wc", name: "World Cup-arenaen", line: "Nasjonene møtes", tier: "vm", key: "wc" },
  { id: "tv", name: "TV-studioet", line: "Lys, kameraer og røyk", tier: "gs", key: "tv" },
  { id: "trondheim", name: "Trondheim", line: "Domkirken i solnedgang", tier: "region", key: "trondheim" },
  { id: "stavanger", name: "Stavanger", line: "Fargerike trehus", tier: "nm", key: "stavanger" },
];

export const venueOf = (id: VenueId): Venue => VENUES.find((v) => v.id === id) ?? VENUES[0];

/** The place a cup against bots fits: the European championship is a Grand Slam in looks and trophy. */
const OF_CUP: Record<CupKind, VenueId> = { vm: "vm", em: "gs", gs: "gs", nm: "nm", open: "lu", lu: "lu", region: "region" };
export const venueForCup = (kind: CupKind): VenueId => OF_CUP[kind];

/** The place that fits a tournament of this many, when nothing is chosen: a pub for a few, an arena for many. */
export function venueForSize(entrants: number): VenueId {
  if (entrants <= 8) return "lu";
  if (entrants <= 16) return "region";
  if (entrants <= 32) return "nm";
  if (entrants <= 64) return "gs";
  return "vm";
}

/** The place nothing has been chosen for. */
export const defaultVenue = (cup: CupKind | undefined, entrants: number): VenueId => (cup ? venueForCup(cup) : venueForSize(entrants));

const KEY = "mikke-mus-venues";

function readAll(): Record<string, VenueId> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, VenueId>;
  } catch {
    return {};
  }
}

/** Remembers where a tournament is played (only how it looks, so on this device only). */
export function saveVenue(tournamentId: string, venue: VenueId): void {
  try {
    const all = readAll();
    all[tournamentId] = venue;
    // Only the latest forty are kept.
    const ids = Object.keys(all);
    for (const id of ids.slice(0, Math.max(0, ids.length - 40))) delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* not kept: the default fits the next time */
  }
}

/** Where a tournament is played: what was chosen on this device, otherwise what fits it. */
export function venueOfTournament(t: Pick<Tournament, "id" | "cup" | "participants">): VenueId {
  const chosen = readAll()[t.id];
  return chosen && VENUES.some((v) => v.id === chosen) ? chosen : defaultVenue(t.cup?.kind, t.participants.length);
}
