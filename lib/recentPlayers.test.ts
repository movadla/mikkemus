import { describe, expect, it } from "vitest";
import { filterNames, sortByRecent } from "./recentPlayers";

describe("sortByRecent", () => {
  it("puts the most recent first and everyone else alphabetically after", () => {
    const usage = { kari: 300, per: 100 };
    expect(sortByRecent(["Per", "Ola", "Kari", "Anna"], usage)).toEqual(["Kari", "Per", "Anna", "Ola"]);
  });

  it("follows Norwegian collation, where Aa counts as Å and so comes last", () => {
    expect(sortByRecent(["Aase", "Zeta", "Ola"], {})).toEqual(["Ola", "Zeta", "Aase"]);
  });

  it("matches names whatever their case, and sorts Norwegian letters properly", () => {
    expect(sortByRecent(["Åse", "Ola", "Ærlig"], {})).toEqual(["Ola", "Ærlig", "Åse"]);
    expect(sortByRecent(["PER", "kari"], { per: 5 })).toEqual(["PER", "kari"]);
  });

  it("does not change the list it is given, and copes with an empty one", () => {
    const names = ["B", "A"];
    sortByRecent(names, {});
    expect(names).toEqual(["B", "A"]);
    expect(sortByRecent([], {})).toEqual([]);
  });
});

describe("filterNames", () => {
  it("finds a name by any part of it, ignoring case", () => {
    expect(filterNames(["Vadla", "Lars", "Vegard"], "ve")).toEqual(["Vegard"]);
    expect(filterNames(["Vadla", "Lars", "Per"], "  A ")).toEqual(["Vadla", "Lars"]);
  });

  it("a blank search is everyone", () => {
    expect(filterNames(["A", "B"], "")).toEqual(["A", "B"]);
    expect(filterNames(["A", "B"], "   ")).toEqual(["A", "B"]);
  });
});
