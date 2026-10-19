import { describe, expect, it } from "vitest";
import { mouseIconSvg } from "./mouseIconSvg";

describe("the app icon", () => {
  it("is one SVG with the M, the eyes and the whiskers", () => {
    const svg = mouseIconSvg();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<polygon");
    expect(svg.match(/<circle/g)!.length).toBeGreaterThan(10);
  });

  it("rounds the corners only when asked to", () => {
    expect(mouseIconSvg({ rounded: true })).toContain('clip-path="url(#cl)"');
    expect(mouseIconSvg()).not.toContain("clipPath");
  });

  it("draws smaller inside the safe zone for maskable icons", () => {
    expect(mouseIconSvg({ safe: true })).toContain("scale(0.78)");
    expect(mouseIconSvg()).toContain("scale(1)");
  });
});
