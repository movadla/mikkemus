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
