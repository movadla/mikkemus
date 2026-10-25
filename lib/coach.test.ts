import { describe, expect, it } from "vitest";
import { coachTips, sumBias } from "./coach";
import { emptyRecord, type MatchHistoryEntry, type PlayerRecord } from "./playerRows";

const entry = (i: number, hitPct: number, bias?: MatchHistoryEntry["bias"]): MatchHistoryEntry => ({
  date: `2026-10-${String(i + 1).padStart(2, "0")}`,
  won: true,
  dartsUsed: 60,
  hitPct,
  med: 30,
  mhd: 15,
  mvd: 15,
  ...(bias ? { bias } : {}),
});

const player = (name: string, over: Partial<PlayerRecord> = {}, med = 30): PlayerRecord => {
  const r = emptyRecord(name);
  return { ...r, accuracy: { sumDistance: med * 100, sumHorizontal: 1000, sumVertical: 1000, throws: 100 }, ...over };
};
const rows = (spec: Record<string, [number, number]>): PlayerRecord["steps"] => {
  const r = emptyRecord("x").steps;
  for (const [k, [h, m]] of Object.entries(spec)) r[k as keyof typeof r] = { hits: h, misses: m };
  return r;
};
const titles = (r: PlayerRecord, group: PlayerRecord[] = []) => coachTips(r, group).tips.map((t) => t.title);

describe("coachTips", () => {
  it("says nothing before there are enough measured darts, or for a team", () => {
    expect(coachTips(player("Per", { accuracy: { sumDistance: 300, sumHorizontal: 100, sumVertical: 100, throws: 10 } })).tips).toEqual([]);
    expect(coachTips({ ...player("Per & Ola"), kind: "team" }).tips).toEqual([]);
  });

  it("reports which way the darts miss, from the signed totals", () => {
    const low = player("Per", { matchHistory: [entry(0, 50, { n: 60, dx: 60 * 7, dy: -60 * 9, rn: 0, rad: 0 })] });
    const t = coachTips(low).tips;
    expect(t.find((x) => x.title === "Du sikter for lavt")?.text).toContain("9 mm under");
    expect(t.find((x) => x.title === "Du sikter for mye mot høyre")?.text).toContain("7 mm til høyre");
  });

  it("says well centred when the darts land within a few millimetres of the aim, and invents no fault", () => {
    const centred = player("Per", { matchHistory: [entry(0, 50, { n: 60, dx: 60 * 1, dy: -60 * 2, rn: 0, rad: 0 })] });
    const t = coachTips(centred).tips;
    expect(t.map((x) => x.title)).toEqual(["Godt sentrert"]);
    expect(t[0].tone).toBe("good");
  });

  it("needs enough darts behind a direction", () => {
    const few = player("Per", { matchHistory: [entry(0, 50, { n: 10, dx: 0, dy: -200, rn: 0, rad: 0 })] });
    expect(titles(few)).toEqual([]);
  });

  it("names the strongest and the weakest number", () => {
    const r = player("Per", { steps: rows({ "20": [70, 30], "19": [60, 40], "18": [55, 45], "14": [40, 60] }) });
    const t = titles(r);
    expect(t).toContain("Sterkest på 20");
    expect(t).toContain("Svakest på 14");
  });

  it("does not judge doubles and triples by their row percentage, which is not a measure of precision", () => {
    const low = player("Per", { steps: rows({ "20": [60, 40], "19": [60, 40], "18": [60, 40], D: [30, 70], T: [40, 60] }) });
    expect(titles(low)).toEqual([]);
  });

  it("notices a form that is moving", () => {
    const up = player("Per", { matchHistory: [40, 42, 41, 55, 58, 56].map((p, i) => entry(i, p)) });
    expect(titles(up)).toContain("Formen er på vei opp");
    const down = player("Per", { matchHistory: [60, 58, 59, 45, 44, 46].map((p, i) => entry(i, p)) });
    expect(titles(down)).toContain("Formen har dalt litt");
  });

  it("ranks the spread in the group", () => {
    const a = player("A", {}, 25);
    const b = player("B", {}, 30);
    const c = player("C", {}, 40);
    expect(titles(a, [a, b, c])).toContain("Jevneste kaster i gruppa");
    expect(titles(c, [a, b, c])).toContain("Størst spredning i gruppa");
    expect(titles(b, [a, b, c])).toEqual([]);
  });

  it("shows at most three faults and three good things, the most useful first", () => {
    const r = player("Per", {
      steps: rows({ "20": [80, 20], "19": [70, 30], "18": [60, 40], "17": [50, 50], "14": [30, 70], D: [20, 80], T: [20, 80], BULL: [10, 50] }),
      matchHistory: [entry(0, 50, { n: 60, dx: 60 * 6, dy: -60 * 8, rn: 40, rad: 40 * 6 })],
    });
    const t = coachTips(r).tips;
    expect(t.filter((x) => x.tone === "work").length).toBeLessThanOrEqual(3);
    expect(t.filter((x) => x.tone === "good").length).toBeLessThanOrEqual(3);
    expect(t[0].tone).toBe("work");
  });
});

describe("sumBias", () => {
  it("adds the matches that kept it and skips the rest", () => {
    const r = player("Per", { matchHistory: [entry(0, 50), entry(1, 50, { n: 10, dx: 5, dy: -5, rn: 2, rad: 4 }), entry(2, 50, { n: 20, dx: 10, dy: 10, rn: 3, rad: -1 })] });
    expect(sumBias(r)).toEqual({ n: 30, dx: 15, dy: 5, rn: 5, rad: 3 });
    expect(sumBias(player("Ola"))).toBeNull();
  });
});
