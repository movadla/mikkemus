import { describe, expect, it } from "vitest";
import { blockedForLimited } from "./access";

describe("what the limited code is kept out of", () => {
  it("shuts statistics, the nights and matches, the hall of fame, betting and the big screen, and what lies under them", () => {
    for (const p of ["/statistikk", "/hall-of-fame", "/kveld/2026-10-20", "/kamp/abc", "/bet", "/storskjerm"]) expect(blockedForLimited(p), p).toBe(true);
  });

  it("leaves the game, the tournaments and the players open", () => {
    for (const p of ["/", "/spillere", "/spillere/Vadla", "/lyd", "/turnering", "/kveld"]) expect(blockedForLimited(p), p).toBe(false);
  });

  it("does not take a path for another because it begins the same way", () => {
    expect(blockedForLimited("/betaling")).toBe(false);
    expect(blockedForLimited("/kampanje")).toBe(false);
    expect(blockedForLimited(null)).toBe(false);
  });
});
