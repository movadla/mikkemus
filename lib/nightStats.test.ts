import { describe, expect, it } from "vitest";
import type { Fig } from "./nightFigures";
import type { NightMatch } from "./nightScore";
import { compare, hitPctOf, playerNight, statsOf } from "./nightStats";

const fig = (over: Partial<Fig>): Fig => ({ darts: 0, points: 0, rounds: 0, best: 0, tons: 0, s180: 0, burned: 0, lostLives: 0, kills: 0, finish: 0, ...over });
const solo = (name: string) => ({ name, members: [name] });
const team = (a: string, b: string) => ({ name: `${a}/${b}`, members: [a, b] });
let n = 0;
const match = (over: Partial<NightMatch>): NightMatch => ({ id: `m${n}`, evening: "e", at: `2026-10-30T20:${String(10 + n++).padStart(2, "0")}:00.000Z`, game: "301", sides: [solo("A"), solo("B")], placements: ["A", "B"], ...over });

describe("kveldens statistikk", () => {
  const ms = [
    match({ figures: { A: fig({ points: 300, rounds: 6, best: 140, tons: 2, s180: 1, finish: 40 }), B: fig({ points: 200, rounds: 6, best: 100, tons: 1 }) } }),
    match({ figures: { A: fig({ points: 100, rounds: 3, best: 60 }), B: fig({ points: 301, rounds: 5, best: 121, tons: 2, finish: 96 }) }, placements: ["B", "A"] }),
    match({ game: "lava", figures: { A: fig({ burned: 5 }), B: fig({ burned: 3 }) } }),
    match({ id: "mm", game: "enkeltkamp", placements: ["B", "A"], source: { kind: "match", id: "mm1" } }),
  ];
  const hits = { mm1: { A: 41, B: 35 } };

  it("finner den beste i hver øvelse og totalt", () => {
    const s = statsOf(ms, hits);
    const by = (k: string) => s.awards.find((a) => a.key === k);
    expect(by("total")?.who).toBe("A");
    expect(by("round")).toMatchObject({ who: "A", value: "140" });
    expect(by("finish")).toMatchObject({ who: "B", value: "96" });
    expect(by("s180")?.who).toBe("A");
    expect(by("lava")).toMatchObject({ who: "A", value: "5" });
    expect(by("hit")).toMatchObject({ who: "A", value: "41 %" });
    // 400 points in 9 rounds against 501 in 11.
    expect(by("avg")?.who).toBe("B");
  });

  it("gir ingen pris ved likt", () => {
    const tie = [match({ figures: { A: fig({ s180: 1 }), B: fig({ s180: 1 }) } })];
    expect(statsOf(tie).awards.find((a) => a.key === "s180")).toBeUndefined();
  });

  it("regner poengene gjennom kvelden i den rekkefølgen kampene ble spilt", () => {
    const s = statsOf(ms, hits);
    expect(s.progress.steps.map((x) => x.points.A)).toEqual([1, 1, 2, 2]);
    expect(s.progress.steps.map((x) => x.points.B)).toEqual([0, 1, 1, 2]);
  });

  it("tar ikke med slettede kamper", () => {
    const s = statsOf([...ms, match({ placements: ["B", "A"], deleted: true, figures: { B: fig({ s180: 9 }) } })], hits);
    expect(s.awards.find((a) => a.key === "s180")?.who).toBe("A");
    expect(s.results.find((r) => r.name === "A")?.wins).toBe(2);
  });

  it("treffprosent for en spiller teller bare kamper de spilte alene, lag har sin egen", () => {
    const t = match({ id: "t1", game: "enkeltkamp", sides: [team("A", "C"), team("B", "D")], placements: ["A/C", "B/D"], source: { kind: "match", id: "mt" } });
    const h = { mt: { "A/C": 50, "B/D": 30 } };
    expect(hitPctOf([t], h, { kind: "player", name: "A" })).toBeNull();
    expect(hitPctOf([t], h, { kind: "team", name: "A/C" })).toBe(50);
  });

  it("sammenligner to spillere og hvem som har slått hvem", () => {
    const c = compare(ms, hits, { kind: "player", name: "A" }, { kind: "player", name: "B" });
    expect(c.duels).toEqual({ a: 2, b: 2 });
    expect(c.a.best).toBe(140);
    expect(c.b.finish).toBe(96);
    expect(c.a.points).toBe(2);
  });

  it("gir en spillers kveld: makker, mest slått og tall per spill", () => {
    const t = [
      match({ sides: [team("A", "C"), solo("B")], placements: ["A/C", "B"] }),
      match({ sides: [team("A", "C"), solo("B")], placements: ["A/C", "B"] }),
    ];
    const p = playerNight(t, {}, "A");
    expect(p.bestMate).toEqual({ name: "C", won: 2, lost: 0 });
    expect(p.mostBeaten).toEqual({ name: "B", won: 2, lost: 0 });
    expect(p.games).toEqual([{ game: "301", name: "301", wins: 2, losses: 0 }]);
    expect(p.progress.map((x) => x.points)).toEqual([1, 2]);
  });
});
