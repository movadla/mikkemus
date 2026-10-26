/**
 * Where the arrow keys go in a list: the next row, the one before, the first, the last. Pure, so the keys are tested without a page.
 * `null` is a key that means nothing here, left for the browser (the page scrolls, a text field moves its cursor).
 */
export function nextIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return current < 0 ? 0 : Math.min(count - 1, current + 1);
    case "ArrowUp":
    case "ArrowLeft":
      return current < 0 ? count - 1 : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** The digit 1 to 9 as a place in a short list (1 is the first), or null when the key is not one or the list has no such place. */
export function digitIndex(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const i = Number(key) - 1;
  return i < count ? i : null;
}
