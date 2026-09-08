import { describe, expect, it } from "vitest";
import { emptyProgress, type Progress, type Step } from "./game";
import { classifyThrow, parseSector } from "./scoliaMapping";

function classify(sector: string, activeStep: Step | null, progress: Progress = emptyProgress()) {
  return classifyThrow(parseSector(sector, false), activeStep, progress);
}

describe("classifyThrow — bullseye before BULL is up", () => {
  it("scores the red bull as one double when BULL is not the active step", () => {
    expect(classify("Bull", "20")).toEqual({ step: "D", crosses: 1, ambiguous: null });
  });

  it("still scores it as two crosses on BULL once BULL is the active step", () => {
    expect(classify("Bull", "BULL")).toEqual({ step: "BULL", crosses: 2, ambiguous: null });
  });

  it("applies while D itself is the active step", () => {
    expect(classify("Bull", "D")).toEqual({ step: "D", crosses: 1, ambiguous: null });
  });

  it("leaves outer bull alone — only the red one earns the double", () => {
    expect(classify("25", "20")).toEqual({ step: "BULL", crosses: 1, ambiguous: null });
  });

  it("leaves the D row's own capacity to isRegistrable rather than pre-checking it", () => {
    // D already full: the throw is still classified as a double, and gets rejected
    // downstream like any other double would be — this function stays state-light.
    const progress = { ...emptyProgress(), D: 3 };
    expect(classify("Bull", "20", progress)).toEqual({ step: "D", crosses: 1, ambiguous: null });
  });
});
