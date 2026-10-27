import { describe, expect, it } from "vitest";
import { createKnockout } from "./knockout";
import { stageStrip } from "./stages";

describe("the strip of stages", () => {
  it("has a step per round of a knockout and starts on the first", () => {
    const t = createKnockout("individual", ["Lars", "Vadla", "Moen", "Hans"].map((name) => ({ name, isBot: false })), "t1", "2026-10-27");
    expect(stageStrip(t).map((s) => s.label)).toEqual(["Semi", "Finale"]);
    expect(stageStrip(t).map((s) => s.state)).toEqual(["now", "next"]);
  });
});
