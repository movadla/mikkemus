import { describe, expect, it } from "vitest";
import { aimPointFor, luckForBullDuelThrow, luckForThrow, sectorAt } from "./dartboard";
import { emptyProgress, type Step } from "./game";

describe("luckForThrow", () => {
  it("gives exactly the field's own value at dead center, even on a boundary between two equally-valuable outcomes", () => {
    // [0, 103] is the exact midpoint of the 99-107mm triple band, at T20's
    // wedge center — as safe as a throw can be both radially and angularly.
    // Nobody has closed 20 or filled T yet, so T20 and the S20 on the other
    // side of that boundary are both still worth exactly 1 cross — proximity
    // is 0 (dead center) AND the two sides agree anyway, doubly confirming xG is 1.
    const progress = emptyProgress();
    const result = luckForThrow([0, 103], null, progress);
    expect(result).not.toBeNull();
    expect(result!.step).toBe("T");
    expect(result!.xg).toBeCloseTo(1, 5);
  });

  it("blends a dart just inside the triple ring toward the worthless single behind it", () => {
    const progress = emptyProgress();
    progress["20"] = 3; // number 20 already closed -> landing in S20 would score nothing
    // r=106.9, 0.1mm inside the 107mm outer triple edge - nearly on the boundary,
    // so xG blends close to the average of T20's value (1) and S20's value (0).
    const result = luckForThrow([0, 106.9], null, progress);
    expect(result).not.toBeNull();
    expect(result!.step).toBe("T");
    expect(result!.xg).toBeCloseTo(0.51, 1);
  });

  it("blends the mirror-image dart just outside the triple ring the same way, from the other side", () => {
    const progress = emptyProgress();
    progress["20"] = 3; // number 20 already closed -> landing in S20 (where this dart lands) scores nothing
    // r=107.1, 0.1mm outside the 107mm outer triple edge, aiming at T (active step) since T is still open.
    const result = luckForThrow([0, 107.1], "T", progress);
    expect(result).not.toBeNull();
    expect(result!.step).toBe("T");
    expect(result!.xg).toBeCloseTo(0.5, 1);
  });

  it("treats a direct triple/double/bull hit as the intended target even with no known active step", () => {
    const progress = emptyProgress();
    progress["20"] = 3;
    // Same shot as the blended case above, but activeStepAtThrow is null —
    // must still resolve via the direct T20 sector match, not bail out to null.
    const result = luckForThrow([0, 106.9], null, progress);
    expect(result).not.toBeNull();
    expect(result!.xg).toBeCloseTo(0.51, 1);
  });

  it("judges a bull throw against its own edge correctly (regression: inner-disk proximity was inverted)", () => {
    const progress = emptyProgress();
    progress.BULL = 1;
    // r=6.3, just inside the 6.35mm inner-bull edge — should read as RISKY
    // (close to slipping out to the outer "25" ring), blending down toward
    // the average of Bull's value (2) and "25"'s value (1).
    const nearEdge = luckForThrow([0, 6.3], "BULL", progress);
    // r=0.1, essentially dead center — should read as safe, staying near 2.
    const nearCenter = luckForThrow([0, 0.1], "BULL", progress);

    expect(nearEdge).not.toBeNull();
    expect(nearCenter).not.toBeNull();
    expect(nearEdge!.step).toBe("BULL");
    expect(nearEdge!.xg).toBeCloseTo(1.53, 1);
    expect(nearCenter!.xg).toBeCloseTo(1.99, 1);
    // The core regression check: near the edge, xG must blend noticeably
    // toward the neighbor (lower) — not stay near the full value like the
    // (safe) center does. Inverted proximity would swap these two.
    expect(nearEdge!.xg).toBeLessThan(nearCenter!.xg);
  });

  it("gives the shared value once both sides of the nearest boundary are already full (nothing left to distinguish)", () => {
    const progress = emptyProgress();
    progress["20"] = 3;
    progress.T = 3;
    // Same near-edge triple shot as before, but now T is also full - crossing
    // either way scores nothing, so the boundary is inert and xG is just 0.
    expect(luckForThrow([0, 106.9], null, progress)!.xg).toBeCloseTo(0, 5);
  });

  it("returns null when no target can be inferred (a clean miss with no active step)", () => {
    // Straight off the board (r=200mm, well past the 170mm double ring), and
    // no active step to fall back on.
    expect(luckForThrow([0, 200], null, emptyProgress())).toBeNull();
    expect(sectorAt([0, 200])).toBe("None");
  });

  it("regression: a triple on the player's own fresh active number blends in its redirect value, not just the raw T value", () => {
    // Before the fix, this scored xG=1: T20 (raw value 1, T still open) vs
    // S20 (also worth 1, number 20 untouched) looked like an inert boundary.
    // But this triple can be redirected to finish number 20 outright (worth
    // 3 crosses in one dart) — a big blend the old formula couldn't see
    // because it never considered the redirect.
    //
    // Filed under "20", not "T". This assertion used to say "T", on the reasoning that a
    // triple is a triple however it's resolved — but the value above comes entirely from
    // completing 20, and the crosses it wins go to 20 as well. Filing the worth apart from
    // the crosses made a flawless leg read as 0.0 expected on every number and 24.0 on T.
    const progress = emptyProgress();
    const result = luckForThrow([0, 106.9], "20", progress);
    expect(result).not.toBeNull();
    expect(result!.step).toBe("20");
    expect(result!.xg).toBeCloseTo(2.03, 1);
  });

  it("regression: same redirect value applies when the triple ring is already full (auto-redirect, not a live choice)", () => {
    // classifyThrow auto-redirects a T-hit on the active number once T is
    // already full (no ambiguity left - it's the only possible outcome).
    // luckForThrow doesn't need to know which case it is; both are covered
    // by the same self-contained rule.
    const progress = emptyProgress();
    progress.T = 3;
    const result = luckForThrow([0, 106.9], "20", progress);
    expect(result).not.toBeNull();
    expect(result!.xg).toBeCloseTo(2.03, 1);
  });

  it("caps the redirect bonus by how much the number actually still needs, so a near-finished number gets no inflated bonus", () => {
    // Number 20 only needs 1 more cross - redirecting a triple there is worth
    // exactly 1, same as the plain single on the other side of the boundary,
    // so both sides agree and xG is just that shared value (1), not inflated.
    const progress = emptyProgress();
    progress["20"] = 2;
    expect(luckForThrow([0, 106.9], "20", progress)!.xg).toBeCloseTo(1, 5);
  });

  it("regression: a single landing right next to a double ring on its own number reflects the double's redirect potential too, not just its plain ring value", () => {
    // r=161.9, 0.1mm inside the 162mm double-ring boundary (still a single-20,
    // in the outer single band). Before the fix, the "other side" of this
    // boundary (D20) was valued at its plain ring value (1) — the same as
    // the single it's being compared against — making this boundary look
    // inert (xG=1) even though a real double-20 here could finish the whole
    // number in one dart. With valueWithRedirect applied to both sides, the
    // D20 side correctly reflects that redirect potential (2, capped by how
    // much "20" still needs), producing a real blend upward from 1.
    const progress = emptyProgress();
    const result = luckForThrow([0, 161.9], "20", progress);
    expect(result).not.toBeNull();
    expect(result!.step).toBe("20"); // attributed to the number worked on, not "D" - it landed as a single
    expect(result!.xg).toBeCloseTo(1.5, 1);
    expect(result!.xg).toBeGreaterThan(1); // the actual bug fix: no longer stuck at the inert 1.0

    // The redirect's value doesn't depend on whether D itself happens to be
    // full — redirecting always targets the NUMBER step, not D.
    const progressDFull = emptyProgress();
    progressDFull.D = 3;
    expect(luckForThrow([0, 161.9], "20", progressDFull)!.xg).toBeCloseTo(1.5, 1);
  });
});

describe("luckForBullDuelThrow", () => {
  it("stays close to a ring's own value at dead center", () => {
    // r=0.1, essentially dead center of red (inner bull) - barely blends
    // away from the full value of 2.
    expect(luckForBullDuelThrow([0, 0.1], 0, 10)).toBeCloseTo(1.99, 1);
  });

  it("blends red toward green's value near the 6.35mm red/green boundary", () => {
    const luck = luckForBullDuelThrow([0, 6], 0, 10);
    expect(luck).toBeCloseTo(1.53, 1);
  });

  it("blends green toward red's value from the other side of the same boundary", () => {
    const luck = luckForBullDuelThrow([0, 6.5], 0, 10);
    expect(luck).toBeCloseTo(1.48, 1);
  });

  it("blends green toward a miss near the 15.9mm green/miss boundary", () => {
    const luck = luckForBullDuelThrow([0, 15.8], 0, 10);
    expect(luck).toBeCloseTo(0.51, 1);
  });

  it("blends a miss toward green's value from just outside the same boundary", () => {
    const luck = luckForBullDuelThrow([0, 16], 0, 10);
    expect(luck).toBeCloseTo(0.49, 1);
  });

  it("fades a miss's proximity to green to exactly 0 well before the far side of the board — not the main game's unrelated 99mm triple boundary", () => {
    // A dart 25mm out (9.1mm past green's edge, beyond the 4.775mm fade
    // width) has nothing meaningful nearby anymore - a flat, uninterpolated
    // miss. Before this fix, reusing the main game's board geometry would
    // have kept this dart "close to something" all the way out past 50mm.
    expect(luckForBullDuelThrow([0, 25], 0, 10)).toBeCloseTo(0, 5);
  });

  it("caps the red/green blend once only 1 more point is needed to win", () => {
    // Needing only 1 more point, red (2, capped to 1) and green (1) are
    // equally sufficient to win - both sides agree, so xG is just 1.
    expect(luckForBullDuelThrow([0, 6], 9, 10)).toBeCloseTo(1, 5);
  });

  it("does not cap the green/miss boundary when only 1 point is needed (green alone is already enough)", () => {
    // Green is worth exactly 1, the same as the remaining need - the cap
    // doesn't kick in here, so this blends the same as the uncapped case.
    const luck = luckForBullDuelThrow([0, 15.8], 9, 10);
    expect(luck).toBeCloseTo(0.51, 1);
  });
});

describe("luckForThrow — which step the value is filed under", () => {
  /** Dead centre of a triple ring, for the wedge the given number sits in. */
  function tripleCentre(n: number): [number, number] {
    return aimPointFor({ ring: "T", number: n });
  }

  it("files a triple on your own number under that number, not under T", () => {
    // The whole worth of this dart is that it completes 20 — three crosses there, versus
    // one if it merely counted as a triple. Filing it under T while the crosses it wins go
    // to 20 made a perfect game read as 0.0 expected on every number and 24.0 on T.
    const result = luckForThrow(tripleCentre(20), "20", emptyProgress());
    expect(result).not.toBeNull();
    expect(result!.step).toBe("20");
    expect(result!.xg).toBeCloseTo(3, 5);
  });

  it("still files a triple on some other number under T", () => {
    // Nothing to redirect into here — this is an ordinary pre-banked triple worth one cross.
    const result = luckForThrow(tripleCentre(6), "20", emptyProgress());
    expect(result!.step).toBe("T");
    expect(result!.xg).toBeCloseTo(1, 5);
  });

  it("files an early bullseye under D, matching the house rule that scores it as a double", () => {
    const result = luckForThrow([0, 0], "20", emptyProgress());
    expect(result!.step).toBe("D");
    expect(result!.xg).toBeCloseTo(1, 5);
  });

  it("files a bullseye under BULL once BULL is what you're on", () => {
    const result = luckForThrow([0, 0], "BULL", emptyProgress());
    expect(result!.step).toBe("BULL");
    expect(result!.xg).toBeCloseTo(2, 5);
  });

  it("prices a flawless leg at exactly the crosses it wins, field by field", () => {
    // Seven triples closing 20 down to 14, three triples and three doubles filling T and D,
    // then two bullseyes. Every dart dead centre, so nothing is lucky or unlucky: expected
    // must land on 3.0 for all ten fields, and 30 in total.
    const progress = emptyProgress();
    const byStep: Record<string, number> = {};
    const record = (coords: [number, number], activeStep: Step, closes: Step, crosses: number) => {
      const r = luckForThrow(coords, activeStep, progress);
      byStep[r!.step] = (byStep[r!.step] ?? 0) + r!.xg;
      progress[closes] = Math.min(3, progress[closes] + crosses);
    };

    for (const n of [20, 19, 18, 17, 16, 15, 14]) {
      record(tripleCentre(n), String(n) as Step, String(n) as Step, 3);
    }
    for (let i = 0; i < 3; i++) record(tripleCentre(6), "D", "T", 1);
    for (let i = 0; i < 3; i++) record(aimPointFor({ ring: "D", number: 6 }), "D", "D", 1);
    record([0, 0], "BULL", "BULL", 2);
    record([0, 0], "BULL", "BULL", 1);

    for (const step of ["20", "19", "18", "17", "16", "15", "14", "D", "T", "BULL"] as Step[]) {
      expect(byStep[step]).toBeCloseTo(3, 5);
    }
    expect(Object.values(byStep).reduce((a, b) => a + b, 0)).toBeCloseTo(30, 5);
  });
});
