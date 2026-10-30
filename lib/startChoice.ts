import type { SideMember } from "./teamGame";

/** What a game needs to be started by someone: the sides in the order they throw, and who was chosen to start (once chosen, it is not asked again). */
export type Startable = { players: string[]; rosters?: Record<string, SideMember[]>; firstUp?: string };

/** The game with `who` throwing first and the others after, in the order they had. */
export function startedBy<G extends Startable>(g: G, who: string): G {
  const at = g.players.indexOf(who);
  if (at < 0) return { ...g, firstUp: who };
  return { ...g, players: [...g.players.slice(at), ...g.players.slice(0, at)], firstUp: who };
}

/** A game that has not started and has not been asked yet: it needs the choice of who starts, when there is more than one side. */
export const needsStart = (g: Startable, thrown: number): boolean => thrown === 0 && g.firstUp === undefined && g.players.length >= 2;
