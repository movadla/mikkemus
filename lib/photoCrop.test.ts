import { describe, expect, it } from "vitest";
import { MAX_ZOOM, clampView, cropRect, normalizeLevels, scaleOf } from "./photoCrop";

const WIN = 260;

describe("the window on the picture", () => {
  it("shows the middle square of a wide picture at zoom 1", () => {
    const r = cropRect(2000, 1000, { zoom: 1, x: 0, y: 0 }, WIN);
    expect(r.size).toBeCloseTo(1000, 5);
    expect(r.sx).toBeCloseTo(500, 5);
    expect(r.sy).toBeCloseTo(0, 5);
  });

  it("shows less of the picture the more it is zoomed, round the same middle", () => {
    const r = cropRect(1000, 1000, { zoom: 2, x: 0, y: 0 }, WIN);
    expect(r.size).toBeCloseTo(500, 5);
    expect(r.sx).toBeCloseTo(250, 5);
    expect(r.sy).toBeCloseTo(250, 5);
  });

  it("moves the part that is shown the opposite way to the finger", () => {
    // Dragging the picture to the right shows more of its left side.
    const r = cropRect(2000, 1000, { zoom: 1, x: 100, y: 0 }, WIN);
    expect(r.sx).toBeLessThan(500);
  });

  it("never shows past an edge, however far it is dragged", () => {
    const view = clampView(2000, 1000, { zoom: 1, x: 5000, y: 5000 }, WIN);
    const scale = scaleOf(2000, 1000, 1, WIN);
    expect(view.x).toBeCloseTo((2000 * scale - WIN) / 2, 5);
    expect(view.y).toBe(0);
    const r = cropRect(2000, 1000, { zoom: 3, x: -9999, y: 9999 }, WIN);
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.size).toBeLessThanOrEqual(2000 + 1e-9);
    expect(r.sy + r.size).toBeLessThanOrEqual(1000 + 1e-9);
  });

  it("keeps the zoom in its range", () => {
    expect(clampView(1000, 1000, { zoom: 20, x: 0, y: 0 }, WIN).zoom).toBe(MAX_ZOOM);
    expect(clampView(1000, 1000, { zoom: 0.2, x: 0, y: 0 }, WIN).zoom).toBe(1);
  });
});

const pixels = (...values: number[]) => new Uint8ClampedArray(values.flatMap((v) => [v, v, v, 255]));
const meanOf = (d: Uint8ClampedArray) => {
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i];
  return s / (d.length / 4) / 255;
};

describe("the lift in light", () => {
  it("brightens a dark picture and dims a bright one", () => {
    const dark = pixels(40, 50, 60, 45);
    const before = meanOf(dark);
    normalizeLevels(dark);
    expect(meanOf(dark)).toBeGreaterThan(before);
    const bright = pixels(230, 240, 235, 245);
    const beforeBright = meanOf(bright);
    normalizeLevels(bright);
    expect(meanOf(bright)).toBeLessThan(beforeBright);
  });

  it("hardly touches a picture that is about right", () => {
    const mid = pixels(120, 130, 125, 128);
    const gain = normalizeLevels(mid);
    expect(gain).toBeGreaterThan(0.95);
    expect(gain).toBeLessThan(1.1);
    expect(Math.abs(meanOf(mid) - 0.49)).toBeLessThan(0.05);
  });

  it("never lifts or dims by more than about a third, and never leaves the range of a pixel", () => {
    const veryDark = pixels(2, 3, 2, 4);
    expect(normalizeLevels(veryDark)).toBeCloseTo(1.35, 5);
    const veryBright = pixels(255, 255, 250, 255);
    expect(normalizeLevels(veryBright)).toBeCloseTo(0.8, 5);
    for (const d of [veryDark, veryBright]) for (const v of d) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("leaves the transparent alone, and an empty picture as it is", () => {
    const d = new Uint8ClampedArray([10, 10, 10, 0]);
    expect(normalizeLevels(d)).toBe(1);
    expect(normalizeLevels(new Uint8ClampedArray([]))).toBe(1);
  });
});
