import { describe, expect, it } from "vitest";
import { byHue, contrast, hsl, suggestPatternColours } from "./kitColours";
import { KIT_COLOURS } from "./teamKit";

describe("colours of a shirt", () => {
  it("reads hue, saturation and lightness", () => {
    expect(hsl("#ff0000")).toMatchObject({ h: 0, s: 1 });
    expect(Math.round(hsl("#00ff00").h)).toBe(120);
    expect(Math.round(hsl("#0000ff").h)).toBe(240);
    expect(hsl("#808080").s).toBe(0);
  });

  it("gives the contrast of black on white as 21 and of a colour on itself as 1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#d8392b", "#d8392b")).toBe(1);
  });

  it("puts the colours in a row like a spectrum with the greys last, keeping every colour", () => {
    const row = byHue();
    expect(row).toHaveLength(KIT_COLOURS.length);
    expect(new Set(row.map((c) => c.hex)).size).toBe(KIT_COLOURS.length);
    const names = row.map((c) => c.name);
    // White, silver and black are at the end, lightest first.
    expect(names.slice(-3)).toEqual(["Hvit", "Sølv", "Sort"]);
    // Red comes before blue, and blue before purple.
    expect(names.indexOf("Rød")).toBeLessThan(names.indexOf("Blå"));
    expect(names.indexOf("Blå")).toBeLessThan(names.indexOf("Lilla"));
  });
});

describe("colours that go with a main colour", () => {
  it("offers three that the pattern can be seen in, none of them the main colour itself", () => {
    for (const c of KIT_COLOURS) {
      const s = suggestPatternColours(c.hex);
      expect(s.length).toBeGreaterThan(0);
      expect(s.length).toBeLessThanOrEqual(3);
      for (const x of s) {
        expect(x.hex.toLowerCase()).not.toBe(c.hex.toLowerCase());
        expect(contrast(c.hex, x.hex)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("offers the light ones for a dark shirt and a dark one for a light shirt", () => {
    const forNavy = suggestPatternColours("#1d2a4a");
    expect(forNavy.some((c) => ["Hvit", "Sølv", "Gul", "Lime", "Oransje"].includes(c.name))).toBe(true);
    const forWhite = suggestPatternColours("#f4f0e8");
    expect(forWhite.some((c) => ["Marine", "Sort", "Vinrød", "Mørk rød"].includes(c.name))).toBe(true);
  });

  it("does not offer two of the same sort", () => {
    const s = suggestPatternColours("#1b1b1b");
    const names = s.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(!(names.includes("Hvit") && names.includes("Sølv"))).toBe(true);
  });

  it("is the same every time", () => {
    expect(suggestPatternColours("#2f6fd1")).toEqual(suggestPatternColours("#2f6fd1"));
  });
});
