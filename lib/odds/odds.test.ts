import { beforeAll, describe, expect, it } from "vitest";
import { emptyRecord } from "../playerRows";
import { emptyProgress, type Progress } from "../game";
import { progressToBotState, sigmaForLevel, solverFor } from "../botStrategy";
import { setGameVariant } from "../rules";
import { finishCdf, stateOf } from "./forward";
import { computeOdds, type OddsSide } from "./index";
import { modelFor } from "./model";
import { formatOdds, priceOutcomes } from "./price";
import { DEFAULT_PRIOR, addEvidence, knownSkill, learnPrior, skillNodes, weighEvidence } from "./skill";
import { profilesFor } from "./throwModel";
import { raceWinProbs } from "./winProb";

const RULES = { target: 3, ringChoice: true };
const fresh = (): Progress => emptyProgress();
const side = (name: string, med: number, progress: Progress = fresh()): OddsSide => ({ name, progress, members: [{ name, skill: knownSkill(med * Math.sqrt(2 / Math.PI)) }], nextMember: 0 });

/** A small deterministic random source, so a simulation test gives the same answer every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeAll(() => setGameVariant("standard"));

describe("throw model", () => {
  it("is the same every time and the outcomes add up to one", () => {
    const a = profilesFor(24);
    const b = profilesFor(24.1); // rounds to the same quarter millimetre
    expect(b).toBe(a);
    const sum = (o: typeof a.S) => Object.values(o).reduce((x, y) => x + y, 0);
    for (const p of [a.S, a.D, a.T, a.BULL]) expect(sum(p)).toBeCloseTo(1, 6);
  });

  it("a sharper thrower hits the triple more often", () => {
    expect(profilesFor(10).T.sameT).toBeGreaterThan(profilesFor(30).T.sameT);
  });
});

describe("model", () => {
  it("needs the same number of darts as the bot's own solver (within 4 %)", () => {
    const sigma = sigmaForLevel("3");
    const mine = modelFor(RULES, sigma);
    const start = stateOf(mine, fresh());
    const theirs = solverFor("3").expectedRemaining(progressToBotState(fresh()));
    expect(Math.abs(mine.expected[start] - theirs) / theirs).toBeLessThan(0.04);
  }, 60_000);

  it("a sharper thrower needs fewer turns", () => {
    const cdf = (med: number) => {
      const m = modelFor(RULES, med * Math.sqrt(2 / Math.PI));
      return finishCdf({ start: stateOf(m, fresh()), models: [m] });
    };
    // After 20 turns, the sharper one has finished more often.
    expect(cdf(22)[20]).toBeGreaterThan(cdf(34)[20]);
  });
});

describe("the race", () => {
  it("gives the one who throws first a small edge between equals, and adds up to one", () => {
    const [a, b] = computeOdds({ rules: RULES, sides: [side("A", 30), side("B", 30)] });
    expect(a.p + b.p).toBeCloseTo(1, 6);
    expect(a.p).toBeGreaterThan(0.5);
    expect(a.p).toBeLessThan(0.58);
  });

  it("adds up to one with three sides, and the sharpest is favourite", () => {
    const out = computeOdds({ rules: RULES, sides: [side("A", 34), side("B", 22), side("C", 30)] });
    expect(out.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 6);
    expect(out[1].p).toBeGreaterThan(out[0].p);
    expect(out[1].p).toBeGreaterThan(out[2].p);
  });

  it("a closed row never hurts: more crosses means a better chance", () => {
    const ahead = fresh();
    ahead["20"] = 3;
    ahead["19"] = 3;
    const base = computeOdds({ rules: RULES, sides: [side("A", 30), side("B", 30)] })[0].p;
    const better = computeOdds({ rules: RULES, sides: [side("A", 30, ahead), side("B", 30)] })[0].p;
    expect(better).toBeGreaterThan(base + 0.05);
  });

  it("matches a plain simulation of the same race (within 2.5 points over 3 000 matches)", () => {
    const mA = modelFor(RULES, 22 * Math.sqrt(2 / Math.PI));
    const mB = modelFor(RULES, 28 * Math.sqrt(2 / Math.PI));
    const exact = raceWinProbs([finishCdf({ start: stateOf(mA, fresh()), models: [mA] }), finishCdf({ start: stateOf(mB, fresh()), models: [mB] })])[0];
    const rand = rng(12345);
    const dart = (m: typeof mA, s: number) => {
      const { next, prob } = m.step(s);
      let u = rand();
      for (let i = 0; i < next.length; i++) {
        u -= prob[i];
        if (u <= 0) return next[i];
      }
      return next[next.length - 1];
    };
    let wins = 0;
    const N = 3000;
    for (let g = 0; g < N; g++) {
      let a = stateOf(mA, fresh());
      let b = stateOf(mB, fresh());
      for (;;) {
        for (let k = 0; k < 3; k++) a = dart(mA, a);
        if (a === mA.terminal) {
          wins++;
          break;
        }
        for (let k = 0; k < 3; k++) b = dart(mB, b);
        if (b === mB.terminal) break;
      }
    }
    expect(Math.abs(wins / N - exact)).toBeLessThan(0.025);
  });
});

describe("what is known about a thrower", () => {
  it("starts as the population and narrows with darts", () => {
    const spread = (nodes: { sigma: number }[]) => Math.max(...nodes.map((n) => n.sigma)) - Math.min(...nodes.map((n) => n.sigma));
    const none = skillNodes(null);
    const lots = skillNodes({ n: 400, meanR: 40 });
    const mean = (nodes: { sigma: number }[]) => nodes.reduce((s, n) => s + n.sigma, 0) / nodes.length;
    expect(mean(none) / Math.sqrt(2 / Math.PI)).toBeGreaterThan(26);
    expect(mean(none) / Math.sqrt(2 / Math.PI)).toBeLessThan(36);
    expect(mean(lots) / Math.sqrt(2 / Math.PI)).toBeGreaterThan(37);
    expect(mean(lots) / Math.sqrt(2 / Math.PI)).toBeLessThan(43);
    expect(spread(lots)).toBeLessThan(spread(none) / 3);
  });

  it("a few darts move the picture only a little", () => {
    const few = skillNodes({ n: 6, meanR: 50 });
    const m = few.reduce((s, n) => s + n.sigma, 0) / few.length / Math.sqrt(2 / Math.PI);
    expect(m).toBeGreaterThan(30);
    expect(m).toBeLessThan(42);
  });

  it("learns the group's own level from the players who have been measured", () => {
    expect(learnPrior([{ n: 500, meanR: 30 }])).toEqual(DEFAULT_PRIOR); // too few to say
    const group = [24, 26, 25, 27, 23].map((m) => ({ n: 400, meanR: m }));
    const p = learnPrior(group);
    expect(p.med).toBeLessThan(29);
    expect(p.med).toBeGreaterThan(24);
    expect(p.sdLog).toBeGreaterThanOrEqual(0.12);
    expect(p.sdLog).toBeLessThan(0.22);
  });

  it("weighs recent matches more and combines two sources", () => {
    const e = weighEvidence([{ n: 30, meanR: 50 }, { n: 30, meanR: 50 }, { n: 30, meanR: 20 }], 1)!;
    expect(e.meanR).toBeLessThan(35); // dominated by the newest
    const both = addEvidence({ n: 10, meanR: 20 }, { n: 30, meanR: 40 })!;
    expect(both.n).toBe(40);
    expect(both.meanR).toBeCloseTo(35, 6);
  });

  it("an unknown player against a sharp one is priced closer to even than the plain averages say", () => {
    const sharp = { name: "Sharp", skill: skillNodes({ n: 400, meanR: 22 }) };
    const unknown = { name: "Ny", skill: skillNodes(null) };
    const plugin = { name: "Ny", skill: knownSkill(30 * Math.sqrt(2 / Math.PI)) };
    const mk = (m: typeof sharp): OddsSide[] => [{ name: "Sharp", progress: fresh(), members: [sharp], nextMember: 0 }, { name: "Ny", progress: fresh(), members: [m], nextMember: 0 }];
    const withUncertainty = computeOdds({ rules: RULES, sides: mk(unknown) })[0];
    const atTheGuess = computeOdds({ rules: RULES, sides: mk(plugin) })[0];
    expect(withUncertainty.p).toBeGreaterThan(0.5);
    expect(withUncertainty.p).toBeLessThan(atTheGuess.p);
    expect(withUncertainty.hi - withUncertainty.lo).toBeGreaterThan(0.05); // and it says how unsure it is
  });

  it("a team is a mix of its members", () => {
    const strong = { name: "S", skill: knownSkill(18) };
    const weak = { name: "W", skill: knownSkill(34) };
    const solo = (m: typeof strong): OddsSide => ({ name: m.name, progress: fresh(), members: [m], nextMember: 0 });
    const team: OddsSide = { name: "Lag", progress: fresh(), members: [strong, weak], nextMember: 0 };
    const vsStrong = computeOdds({ rules: RULES, sides: [team, solo(strong)] })[0].p;
    const vsWeak = computeOdds({ rules: RULES, sides: [team, solo(weak)] })[0].p;
    expect(vsStrong).toBeLessThan(0.5);
    expect(vsWeak).toBeGreaterThan(0.5);
  });
});

describe("price", () => {
  it("shortens the odds so that the prices add up to more than one, and rounds them", () => {
    const out = priceOutcomes([0.6, 0.4]);
    const implied = out.reduce((s, o) => s + 1 / o.odds, 0);
    expect(implied).toBeGreaterThan(1.03);
    expect(implied).toBeLessThan(1.08);
    expect(out[0].odds).toBeLessThan(1 / 0.6);
    // A heavy favourite stays above the stake: 92 % is not priced below 1,01.
    const fav = priceOutcomes([0.92, 0.08], [0.3, 0.3]);
    expect(fav[0].odds).toBeGreaterThan(1.03);
    expect(fav[1].odds).toBeLessThan(1 / 0.08);
    expect(Number.isInteger(out[0].odds * 100)).toBe(true);
  });

  it("is a little wider when the probabilities are unsure, never below 1,01, and writes a comma", () => {
    const sure = priceOutcomes([0.6, 0.4], [0.01, 0.01]);
    const unsure = priceOutcomes([0.6, 0.4], [0.3, 0.3]);
    expect(unsure[0].odds).toBeLessThan(sure[0].odds);
    expect(priceOutcomes([0.9999, 0.0001])[0].odds).toBeGreaterThanOrEqual(1.01);
    expect(formatOdds(2.1)).toBe("2,10");
  });
});

describe("from records to odds", () => {
  const entry = (date: string, med: number, throws: number, won = true) => ({ date, won, dartsUsed: throws, hitPct: 50, med, mhd: med, mvd: med, throws });
  const rec = (name: string, over: object = {}) => ({ ...emptyRecord(name), ...over });

  it("reads a player's skill from their own matches and from the matches they threw in for a team", async () => {
    const { evidenceFor } = await import("./match");
    const per = rec("Per", { matchHistory: [entry("2026-10-01", 30, 50)] });
    const team = rec("Per & Ola", { kind: "team", members: ["Per", "Ola"], matchHistory: [{ ...entry("2026-10-10", 0, 0), byMember: { Per: { throws: 40, sumR: 40 * 20, sumR2: 0 }, Ola: { throws: 40, sumR: 40 * 40, sumR2: 0 } } }] });
    const e = evidenceFor("Per", [per, team])!;
    expect(e.n).toBeGreaterThan(60);
    expect(e.meanR).toBeLessThan(30); // the newer, sharper team match weighs most
    expect(evidenceFor("Ola", [per, team])!.meanR).toBeCloseTo(40, 6);
    expect(evidenceFor("Ukjent", [per, team])).toBeNull();
  });

  it("builds sides in throwing order, a bot as known and a new player as unknown", async () => {
    const { buildOddsInput } = await import("./match");
    const p = emptyProgress();
    const input = buildOddsInput({
      rules: RULES,
      players: ["A", "B"],
      currentIdx: 1,
      progress: { A: p, B: p },
      teamRosters: {},
      teamMemberIdx: {},
      botLevels: { A: "1" },
      roster: [],
      live: {},
    });
    expect(input.sides.map((s) => s.name)).toEqual(["B", "A"]);
    const [b, a] = input.sides;
    const spread = (s: { skill: { sigma: number }[] }) => Math.max(...s.skill.map((x) => x.sigma)) - Math.min(...s.skill.map((x) => x.sigma));
    expect(spread(a.members[0])).toBe(0);
    expect(spread(b.members[0])).toBeGreaterThan(1);
    // A level-1 bot is a clear favourite over someone nobody knows anything about.
    expect(computeOdds(input)[1].p).toBeGreaterThan(0.6);
  });

  it("today's darts move the odds: a thrower who is off tonight is priced lower", async () => {
    const { buildOddsInput } = await import("./match");
    const p = emptyProgress();
    const base = { rules: RULES, players: ["A", "B"], currentIdx: 0, progress: { A: p, B: p }, teamRosters: {}, teamMemberIdx: {}, botLevels: {}, roster: [rec("A", { matchHistory: [entry("2026-10-01", 24, 200)] }), rec("B", { matchHistory: [entry("2026-10-01", 24, 200)] })] };
    const even = computeOdds(buildOddsInput({ ...base, live: {} }))[0].p;
    const off = computeOdds(buildOddsInput({ ...base, live: { A: { throws: 60, distance: 60 * 45 } } }))[0].p;
    expect(off).toBeLessThan(even - 0.05);
  });
});

describe("without Scolia: from how often the darts counted", () => {
  const hitMatch = (date: string, hitPct: number, darts = 60) => ({ date, won: true, dartsUsed: darts, hitPct, med: null, mhd: null, mvd: null });
  const scoliaMatch = (date: string, med: number, throws: number) => ({ date, won: true, dartsUsed: throws, hitPct: 50, med, mhd: med, mvd: med, throws });
  const rec = (name: string, over: object = {}) => ({ ...emptyRecord(name), ...over });

  it("turns a cross rate into a distance: the more crosses, the sharper", async () => {
    const { medFromCrossRate } = await import("./hitRate");
    const a = medFromCrossRate(0.7, RULES);
    const b = medFromCrossRate(0.5, RULES);
    const c = medFromCrossRate(0.3, RULES);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(b).toBeGreaterThan(20);
    expect(b).toBeLessThan(32); // about half the darts counting is a decent club thrower, near the 30 mm default
    expect(medFromCrossRate(5, RULES)).toBeCloseTo(14, 6); // clamped to the table, not extrapolated
    expect(medFromCrossRate(0, RULES)).toBeCloseTo(70, 6);
  });

  it("uses matches without a measured distance only when asked to", async () => {
    const { evidenceFor } = await import("./match");
    const per = rec("Per", { matchHistory: [hitMatch("2026-10-01", 65), hitMatch("2026-10-05", 65)] });
    expect(evidenceFor("Per", [per])).toBeNull();
    const e = evidenceFor("Per", [per], RULES)!;
    expect(e.n).toBeGreaterThan(0);
    expect(e.n).toBeLessThan(20); // 120 darts count as a handful of measured ones
    expect(e.meanR).toBeLessThan(25); // 65 % is sharper than average
  });

  it("measured darts outweigh the rest", async () => {
    const { evidenceFor } = await import("./match");
    const only = rec("Per", { matchHistory: [scoliaMatch("2026-10-01", 40, 60)] });
    const both = rec("Per", { matchHistory: [scoliaMatch("2026-10-01", 40, 60), hitMatch("2026-10-02", 70, 60)] });
    const a = evidenceFor("Per", [only], RULES)!;
    const b = evidenceFor("Per", [both], RULES)!;
    expect(b.meanR).toBeLessThan(a.meanR); // the sharp hit rate does pull
    expect(a.meanR - b.meanR).toBeLessThan(3); // but 60 hit-rate darts are worth only a few measured ones
  });

  it("reads a team member's own cross rate from the team record", async () => {
    const { evidenceFor } = await import("./match");
    const steps = emptyRecord("x").steps;
    const team = rec("Per & Ola", { kind: "team", members: ["Per", "Ola"], memberStats: { Per: { matches: 2, turns: 30, darts: 90, hits: 54, misses: 36, steps, bestRun: 3, throws: 0, sumR: 0 } } });
    const e = evidenceFor("Per", [team], RULES)!;
    expect(e.n).toBeCloseTo(90 * 0.08, 6);
    expect(e.meanR).toBeLessThan(30); // 0,6 crosses a dart
    expect(evidenceFor("Ola", [team], RULES)).toBeNull();
  });
});

describe("the seeding of the regulars", () => {
  const rec = (name: string, over: object = {}) => ({ ...emptyRecord(name), ...over });
  const winChance = async (a: string, b: string, roster: ReturnType<typeof rec>[] = []) => {
    const { buildOddsInput } = await import("./match");
    const p = emptyProgress();
    const one = (currentIdx: number) => computeOdds(buildOddsInput({ rules: RULES, players: [a, b], currentIdx, progress: { [a]: p, [b]: p }, teamRosters: {}, teamMemberIdx: {}, botLevels: {}, roster, live: {} }));
    // The odds of whoever is named first, averaged over who throws first.
    return (one(0)[0].p + one(1)[1].p) / 2;
  };

  it("reproduces the chances the group gave, to within a few points", async () => {
    const wanted: [string, string, number][] = [["Vadla", "Monge", 0.6], ["Monge", "Moen", 0.5], ["Monge", "Lars", 0.5], ["Moen", "Hans", 0.65], ["Hans", "Vegard", 0.8], ["Vegard", "Sondre", 0.75]];
    for (const [a, b, p] of wanted) expect(Math.abs((await winChance(a, b)) - p)).toBeLessThan(0.04);
  });

  it("knows nothing of someone outside the seeding, and is not case-sensitive about a name", async () => {
    expect(Math.abs((await winChance("Ukjent", "Annen")) - 0.5)).toBeLessThan(0.02);
    expect(await winChance("vadla", "SONDRE")).toBeGreaterThan(0.9);
  });

  it("fades as darts come in: measured darts take over from the seeding", async () => {
    // Sondre is seeded as the weakest, but 400 measured darts say he throws sharper than Vadla.
    const sharp = { matchHistory: [{ date: "2026-10-01", won: true, dartsUsed: 400, hitPct: 50, med: 22, mhd: 22, mvd: 22, throws: 400 }] };
    const sluggish = { matchHistory: [{ date: "2026-10-01", won: false, dartsUsed: 400, hitPct: 50, med: 40, mhd: 40, mvd: 40, throws: 400 }] };
    const seeded = await winChance("Sondre", "Vadla");
    const measured = await winChance("Sondre", "Vadla", [rec("Sondre", sharp), rec("Vadla", sluggish)]);
    expect(seeded).toBeLessThan(0.1);
    expect(measured).toBeGreaterThan(0.75);
  });

  it("lasts longer on the weaker evidence of the cross rate", async () => {
    // Four matches without Scolia at 60 % (240 darts, worth about 19 measured ones) move the picture, but not all the way.
    const h = (d: string) => ({ date: d, won: true, dartsUsed: 60, hitPct: 60, med: null, mhd: null, mvd: null });
    const some = await winChance("Sondre", "Vegard", [rec("Sondre", { matchHistory: [h("1"), h("2"), h("3"), h("4")] })]);
    const seeded = await winChance("Sondre", "Vegard");
    expect(some).toBeGreaterThan(seeded + 0.03);
    expect(some).toBeLessThan(0.5); // still the weaker on paper: the seeding has not been thrown out
  });
});

describe("the margin of victory", () => {
  it("adds up to the chance of winning, and a stronger side wins by more", () => {
    const o = computeOdds({ rules: RULES, sides: [side("A", 26), side("B", 34)] });
    for (const s of o) {
      expect(s.margin).toBeDefined();
      const total = s.margin!.reduce((a, b) => a + b, 0);
      expect(Math.abs(total - s.p)).toBeLessThan(0.02);
      expect(s.margin![0]).toBe(0);
    }
    const big = (m: number[]) => m.slice(8).reduce((a, b) => a + b, 0) / m.reduce((a, b) => a + b, 0);
    expect(big(o[0].margin!)).toBeGreaterThan(big(o[1].margin!));
  });

  it("only for two sides", () => {
    expect(computeOdds({ rules: RULES, sides: [side("A", 30), side("B", 30), side("C", 30)] })[0].margin).toBeUndefined();
  });

  it("agrees with playing the match out", () => {
    const sigma = 30 * Math.sqrt(2 / Math.PI);
    const model = modelFor(RULES, sigma);
    const rng2 = rng(7);
    const total = 6000;
    const hist = [new Array(31).fill(0), new Array(31).fill(0)];
    const left = (s: number) => {
      // Crosses still to get, read from the state the way the engine does.
      for (let ni = 0; ni <= 7; ni++) for (let nc = 0; nc < (ni < 7 ? 3 : 1); nc++) for (let d = 0; d <= 3; d++) for (let t = 0; t <= 3; t++) for (let b = 0; b <= 3; b++) if (model.encode(ni, nc, d, t, b) === s) return (ni < 7 ? (7 - ni) * 3 - nc : 0) + (3 - d) + (3 - t) + (3 - b);
      return 0;
    };
    const leftCache = new Map<number, number>();
    const leftOf = (s: number) => { let v = leftCache.get(s); if (v === undefined) { v = left(s); leftCache.set(s, v); } return v; };
    const play = (s: number) => {
      for (let k = 0; k < 3; k++) {
        if (s === model.terminal) return s;
        const { next, prob } = model.step(s);
        let r = rng2(), i = 0;
        while (i < next.length - 1 && r > prob[i]) { r -= prob[i]; i++; }
        s = next[i];
      }
      return s;
    };
    for (let n = 0; n < total; n++) {
      const st = [0, 0];
      for (let turn = 0; turn < 400; turn++) {
        const who = turn % 2;
        st[who] = play(st[who]);
        if (st[who] === model.terminal) { hist[who][leftOf(st[1 - who])]++; break; }
      }
    }
    const engine = computeOdds({ rules: RULES, sides: [side("A", 30), side("B", 30)] });
    const bucket = (m: number[], lo: number, hi: number) => m.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
    for (const [lo, hi] of [[1, 3], [4, 8], [9, 30]]) {
      const simA = bucket(hist[0], lo, hi) / total;
      expect(Math.abs(simA - bucket(engine[0].margin!, lo, hi)), `A ${lo}-${hi}`).toBeLessThan(0.03);
    }
  });
});
