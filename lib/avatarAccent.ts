/** One colour per name, the same everywhere: the ring of the face, the stripe of a row, the line of a chart. Eight tokens (--player-1 to
 *  --player-8 in globals.css, each tuned for both themes; gold and red are not among them, they are reserved), picked by a hash of the
 *  name so two players who share a first letter (e.g. "Moen"/"Morten") still look different. */
export const PLAYER_COLOURS = 8;

export function avatarAccent(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `var(--player-${(Math.abs(hash) % PLAYER_COLOURS) + 1})`;
}
