import { describe, expect, it } from "vitest";
import { countOf, eveningOf, lineOf, placementsFor, pointsOf, resultOf, tableOf, type NightMatch } from "./nightScore";

const solo = (name: string) => ({ name, members: [name] });
const team = (a: string, b: string) => ({ name: `${a} og ${b}`, members: [a, b] });
let n = 0;
const match = (over: Partial<NightMatch>): NightMatch => ({ id: `m${n++}`, evening: "e1", at: `2026-10-29T20:${String(10 + n).padStart(2, "0")}:00.000Z`, game: "enkeltkamp", sides: [solo("A"), solo("B")], placements: ["A", "B"], ...over });

describe("kveldsscore", () => {
  it("gives one point to the winner of a match between two", () => {
    expect(pointsOf(match({}))).toEqual({ A: 1, B: 0 });
  });
  it("gives both players of a winning team a point each", () => {
    const m = match({ sides: [team("Vadla", "Monge"), team("Hans", "Erlend")], placements: ["Vadla og Monge", "Hans og Erlend"] });
    expect(pointsOf(m)).toEqual({ Vadla: 1, Monge: 1, Hans: 0, Erlend: 0 });
  });
  it("gives 3, 2 and 1 points by place when there are three or more sides", () => {
    const m = match({ sides: [solo("A"), solo("B"), solo("C"), solo("D")], placements: ["C", "A", "D", "B"] });
    expect(pointsOf(m)).toEqual({ A: 2, B: 0, C: 3, D: 1 });
  });
  it("gives nothing for a draw, and nothing for a match taken out of the evening", () => {
    expect(pointsOf(match({ override: { draw: true } }))).toEqual({ A: 0, B: 0 });
    expect(pointsOf(match({ deleted: true }))).toEqual({ A: 0, B: 0 });
  });
  it("uses the override instead of the result, and keeps the original", () => {
    const m = match({ override: { placements: ["B", "A"] } });
    expect(pointsOf(m)).toEqual({ A: 0, B: 1 });
    expect(m.placements).toEqual(["A", "B"]);
    expect(resultOf(m)).toEqual(["B", "A"]);
    expect(resultOf(match({ override: { draw: true } }))).toBeNull();
  });
  it("makes a table: the most points first, then wins, then the fewest matches, and leaves out what was taken out", () => {
    const rows = tableOf([
      match({}),
      match({ sides: [solo("A"), solo("C")], placements: ["A", "C"] }),
      match({ sides: [solo("B"), solo("C")], placements: ["B", "C"] }),
      match({ sides: [solo("A"), solo("B")], placements: ["B", "A"], deleted: true }),
    ]);
    // A has two wins, B one, and C none; the deleted match counts for nobody.
    expect(rows.map((r) => [r.name, r.points, r.matches, r.wins])).toEqual([
      ["A", 2, 2, 2],
      ["B", 1, 2, 1],
      ["C", 0, 2, 0],
    ]);
    expect(rows.find((r) => r.name === "C")).toMatchObject({ losses: 2 });
  });
  it("writes a line like «Vadla/Monge vs. Hans/Erlend: 1-0», the same whoever won, and a draw as 0-0", () => {
    const m = match({ sides: [team("Vadla", "Monge"), team("Hans", "Erlend")], placements: ["Vadla og Monge", "Hans og Erlend"] });
    expect(lineOf(m)).toEqual({ title: "Vadla/Monge vs. Hans/Erlend", score: "1-0" });
    expect(lineOf({ ...m, placements: ["Hans og Erlend", "Vadla og Monge"] }).score).toBe("0-1");
    expect(lineOf({ ...m, override: { draw: true } })).toEqual({ title: "Vadla/Monge vs. Hans/Erlend", score: "0-0", tag: "Uavgjort" });
    expect(lineOf(match({ sides: [solo("Hans"), solo("Monge"), solo("Erlend")], placements: ["Hans", "Monge", "Erlend"] }))).toEqual({ title: "Hans, Monge, Erlend", score: "", tag: "Vinner Hans" });
  });
  it("puts the winner first when it is written in by hand", () => {
    expect(placementsFor({ sides: [solo("A"), solo("B"), solo("C")] }, "B")).toEqual(["B", "A", "C"]);
  });
  it("finds the evening a moment belongs to, and counts the matches that count", () => {
    const evenings = [{ id: "e1", startedAt: "2026-10-28T19:00:00.000Z" }, { id: "e2", startedAt: "2026-10-29T19:00:00.000Z" }];
    expect(eveningOf(evenings, "2026-10-29T21:00:00.000Z")?.id).toBe("e2");
    expect(eveningOf(evenings, "2026-10-28T20:00:00.000Z")?.id).toBe("e1");
    expect(eveningOf([], "2026-10-28T20:00:00.000Z")).toBeNull();
    expect(countOf([match({}), match({ deleted: true })])).toBe(1);
  });
});
