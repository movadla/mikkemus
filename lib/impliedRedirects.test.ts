import { describe, expect, it } from "vitest";
import { emptyProgress, type HitRecord, type PendingAmbiguous } from "./game";
import { impliedRedirects } from "./turnResolution";

const record = (step: "T" | "D"): HitRecord => ({ player: "P", step, prevCount: 0, newCount: 1, turnIndex: 0 });
const parked = (key: number, number: "20" | "19", ring: "T" | "D", extra: Partial<PendingAmbiguous> = {}): PendingAmbiguous => ({
  key,
  hitRecord: record(ring),
  ringStep: ring,
  number,
  multiplier: ring === "T" ? 3 : 2,
  dartIndex: key,
  ...extra,
});

describe("impliedRedirects: a later number says what the earlier dart was meant for", () => {
  it("a T19 after a T20 on 20 puts the T20 on the 20", () => {
    const t20 = parked(0, "20", "T");
    expect(impliedRedirects([t20], emptyProgress(), 19)).toEqual([t20]);
  });

  it("an S18 after T20 and T19 chains: each call looks at the number being worked on", () => {
    const t20 = parked(0, "20", "T");
    const t19 = parked(1, "19", "T");
    const board = emptyProgress();
    // 18 is two numbers ahead of 20: on the first call the T20 closes 20, which says nothing yet about 19 …
    expect(impliedRedirects([t20, t19], board, 18)).toEqual([t20]);
    // … and on the board where 20 is closed, the T19 closes 19 and 18 is the active number.
    board["20"] = 3;
    expect(impliedRedirects([t20, t19], board, 18)).toEqual([t19]);
  });

  it("assumes nothing when the parked darts do not close the number", () => {
    expect(impliedRedirects([parked(0, "20", "D")], emptyProgress(), 19)).toEqual([]);
  });

  it("two doubles together close it, the most recent first", () => {
    const a = parked(0, "20", "D");
    const b = parked(1, "20", "D");
    expect(impliedRedirects([a, b], emptyProgress(), 19)).toEqual([b, a]);
  });

  it("takes only as many darts as it needs", () => {
    const a = parked(0, "20", "T");
    const b = parked(1, "20", "T");
    expect(impliedRedirects([a, b], emptyProgress(), 19)).toEqual([b]);
  });

  it("says nothing for a dart on the active number itself, one behind it, or off the numbers", () => {
    const t20 = parked(0, "20", "T");
    expect(impliedRedirects([t20], emptyProgress(), 20)).toEqual([]);
    expect(impliedRedirects([t20], emptyProgress(), 13)).toEqual([]);
    const board = emptyProgress();
    board["20"] = 3;
    expect(impliedRedirects([parked(1, "19", "T")], board, 20)).toEqual([]);
  });

  it("leaves alone a dart already put on its number, and one the player has said to keep", () => {
    const done = parked(0, "20", "T", { redirected: true });
    expect(impliedRedirects([done], emptyProgress(), 19)).toEqual([]);
    const keep = parked(1, "20", "T");
    expect(impliedRedirects([keep], emptyProgress(), 19, (p) => p.key !== 1)).toEqual([]);
  });

  it("counts what the number already has", () => {
    const board = emptyProgress();
    board["20"] = 2;
    const d20 = parked(0, "20", "D");
    // One cross short: a double is more than enough.
    expect(impliedRedirects([d20], board, 19)).toEqual([d20]);
  });
});

describe("a dart put on its number stays a question", () => {
  it("is still asked about when the number it filled is full, and frees no ring", async () => {
    const { meaningfulPending, ambiguousBlockingRing } = await import("./game");
    const board = emptyProgress();
    board["20"] = 3;
    board.T = 3;
    const done = parked(0, "20", "T", { redirected: true });
    const open = parked(1, "20", "T");
    expect(meaningfulPending([done, open], board)).toEqual([done]);
    expect(ambiguousBlockingRing([done], "T", board)).toBeNull();
    expect(ambiguousBlockingRing([done, open], "T", board)).toBe(open);
  });
});
