/**
 * Scolia's CAMERA_IMAGES payload shape isn't documented anywhere we could find (checked
 * scoliadarts.com/api/ and the FAQ — only marketing copy, no field-level schema). Verified
 * against a real payload 2026-09-07 once the board was finally online: it arrives as
 * `{ images: [dataUri, dataUri, dataUri] }` — three base64 JPEGs, one per camera, sent
 * around each takeout. The walk is kept rather than narrowed to that exact shape, since
 * nothing documents it as stable: it looks for anything that reads as an image reference
 * (an http(s) URL or a data: URI) and simply finds nothing if the payload carries none.
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
