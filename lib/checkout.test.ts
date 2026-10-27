import { describe, expect, it } from "vitest";
import { checkoutLine, checkoutsOf } from "./checkout";

describe("checkout", () => {
  it("knows the classics with a double out", () => {
    expect(checkoutLine(170, true)).toBe("T20 T20 Bull");
    expect(checkoutLine(167, true)).toBe("T20 T19 Bull");
    expect(checkoutLine(40, true)).toBe("D20");
    expect(checkoutLine(50, true)).toBe("Bull");
    expect(checkoutLine(32, true)).toBe("D16");
    expect(checkoutLine(2, true)).toBe("D1");
    expect(checkoutLine(100, true)).toBe("T20 D20");
  });

  it("has no way out for the numbers that cannot be done", () => {
    for (const n of [169, 168, 166, 165, 163, 162, 159]) expect(checkoutLine(n, true)).toBeNull();
    expect(checkoutLine(1, true)).toBeNull();
    expect(checkoutLine(171, true)).toBeNull();
    expect(checkoutLine(0, true)).toBeNull();
  });

  it("can finish every number from 2 to 170 that has a way out, ending on a double", () => {
    const impossible = new Set([169, 168, 166, 165, 163, 162, 159]);
    for (let n = 2; n <= 170; n++) {
      const way = checkoutsOf(n, true)[0];
      if (impossible.has(n)) {
        expect(way).toBeUndefined();
        continue;
      }
      expect(way, String(n)).toBeDefined();
      expect(way!.length).toBeLessThanOrEqual(3);
      const last = way![way!.length - 1];
      expect(last === "Bull" || /^D\d+$/.test(last), `${n}: ${way}`).toBe(true);
    }
  });

  it("lets any dart finish without a double out", () => {
    expect(checkoutLine(1, false)).toBe("1");
    expect(checkoutLine(60, false)).toBe("T20");
    expect(checkoutLine(180, false)).toBeNull();
  });
});
