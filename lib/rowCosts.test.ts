import { describe, expect, it } from "vitest";
import { rowCosts } from "./rowCosts";
import type { TurnResult } from "./game";

describe("rowCosts", () => {
  it("counts darts per row when the turn knows them: a closing triple is one dart, a ring dart is none", () => {
    const turn: TurnResult = { hitsByStep: { "20": 3, D: 2 }, missStep: "20", misses: 0, darts: 3, dartsByStep: { "20": 1 } };
    expect(rowCosts([turn])["20"]).toBe(1);
  });

  it("falls back to crosses plus misses for turns without it", () => {
    const turn: TurnResult = { hitsByStep: { "20": 2 }, missStep: "20", misses: 1, darts: 3 };
    expect(rowCosts([turn])["20"]).toBe(3);
  });
});
