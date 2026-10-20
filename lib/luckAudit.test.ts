import { describe, expect, it } from "vitest";
import { aimPointFor, luckForThrow, sectorAt } from "./dartboard";
import { emptyProgress, type Progress, type Step } from "./game";
import { parseSector } from "./scoliaMapping";

// Seeded, so the audit says the same thing every run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number): [number, number] {
  const u = Math.max(1e-12, r());
  const m = Math.sqrt(-2 * Math.log(u));
  const a = 2 * Math.PI * r();
  return [m * Math.cos(a), m * Math.sin(a)];
}

/** What the game itself pays for a landing, for the same target — the number xH is supposed to average out to. */
function paid(sector: string, step: Step, progress: Progress): number {
  const parsed = parseSector(sector, false);
  const room = Math.max(0, 3 - progress[step]);
  if (step === "BULL") return parsed.kind === "bull" ? Math.min(parsed.ring === "inner" ? 2 : 1, room) : 0;
  if (step === "D") return (parsed.kind === "number" && parsed.ring === "D") || (parsed.kind === "bull" && parsed.ring === "inner") ? Math.min(1, room) : 0;
  if (step === "T") return parsed.kind === "number" && parsed.ring === "T" ? Math.min(1, room) : 0;
  if (parsed.kind !== "number" || parsed.number !== Number(step)) return 0;
  return Math.min(parsed.ring === "T" ? 3 : parsed.ring === "D" ? 2 : 1, room);
}

const aimFor = (step: Step): [number, number] =>
  step === "BULL" ? [0, 0] : step === "D" ? aimPointFor({ ring: "D", number: 20 }) : step === "T" ? aimPointFor({ ring: "T", number: 20 }) : aimPointFor({ ring: "T", number: Number(step) });

describe("xH audit — how far from the target a dart still earns expected hits", () => {
  const radialOut = (aim: [number, number], mm: number): [number, number] => {
    const r = Math.hypot(aim[0], aim[1]) || 1;
    return aim[0] === 0 && aim[1] === 0 ? [0, mm] : [aim[0] + (aim[0] / r) * mm, aim[1] + (aim[1] / r) * mm];
  };
  const sweep = (step: Step, progress = emptyProgress()) => {
    const aim = aimFor(step);
    const rows: string[] = [];
    const out: number[] = [];
    for (let mm = 0; mm <= 14; mm += 1) {
      const v = luckForThrow(radialOut(aim, mm), step, progress)!.xg;
      out.push(v);
      rows.push(`${mm}mm:${v.toFixed(2)}`);
    }
    console.log(`xH ${step} radialt ut fra midten: ${rows.join("  ")}`);
    return out;
  };

  it.each(["20", "D", "T", "BULL"] as Step[])("%s: full verdi i midten, aldri økende utover, og null langt nok unna", (step) => {
    const v = sweep(step);
    const full = step === "20" ? 3 : step === "BULL" ? 2 : 1;
    expect(v[0]).toBeCloseTo(full, 5);
    // Ikke økende ut fra midten (en liten svingning på rutenettet tillates).
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThanOrEqual(v[i - 1] + 0.02);
    // 14 mm unna midten av et 8 mm bredt bed er langt utenfor rekkevidden (4 mm utenfor kanten).
    if (step !== "20" && step !== "BULL") expect(v[14]).toBeCloseTo(0, 5);
  });
});

describe("xH audit — D and T only collect while they are the active row", () => {
  it("a dart thrown while a number is active never files under D or T, whatever it lands in", () => {
    const r = rng(7);
    for (let i = 0; i < 4000; i++) {
      const p: [number, number] = [(r() - 0.5) * 380, (r() - 0.5) * 380];
      const active = (["20", "19", "14"] as Step[])[i % 3];
      const res = luckForThrow(p, active, emptyProgress());
      expect(res!.step).toBe(active);
    }
  });
  it("a dart on D or T collects on that row only", () => {
    const r = rng(8);
    for (let i = 0; i < 2000; i++) {
      const p: [number, number] = [(r() - 0.5) * 380, (r() - 0.5) * 380];
      expect(luckForThrow(p, "D", emptyProgress())!.step).toBe("D");
      expect(luckForThrow(p, "T", emptyProgress())!.step).toBe("T");
    }
  });
  it("a full row earns nothing", () => {
    const p = emptyProgress();
    p.D = 3;
    p.T = 3;
    p["20"] = 3;
    expect(luckForThrow(aimPointFor({ ring: "D", number: 6 }), "D", p)!.xg).toBe(0);
    expect(luckForThrow(aimPointFor({ ring: "T", number: 6 }), "T", p)!.xg).toBe(0);
    expect(luckForThrow(aimPointFor({ ring: "T", number: 20 }), "20", p)!.xg).toBe(0);
  });
  it("D counts any double and the red bull (house rule), T only a triple", () => {
    const p = emptyProgress();
    for (const n of [1, 6, 13, 20]) {
      expect(luckForThrow(aimPointFor({ ring: "D", number: n }), "D", p)!.xg).toBeCloseTo(1, 5);
      expect(luckForThrow(aimPointFor({ ring: "T", number: n }), "T", p)!.xg).toBeCloseTo(1, 5);
      expect(luckForThrow(aimPointFor({ ring: "T", number: n }), "D", p)!.xg).toBeCloseTo(0, 5);
      expect(luckForThrow(aimPointFor({ ring: "D", number: n }), "T", p)!.xg).toBeCloseTo(0, 5);
    }
    expect(luckForThrow([0, 0], "D", p)!.xg).toBeCloseTo(1, 5);
    expect(luckForThrow([0, 0], "T", p)!.xg).toBeCloseTo(0, 5);
  });
});

describe("xH audit — simulated darts: expected hits average out to what the game pays", () => {
  const N = 30000;
  for (const [label, step, room] of [
    ["tall (aim T20, åpen rad)", "20", 3],
    ["tall (aim T20, 1 igjen)", "20", 1],
    ["dobbel", "D", 3],
    ["trippel", "T", 3],
    ["bull", "BULL", 3],
  ] as [string, Step, number][]) {
    for (const sigma of [10, 15, 25, 40]) {
      it(`${label}, σ=${sigma} mm`, () => {
        const r = rng(1000 + sigma + (step === "20" ? 0 : step.length * 7));
        const progress = emptyProgress();
        progress[step] = 3 - room;
        const aim = aimFor(step);
        let xh = 0;
        let actual = 0;
        for (let i = 0; i < N; i++) {
          const [gx, gy] = gauss(r);
          const p: [number, number] = [aim[0] + gx * sigma, aim[1] + gy * sigma];
          xh += luckForThrow(p, step, progress)!.xg;
          actual += paid(sectorAt(p), step, progress);
        }
        const ratio = actual > 0 ? xh / actual : 1;
        console.log(`xH ${label} σ=${sigma}: forventet ${(xh / N).toFixed(3)} / faktisk ${(actual / N).toFixed(3)} per pil (forhold ${ratio.toFixed(3)})`);
        // Over mange piler skal de to ligge nær hverandre. 6 % er romslig nok til å tåle utjevningen, og stramt nok til å fange en skjevhet.
        expect(Math.abs(ratio - 1)).toBeLessThan(0.06);
      }, 60_000);
    }
  }
});
