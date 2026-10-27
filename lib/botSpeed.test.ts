import { describe, expect, it } from "vitest";
import { BOT_SPEEDS, botDelayMs, normalizeBotSpeed } from "./botSpeed";

describe("bot speed", () => {
  it("gets shorter the faster it is, and keeps the usual pause as the default", () => {
    const delays = BOT_SPEEDS.map((s) => botDelayMs(s));
    expect(delays).toEqual([...delays].sort((a, b) => b - a));
    expect(botDelayMs("normal")).toBe(900);
  });

  it("falls back to the usual speed for anything it does not know", () => {
    expect(normalizeBotSpeed("fast")).toBe("fast");
    expect(normalizeBotSpeed("warp")).toBe("normal");
    expect(normalizeBotSpeed(null)).toBe("normal");
  });
});
