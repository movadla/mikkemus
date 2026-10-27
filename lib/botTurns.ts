/**
 * The bots in the games where the rounds are kept in a list (301 and 501, Highstriker, Lava). Taking back a round must not leave the
 * bot to throw it again at once, so it takes the bots' rounds back with it, and one of the human's.
 */
type Rounded = { turns: { player: string }[] };

/** The game with the trailing rounds of bots taken back, and then the last round of a human. With no bot up it is just the last round. */
export function undoThroughBots<G extends Rounded>(g: G, isBot: (player: string) => boolean): G {
  const turns = [...g.turns];
  while (turns.length > 0 && isBot(turns[turns.length - 1].player)) turns.pop();
  if (turns.length > 0) turns.pop();
  return { ...g, turns };
}
