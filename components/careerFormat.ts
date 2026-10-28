import { DARTS, HOMES, PLACES, START_LEVELS, dollars, type DartsId, type HomeId } from "@/lib/career";

/** A new seed for an event or a challenge. Called from a handler, never from render. */
export const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

/** Money with a sign in front: what a result changed. */
export const signed = (n: number) => (n > 0 ? `+${dollars(n)}` : dollars(n));

export const homeName = (id: HomeId) => HOMES.find((h) => h.id === id)?.name ?? PLACES.find((p) => p.id === id)?.name ?? "";
export const dartsName = (id: DartsId) => DARTS.find((d) => d.id === id)?.name ?? "";

/** The name of the start level a MED is nearest to, for telling the player where they stand. */
export const levelLabel = (med: number) => [...START_LEVELS].sort((a, b) => Math.abs(a.med - med) - Math.abs(b.med - med))[0].name;

/** One decimal, with a comma. */
export const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");
