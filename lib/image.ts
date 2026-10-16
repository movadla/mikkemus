/**
 * A picture chosen on the phone, shrunk to what the app shows it at. The camera's own file is
 * 2–4 MB, and a player's picture is stored on the row and fetched with every player in one go:
 * a few of them made the list 15 MB, too heavy for a phone, and the whole list stopped loading.
 * 320 px on the long side is more than the 72 px it is drawn at, at about 20 KB.
 */
export const PHOTO_MAX_SIDE = 320;

export async function photoToDataUrl(file: File, maxSide: number = PHOTO_MAX_SIDE): Promise<string> {
  // imageOrientation applies the camera's rotation, which a plain canvas draw would drop.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    bitmap.close();
  }
}
