import type { TierId } from "@/lib/career";

/**
 * The pictures of the events that have them: the place from outside (the picture of the opening) and from inside (behind the draw and the
 * matches). The events without are drawn as scenes. Files are in public/career; `focus` is the part of the picture that stays in view when
 * it is cut to the screen.
 */
export const EVENT_PICTURES: Partial<Record<TierId, { outside: string; alt: string; outsideFocus: string; inside: string; insideFocus: string }>> = {
  lu: { outside: "/career/pub-outside.jpg", alt: "Puben Ly, sett fra gaten", outsideFocus: "64% 40%", inside: "/career/pub-inside.jpg", insideFocus: "62% 50%" },
  region: { outside: "/career/region-outside.jpg", alt: "Puben der Regionmesterskapet arrangeres, i kveldssol", outsideFocus: "50% 50%", inside: "/career/region-inside.jpg", insideFocus: "50% 38%" },
  nm: { outside: "/career/nm-outside.jpg", alt: "Hotellet der Norgesmesterskapet spilles, i kveldssol", outsideFocus: "50% 55%", inside: "/career/nm-inside.jpg", insideFocus: "60% 35%" },
  gs: { outside: "/career/gs-outside.jpg", alt: "Civic Hall der Grand Slam spilles, sett utenfra om kvelden", outsideFocus: "40% 50%", inside: "/career/gs-inside.jpg", insideFocus: "55% 50%" },
  vm: { outside: "/career/vm-outside.jpg", alt: "Hallen til verdensmesterskapet, sett utenfra om kvelden", outsideFocus: "50% 55%", inside: "/career/vm-inside.jpg", insideFocus: "50% 50%" },
};

/**
 * The pictures of an invitation that has places of its own (the World Cup, the finale of the season, the television studio), by the key of the
 * invitation. One that is not here is played in the place of the step it is built on. To give one its own, make the two pictures (see
 * art/prompts/turneringer.md), put them in public/career, and add the line here.
 */
export const INVITE_PICTURES: Record<string, Partial<NonNullable<(typeof EVENT_PICTURES)[TierId]>>> = {
  // Trondheim Open and Stavanger Masters have a picture of their own both outside and inside.
  stavanger: { outside: "/career/stavanger-outside.jpg", alt: "Fargerike trehus og flagglenker i en gate i Stavanger, der Stavanger Masters åpnes", outsideFocus: "50% 50%", inside: "/career/stavanger-inside.jpg", insideFocus: "50% 50%" },
  trondheim: { outside: "/career/trondheim-outside.jpg", alt: "Domkirken i Trondheim i solnedgang, der Trondheim Open åpnes", outsideFocus: "50% 50%", inside: "/career/trondheim-inside.jpg", insideFocus: "50% 50%" },
  // The television studio: the show of one leg, the best of three, and the evening of eight. The building at sunset opens it, the studio is where it is played.
  tv: { outside: "/career/tv-outside.jpg", alt: "TV-huset i solnedgang, med parabolantenner på taket, der showet spilles", outsideFocus: "50% 45%", inside: "/career/tv-inside.jpg", insideFocus: "50% 45%" },
  "tv-kveld": { outside: "/career/tv-outside.jpg", alt: "TV-huset i solnedgang, med parabolantenner på taket, der showet spilles", outsideFocus: "50% 45%", inside: "/career/tv-inside.jpg", insideFocus: "50% 45%" },
  // World Cup of Darts: the hall from outside and the arena inside, where the matches are played.
  wc: { outside: "/career/wc-outside.jpg", alt: "Hallen til World Cup of Darts i solnedgang, sett utenfra", outsideFocus: "50% 55%", inside: "/career/wc-inside.jpg", insideFocus: "50% 50%" },
};

/** The pictures of an event: its own when it is an invitation with them, otherwise those of the step it is built on. */
export const picturesFor = (tier: { id: TierId; key?: string }) => {
  const own = tier.key ? INVITE_PICTURES[tier.key] : undefined;
  const base = EVENT_PICTURES[tier.id];
  return own && base ? { ...base, ...own } : base;
};

/**
 * Pictures kept in reserve, ready to be used where an event needs one (public/career, the originals in art/arenas): two arenas full of people, with
 * darts in a board in the foreground. The red and blue one suits a final or a show; the green one a championship of nations. Not used by anything yet.
 */
export const RESERVE_PICTURES = { redBlue: "/career/arena-rod-bla.jpg", green: "/career/arena-gronn.jpg" } as const;
