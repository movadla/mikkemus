import { describe, expect, it } from "vitest";
import { checkPin, fnv1a, lockSeconds, LOCK_SECONDS } from "./pin";

describe("the codes", () => {
  it("opens the full door with 9696 and the limited one with 6969, and nothing else", async () => {
    expect(await checkPin("9696")).toBe("full");
    expect(await checkPin("6969")).toBe("limited");
    for (const wrong of ["1234", "6968", "9669", "0000", "696", "96960", "abcd", " 6969", "", "9696\n"]) expect(await checkPin(wrong), wrong).toBeNull();
  });

  it("works with the small hash where SHA-256 is missing", () => {
    // The same codes through the fallback: the stored values are what this gives.
    expect(fnv1a("mikke-mus-pin:9696")).toBe("8d3fe786");
    expect(fnv1a("mikke-mus-pin:6969")).toBe("12093a46");
    expect(fnv1a("mikke-mus-pin:6968")).not.toBe("12093a46");
  });

  it("does not keep the codes in plain text", async () => {
    const source = (await import("node:fs")).readFileSync(new URL("./pin.ts", import.meta.url), "utf8");
    expect(source).not.toContain("6969\"");
    expect(source).not.toContain("9696\"");
  });

  it("locks for longer each time", () => {
    expect(lockSeconds(1)).toBe(LOCK_SECONDS);
    expect(lockSeconds(2)).toBe(LOCK_SECONDS * 2);
    expect(lockSeconds(4)).toBe(LOCK_SECONDS * 8);
    expect(lockSeconds(0)).toBe(LOCK_SECONDS);
  });
});

describe("logging out", () => {
  it("forgets the stored level and tells the door to close", async () => {
    const store = new Map<string, string>();
    const events: string[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    const before = { localStorage: g.localStorage, window: g.window, Event: g.Event };
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    g.window = { dispatchEvent: (e: { type: string }) => events.push(e.type) };
    g.Event = class { constructor(public type: string) {} };
    try {
      const { forgetDevice, rememberDevice, rememberedLevel, SIGN_OUT_EVENT } = await import("./pin");
      rememberDevice("full");
      expect(rememberedLevel()).toBe("full");
      forgetDevice();
      expect(rememberedLevel()).toBeNull();
      expect(events).toEqual([SIGN_OUT_EVENT]);
      // And the other code can be remembered after it.
      rememberDevice("limited");
      expect(rememberedLevel()).toBe("limited");
    } finally {
      Object.assign(g, before);
    }
  });
});
