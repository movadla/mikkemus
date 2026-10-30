import { describe, expect, it } from "vitest";
import { needsStart, startedBy } from "./startChoice";

describe("hvem starter", () => {
  const g = { players: ["Vadla", "Monge", "Hans"] };

  it("flytter den valgte først og beholder rekkefølgen etter", () => {
    expect(startedBy(g, "Monge")).toEqual({ players: ["Monge", "Hans", "Vadla"], firstUp: "Monge" });
    expect(startedBy(g, "Hans").players).toEqual(["Hans", "Vadla", "Monge"]);
    expect(startedBy(g, "Vadla").players).toEqual(g.players);
  });

  it("spør bare før noe er kastet, og bare én gang, med minst to sider", () => {
    expect(needsStart(g, 0)).toBe(true);
    expect(needsStart(g, 3)).toBe(false);
    expect(needsStart(startedBy(g, "Hans"), 0)).toBe(false);
    expect(needsStart({ players: ["Vadla"] }, 0)).toBe(false);
  });
});
