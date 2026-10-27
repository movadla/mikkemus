/** The bell on top of the tower: it hangs still, and rings when `ring` turns true (give it a new key to ring again). */
export function Bell({ ring, size = 24 }: { ring: boolean; size?: number }) {
  return <span aria-hidden className={`hs-bell ${ring ? "hs-bell--ring" : ""}`} style={{ width: size, height: size }} />;
}
