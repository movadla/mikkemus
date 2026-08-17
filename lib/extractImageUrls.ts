/**
 * Scolia's CAMERA_IMAGES payload shape isn't documented anywhere we could find (checked
 * scoliadarts.com/api/ and the FAQ — only marketing copy, no field-level schema, and the board
 * is currently offline so no real payload has been observed either). Rather than assume one
 * exact shape and break the moment it's wrong, this walks whatever object arrives looking for
 * anything that reads as an image reference (an http(s) URL or a data: URI) so the best-effort
 * display in components/CameraImages.tsx still works across shape variations, and simply finds
 * nothing (renders nothing) if the payload doesn't carry images at all.
 */
export function extractImageUrls(payload: unknown, max = 4): string[] {
  const found: string[] = [];

  function walk(value: unknown) {
    if (found.length >= max) return;
    if (typeof value === "string") {
      if (/^(https?:\/\/|data:image\/)/.test(value)) found.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  }

  walk(payload);
  return found;
}
