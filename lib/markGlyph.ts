/**
 * What a row's mark shows at a given number of crosses, for a row that closes at `target`.
 *
 * The glyph is a slash, a second slash (together an X) and a ring around it. At the standard
 * three crosses that is one stage per cross — the glyph the game has always had. A longer row
 * keeps the same first two stages and spreads the ring over the rest: four crosses draw half the
 * ring on the third, five draw a third and then two thirds. A shorter row skips stages instead —
 * with one cross the row is closed and draws as the finished glyph, because a lone slash would
 * read as a third of the way there.
 *
 * Whatever the target, the closed glyph is the same, so a closed row looks alike in every game.
 */
export type Glyph = {
  slash: boolean;
  cross: boolean;
  /** How much of the ring is drawn, 0–1. */
  ring: number;
};

const CLOSED: Glyph = { slash: true, cross: true, ring: 1 };
const EMPTY: Glyph = { slash: false, cross: false, ring: 0 };

export function glyphFor(count: number, target: number): Glyph {
  if (count <= 0) return EMPTY;
  if (count >= target) return CLOSED;
  if (count === 1) return { slash: true, cross: false, ring: 0 };
  if (count === 2) return { slash: true, cross: true, ring: 0 };
  // Three or more, and still short of the target: the ring is filling in. Only reachable with a
  // target of four or five, where target - 2 is at least two.
  return { slash: true, cross: true, ring: (count - 2) / (target - 2) };
}
