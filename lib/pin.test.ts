import { describe, expect, it } from "vitest";
import { checkPin, fnv1a, lockSeconds, LOCK_SECONDS } from "./pin";

describe("the code", () => {
  it("lets the right code in and nothing else", async () => {
    expect(await checkPin("6969")).toBe(true);
    for (const wrong of ["1234", "6968", "9696", "0000", "696", "69690", "abcd", " 6969", "", "6969\n"]) expect(await checkPin(wrong), wrong).toBe(false);
  });

  it("works with the small hash where SHA-256 is missing", () => {
    // The same code through the fallback: the stored value is what this gives.
    expect(fnv1a("mikke-mus-pin:6969")).toBe("12093a46");
    expect(fnv1a("mikke-mus-pin:6968")).not.toBe("12093a46");
  });

  it("does not keep the code in plain text", async () => {
    const source = (await import("node:fs")).readFileSync(new URL("./pin.ts", import.meta.url), "utf8");
    expect(source).not.toContain("6969\"");
  });

  it("locks for longer each time", () => {
    expect(lockSeconds(1)).toBe(LOCK_SECONDS);
    expect(lockSeconds(2)).toBe(LOCK_SECONDS * 2);
    expect(lockSeconds(4)).toBe(LOCK_SECONDS * 8);
    expect(lockSeconds(0)).toBe(LOCK_SECONDS);
  });
});
