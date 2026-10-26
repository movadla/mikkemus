import { describe, expect, it } from "vitest";
import { brandIconSvg } from "./brandIconSvg";

describe("the app icon", () => {
  it("is one SVG with the ring, the dart and the board behind them", () => {
    const svg = brandIconSvg();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<line");
    expect(svg).toContain("<polygon");
    expect(svg.match(/<circle/g)!.length).toBeGreaterThan(10);
  });

  it("rounds the corners only when asked to", () => {
    expect(brandIconSvg({ rounded: true })).toContain('clip-path="url(#cl)"');
    expect(brandIconSvg()).not.toContain("clipPath");
  });

  it("draws smaller inside the safe zone for maskable icons", () => {
    expect(brandIconSvg({ safe: true })).toContain("scale(0.78)");
    expect(brandIconSvg()).toContain("scale(1)");
  });
});
