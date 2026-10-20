import { describe, expect, it } from "vitest";
import { challengeFor, randomVerifier } from "./spotify";

describe("PKCE", () => {
  it("makes the challenge the RFC 7636 way (the spec's own example)", async () => {
    expect(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("makes verifiers of a valid length from the unreserved alphabet", () => {
    const v = randomVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomVerifier()).not.toBe(v);
  });
});
