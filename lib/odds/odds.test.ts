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
