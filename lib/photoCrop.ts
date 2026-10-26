/**
 * The arithmetic behind cropping a portrait (components/PhotoCropper.tsx): which square of the picture the round window shows, how far it
 * may be moved, and the small lift in light that makes pictures from different phones and rooms sit alike.
 */

/** How the picture is held in the window: `zoom` is 1 when the short side just fills the window; `x` and `y` are how far the middle of the
 *  picture has been moved from the middle of the window, in window pixels. */
export type CropView = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** How many window pixels one picture pixel is at this zoom. */
export function scaleOf(imgW: number, imgH: number, zoom: number, window: number): number {
  return (window / Math.min(imgW, imgH)) * zoom;
}

/** The view moved back inside the picture: the window never shows past an edge, and the zoom stays in its range. */
export function clampView(imgW: number, imgH: number, view: CropView, window: number): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
  const scale = scaleOf(imgW, imgH, zoom, window);
  const maxX = Math.max(0, (imgW * scale - window) / 2);
  const maxY = Math.max(0, (imgH * scale - window) / 2);
  return { zoom, x: Math.min(maxX, Math.max(-maxX, view.x)), y: Math.min(maxY, Math.max(-maxY, view.y)) };
}

/** The square of the picture, in picture pixels, that the window shows. */
export function cropRect(imgW: number, imgH: number, view: CropView, window: number): { sx: number; sy: number; size: number } {
  const v = clampView(imgW, imgH, view, window);
  const scale = scaleOf(imgW, imgH, v.zoom, window);
  const size = window / scale;
  // The point of the picture in the middle of the window moves the opposite way to the picture.
  const cx = imgW / 2 - v.x / scale;
  const cy = imgH / 2 - v.y / scale;
  return { sx: Math.min(imgW - size, Math.max(0, cx - size / 2)), sy: Math.min(imgH - size, Math.max(0, cy - size / 2)), size };
}

const GAIN_MIN = 0.8;
const GAIN_MAX = 1.35;
const CONTRAST = 1.04;

/**
 * Lifts a dark picture and takes a little off a bright one, towards a middle brightness, with a touch of contrast. Changes the pixels it is
 * given (RGBA, as from a canvas) and returns the gain it used. A picture that is already about right is hardly touched, and none is lifted or
 * dimmed by more than about a third, so a face does not turn into something else.
 */
export function normalizeLevels(data: Uint8ClampedArray, target = 0.5): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  if (n === 0) return 1;
  const mean = sum / n;
  const gain = Math.min(GAIN_MAX, Math.max(GAIN_MIN, mean > 0 ? target / mean : GAIN_MAX));
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = (data[i + c] / 255) * gain;
      data[i + c] = Math.round(Math.min(1, Math.max(0, (v - 0.5) * CONTRAST + 0.5)) * 255);
    }
  }
  return gain;
}
