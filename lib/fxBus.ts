/**
 * The moments in a match that have an effect on screen, announced by the game and played by
 * components/FxStage.tsx. The game says what happened; the stage decides whether the chosen
 * animation level (lib/fxLevel.ts) wants it shown. Nothing here knows about drawing.
 */
export type FxEvent =
  /** A dart that scored, flying to its cell: the one named, or else the active player's active row. */
  | { type: "dart"; step?: string; player?: string }
  /** A triple or double landed. `label` is what the slam says, e.g. «TRIPPEL 20». */
  | { type: "ring"; label: string }
  /** All three darts of a turn counted. */
  | { type: "perfect"; run: number }
  /** A row got its last cross, for `player`. */
  | { type: "rowClosed"; step: string; player: string }
  /** A new thrower is up: `player` is the side whose column the lights swing onto. Named, because the
   *  screen has not yet moved the highlight when this is announced. */
  | { type: "walkOn"; player?: string }
  /** `name` took the lead. */
  | { type: "lead"; name: string }
  /** A personal record was beaten; `text` says which. */
  | { type: "record"; text: string }
  /** The thrower is one row from winning: the word slammed in. */
  /** The thrower can finish: «MATCHDART» when the last dart is a bull, «OUT» when the rest can be taken in this turn. */
  | { type: "matchdart"; word?: "MATCHDART" | "OUT" }
  /** The inner bull: a bullseye. */
  | { type: "bull" }
  /** A real dart that did not score: it bounces off and falls. */
  | { type: "miss" };

type Listener = (event: FxEvent) => void;
const listeners = new Set<Listener>();

export function emitFx(event: FxEvent): void {
  listeners.forEach((l) => l(event));
}

export function subscribeFx(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
