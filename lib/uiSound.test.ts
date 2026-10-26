import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const played: string[] = [];
const touched: string[] = [];
vi.mock("./fanfare", () => ({
  playUiSound: (kind: string) => played.push(kind),
  playDrawTick: () => {},
}));
vi.mock("./haptics", () => ({
  haptics: {
    tick: () => touched.push("tick"),
    pick: () => touched.push("pick"),
    confirm: () => touched.push("confirm"),
    undo: () => touched.push("undo"),
    record: () => touched.push("record"),
  },
}));

let level = "party";
vi.mock("./fxLevel", () => ({ getFxLevel: () => level }));

import { uiFeedback, uiSound, type UiSoundKind } from "./uiSound";

const KINDS: UiSoundKind[] = ["click", "pick", "confirm", "undo", "record"];

describe("the sounds and touches of the interface", () => {
  beforeEach(() => {
    played.length = 0;
    touched.length = 0;
    level = "party";
  });
  afterEach(() => {
    level = "party";
  });

  it("plays every kind in Party and Full party", () => {
    for (const l of ["party", "full"]) {
      level = l;
      played.length = 0;
      KINDS.forEach((k) => uiSound(k));
      expect(played).toEqual(KINDS);
    }
  });

  it("plays nothing in Enkel and Vanlig, however the setting is", () => {
    for (const l of ["simple", "normal"]) {
      level = l;
      KINDS.forEach((k) => uiSound(k));
    }
    expect(played).toEqual([]);
  });

  it("asks for the touch and the sound together, the touch with its own name", () => {
    KINDS.forEach((k) => uiFeedback(k));
    expect(touched).toEqual(["tick", "pick", "confirm", "undo", "record"]);
    expect(played).toEqual(KINDS);
  });

  it("still asks for the touch when the sound is held back (the touch holds itself back, see haptics)", () => {
    level = "normal";
    uiFeedback("pick");
    expect(touched).toEqual(["pick"]);
    expect(played).toEqual([]);
  });
});
