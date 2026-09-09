import { describe, expect, it } from "vitest";
import { emptyProgress, isFinished, type Progress, type Step } from "./game";
import { BOT_LEVELS, type BotLevel } from "./botLevels";
import { DOUBLE_OUTER_RADIUS, sectorAt } from "./dartboard";
import { botChooseThrow, gaussianSample, progressToBotState, sigmaForLevel, solverFor } from "./botStrategy";

function board(overrides: Partial<Record<Step, number>>): Progress {
  return { ...emptyProgress(), ...overrides };
}

const LEVELS = Object.keys(BOT_LEVELS) as BotLevel[];

describe("progressToBotState", () => {
  it("points at the first unfinished number and its crosses", () => {
    expect(progressToBotState(board({ "20": 3, "19": 1 }))).toMatchObject({ numberIndex: 1, numberCross: 1 });
  });

  it("runs past every closed number", () => {
    const all = board({ "20": 3, "19": 3, "18": 3, "17": 3, "16": 3, "15": 3, "14": 3 });
    expect(progressToBotState(all).numberIndex).toBe(7);
  });

  it("carries D, T and BULL across unchanged — they are not part of the number run", () => {
    expect(progressToBotState(board({ D: 1, T: 2, BULL: 3 }))).toMatchObject({ dCross: 1, tCross: 2, bullCross: 3 });
  });
});

// Level 1 is the STRONGEST bot, not the weakest: the levels are named after players, and
// Littler at level 1 has the tightest grouping (20mm) while "Nivå 6" is the loosest (55mm).
describe("sigmaForLevel", () => {
  it("loosens as the level number goes up — level 1 is the tightest", () => {
    const sigmas = LEVELS.map(sigmaForLevel);
    for (let i = 1; i < sigmas.length; i++) expect(sigmas[i]).toBeGreaterThan(sigmas[i - 1]);
  });

  it("is a positive spread for every level", () => {
    LEVELS.forEach((l) => expect(sigmaForLevel(l)).toBeGreaterThan(0));
  });
});

describe("gaussianSample", () => {
  it("centres on zero and matches the spread it was asked for", () => {
    const n = 20000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = gaussianSample(25);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(1.5);
    expect(sd).toBeGreaterThan(23);
    expect(sd).toBeLessThan(27);
  });

  it("returns a real number, never NaN", () => {
    for (let i = 0; i < 500; i++) expect(Number.isFinite(gaussianSample(30))).toBe(true);
  });
});

describe("solverFor", () => {
  it("says a finished board needs no more darts", () => {
    const done = board({ "20": 3, "19": 3, "18": 3, "17": 3, "16": 3, "15": 3, "14": 3, D: 3, T: 3, BULL: 3 });
    expect(isFinished(done)).toBe(true);
    expect(solverFor("3").expectedRemaining(progressToBotState(done))).toBe(0);
  }, 30000);

  it("expects fewer darts from a better bot", () => {
    const state = progressToBotState(emptyProgress());
    expect(solverFor("1").expectedRemaining(state)).toBeLessThan(solverFor("6").expectedRemaining(state));
  }, 30000);

  it("expects fewer darts the closer the board is to done", () => {
    const solver = solverFor("3");
    const early = solver.expectedRemaining(progressToBotState(emptyProgress()));
    const late = solver.expectedRemaining(progressToBotState(board({ "20": 3, "19": 3, "18": 3, "17": 3, "16": 3, "15": 3, "14": 3, D: 3, T: 3, BULL: 2 })));
    expect(late).toBeLessThan(early);
  }, 30000);

  it("picks an action every level can act on, from a fresh board", () => {
    LEVELS.forEach((l) => expect(solverFor(l).bestAction(progressToBotState(emptyProgress()))).toBeTruthy());
  }, 60000);
});

describe("botChooseThrow", () => {
  const players = { A: emptyProgress() };

  it("returns a finite coordinate pair", () => {
    for (let i = 0; i < 200; i++) {
      const [x, y] = botChooseThrow("3", players, "A", { A: "3" });
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  // Off-board throws are real, not a fault — they are why a shot box sometimes reads BOM.
  //
  // Deliberately compared rather than pinned to a number. The absolute rate swings between
  // runs because the solver is itself Monte Carlo: aiming at the bull puts nearly everything
  // on the board, aiming at a triple near the rim does not, and which it picks can differ.
  // A fixed threshold made this flaky. The ordering is the part that must hold.
  it("almost never misses the board at the tightest level", () => {
    expect(share("1")).toBeGreaterThan(0.95);
  });

  it("misses the board more often the looser the level", () => {
    expect(share("6")).toBeLessThan(share("1"));
  });

  function share(level: BotLevel): number {
    const n = 3000;
    let onBoard = 0;
    for (let i = 0; i < n; i++) {
      const p = botChooseThrow(level, players, "A", { A: level });
      if (Math.hypot(p[0], p[1]) <= DOUBLE_OUTER_RADIUS) onBoard++;
    }
    return onBoard / n;
  }

  it("produces a sector string the scoring layer can parse", () => {
    for (let i = 0; i < 300; i++) {
      const sector = sectorAt(botChooseThrow("4", players, "A", { A: "4" }));
      expect(sector).toMatch(/^(None|Bull|25|[SDT]\d{1,2})$/);
    }
  });

  it("aims tighter when it is better — level 1 groups closer than level 6", () => {
    const spread = (level: BotLevel) => {
      const pts = Array.from({ length: 1500 }, () => botChooseThrow(level, players, "A", { A: level }));
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      return Math.sqrt(pts.reduce((s, p) => s + (p[0] - mx) ** 2 + (p[1] - my) ** 2, 0) / pts.length);
    };
    expect(spread("1")).toBeLessThan(spread("6"));
  }, 30000);
});
