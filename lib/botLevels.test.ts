import { describe, expect, it } from "vitest";
import { botDisplayName, botLevelMedal, plainName } from "./botLevels";

describe("bot names", () => {
  it("writes no medal into the name, and gives the three strongest levels a medal to draw", () => {
    expect(botDisplayName("1")).toBe("Littler");
    expect(botDisplayName("4")).toBe("ChrisBell");
    expect([botLevelMedal("1"), botLevelMedal("2"), botLevelMedal("3"), botLevelMedal("4")]).toEqual([0, 1, 2, null]);
  });

  it("takes the medal off a name an older match wrote it with", () => {
    expect(plainName("Littler 🥇")).toBe("Littler");
    expect(plainName("Cor Dekker 🥈 (2)")).toBe("Cor Dekker (2)");
    expect(plainName("Vadla")).toBe("Vadla");
  });
});
