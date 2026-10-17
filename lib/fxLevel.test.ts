import { describe, expect, it } from "vitest";
import { DEFAULT_FX_LEVEL, FX_LEVELS, fxFlags, normalizeFxLevel } from "./fxLevel";

describe("fx levels", () => {
  it("the default is the app as it has always been", () => {
    expect(DEFAULT_FX_LEVEL).toBe("party");
    expect(fxFlags("party")).toMatchObject({ boomMaxStreak: 3, heat: true, shake: true, tripleOverlay: true, dives: true, confetti: true, crowd: false });
  });

  it("each step up adds and never takes away", () => {
    const keys = ["heat", "shake", "tripleOverlay", "dives", "confetti", "bigConfetti", "crowd"] as const;
    const flags = FX_LEVELS.map((l) => fxFlags(l));
    for (let i = 1; i < flags.length; i++) {
      for (const k of keys) expect(Number(flags[i][k])).toBeGreaterThanOrEqual(Number(flags[i - 1][k]));
      expect(flags[i].boomMaxStreak).toBeGreaterThanOrEqual(flags[i - 1].boomMaxStreak);
    }
  });

  it("Vanlig keeps a single soft boom and none of the big moments", () => {
    expect(fxFlags("normal")).toEqual({
      boomMaxStreak: 1,
      heat: false,
      shake: false,
      tripleOverlay: false,
      dives: false,
      confetti: false,
      bigConfetti: false,
      crowd: false,
      dartFlight: false,
      ringSlam: false,
      perfectBurst: false,
      fire: false,
      walkOn: false,
      rowShine: false,
      shirtRain: false,
      leadChange: false,
      commentary: false,
      matchDart: false,
      replay: false,
      recordBanner: false,
      walkOnTune: false,
    });
  });

  it("every new effect is Full party only: Vanlig and Party have none, Full party has all of them", () => {
    const keys = ["dartFlight", "ringSlam", "perfectBurst", "fire", "walkOn", "rowShine", "shirtRain", "leadChange", "commentary", "matchDart", "replay", "recordBanner", "walkOnTune"] as const;
    for (const level of ["normal", "party"] as const) for (const k of keys) expect(fxFlags(level)[k], `${level}.${k}`).toBe(false);
    for (const k of keys) expect(fxFlags("full")[k], `full.${k}`).toBe(true);
  });

  it("only Full party has the crowd and the heavy confetti", () => {
    expect(FX_LEVELS.filter((l) => fxFlags(l).crowd)).toEqual(["full"]);
    expect(FX_LEVELS.filter((l) => fxFlags(l).bigConfetti)).toEqual(["full"]);
  });

  it("falls back to the default for anything stored that is not a level", () => {
    for (const raw of [null, undefined, "", "PARTY", "full ", 3, {}]) expect(normalizeFxLevel(raw)).toBe(DEFAULT_FX_LEVEL);
    for (const l of FX_LEVELS) expect(normalizeFxLevel(l)).toBe(l);
  });

  it("an unknown level at runtime still yields flags rather than throwing", () => {
    expect(fxFlags("nope" as never)).toEqual(fxFlags(DEFAULT_FX_LEVEL));
  });
});
