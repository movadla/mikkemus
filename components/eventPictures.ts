import type { TierId } from "@/lib/career";

/**
 * The pictures of the events that have them: the place from outside (the picture of the opening) and from inside (behind the draw and the
 * matches). The events without are drawn as scenes. Files are in public/career; `focus` is the part of the picture that stays in view when
 * it is cut to the screen.
 */
export const EVENT_PICTURES: Partial<Record<TierId, { outside: string; alt: string; outsideFocus: string; inside: string; insideFocus: string }>> = {
  lu: { outside: "/career/pub-outside.jpg", alt: "Puben Ly, sett fra gaten", outsideFocus: "64% 40%", inside: "/career/pub-inside.jpg", insideFocus: "62% 50%" },
  region: { outside: "/career/region-outside.jpg", alt: "Puben der Regionmesterskapet arrangeres, i kveldssol", outsideFocus: "50% 50%", inside: "/career/region-inside.jpg", insideFocus: "50% 50%" },
  nm: { outside: "/career/nm-outside.jpg", alt: "Hotellet der Norgesmesterskapet spilles, i kveldssol", outsideFocus: "50% 55%", inside: "/career/nm-inside.jpg", insideFocus: "50% 50%" },
  gs: { outside: "/career/gs-outside.jpg", alt: "Civic Hall der Grand Slam spilles, sett utenfra om kvelden", outsideFocus: "40% 50%", inside: "/career/gs-inside.jpg", insideFocus: "55% 50%" },
  vm: { outside: "/career/vm-outside.jpg", alt: "Hallen til verdensmesterskapet, sett utenfra om kvelden", outsideFocus: "50% 55%", inside: "/career/vm-inside.jpg", insideFocus: "50% 50%" },
};
