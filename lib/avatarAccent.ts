/** Deterministic per-name accent so two players sharing a first initial (e.g. "Moen"/"Morten")
 *  don't render visually-identical fallback avatars. Picks from tones already used elsewhere for
 *  text/accents (not gold/red, which are reserved — see globals.css) so it stays in the existing
 *  palette rather than adding new hues. */
const AVATAR_ACCENTS = ["var(--color-teal-strong)", "var(--color-cream)", "var(--color-teal)", "var(--color-muted)"];

export function avatarAccent(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_ACCENTS[Math.abs(hash) % AVATAR_ACCENTS.length];
}
