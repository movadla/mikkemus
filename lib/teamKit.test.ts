import { describe, expect, it } from "vitest";
import { CLASH_DISTANCE, assignKits, awayKit, colourIndexOf, colourName, firstKit, kitDistance, kitFrom, makeKit, usesSecondColour } from "./teamKit";

describe("team kits", () => {
  it("are the same for the same two people, whatever the order or case", () => {
    expect(firstKit(["Per", "Ola"])).toEqual(firstKit(["ola", "PER"]));
    expect(awayKit(["Per", "Ola"])).toEqual(awayKit(["Ola", "Per"]));
  });

  it("differ between different teams (most of the time) and between first and away", () => {
    const pairs = [["Per", "Ola"], ["Kari", "Nils"], ["Per", "Kari"], ["Ola", "Nils"], ["Vadla", "Lars"], ["Moen", "Monge"]];
    const kits = new Set(pairs.map((p) => JSON.stringify(firstKit(p))));
    expect(kits.size).toBeGreaterThanOrEqual(4);
    for (const p of pairs) {
      const home = firstKit(p);
      const away = awayKit(p);
      expect(JSON.stringify(home)).not.toBe(JSON.stringify(away));
      expect(away.pattern).not.toBe(home.pattern);
    }
  });

  it("every kit is a complete, valid shirt", () => {
    for (const members of [["A"], ["A", "B"], ["x", "y", "z"], []]) {
      for (const kit of [firstKit(members), awayKit(members)]) {
        expect(kit.primary).toMatch(/^#[0-9a-f]{6}$/);
        expect(kit.secondary).toMatch(/^#[0-9a-f]{6}$/);
        expect(kit.trim).toMatch(/^#[0-9a-f]{6}$/);
        expect(["solid", "hoops", "stripes", "sash", "halves", "chevron"]).toContain(kit.pattern);
      }
    }
  });
});

describe("assignKits — two teams in one match", () => {
  /** Finds two teams whose first kits clash and whose away kits both clear the other team's first
   *  kit, so either of them can be the one to change. Searched for rather than hard-coded, so the
   *  test does not depend on which colours a particular hash happens to give. */
  function clashingTeams() {
    const names = Array.from({ length: 120 }, (_, i) => `Spiller${i}`);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = [names[i]];
        const b = [names[j]];
        const clash = kitDistance(firstKit(a), firstKit(b)) < CLASH_DISTANCE;
        const eitherCanChange = kitDistance(awayKit(b), firstKit(a)) >= CLASH_DISTANCE && kitDistance(awayKit(a), firstKit(b)) >= CLASH_DISTANCE;
        if (clash && eitherCanChange) return [{ name: "A", members: a }, { name: "B", members: b }];
      }
    }
    throw new Error("no suitable clashing pair found among 120 names");
  }

  it("gives the second team its away kit when the first kits clash", () => {
    const [a, b] = clashingTeams();
    const kits = assignKits([a, b]);
    expect(kits.A.away).toBe(false);
    expect(kits.A.kit).toEqual(firstKit(a.members));
    expect(kits.B.away).toBe(true);
    expect(kits.B.kit).toEqual(awayKit(b.members));
  });

  it("leaves both in their first kits when they are clearly different", () => {
    const names = Array.from({ length: 60 }, (_, i) => `Spiller${i}`);
    let found: [string, string] | null = null;
    for (let i = 0; i < names.length && !found; i++)
      for (let j = i + 1; j < names.length && !found; j++)
        if (kitDistance(firstKit([names[i]]), firstKit([names[j]])) > 200) found = [names[i], names[j]];
    expect(found).not.toBeNull();
    const kits = assignKits([{ name: "A", members: [found![0]] }, { name: "B", members: [found![1]] }]);
    expect(kits.A.away).toBe(false);
    expect(kits.B.away).toBe(false);
  });

  it("is decided by the order the teams were set up in, and the first team never changes", () => {
    const [a, b] = clashingTeams();
    const forward = assignKits([a, b]);
    const reversed = assignKits([b, a]);
    expect(forward.A.away).toBe(false);
    expect(reversed.B.away).toBe(false);
    expect(reversed.A.away).toBe(true);
  });

  it("handles one team, no teams and a team with nobody in it", () => {
    expect(assignKits([])).toEqual({});
    expect(assignKits([{ name: "A", members: ["Per"] }]).A.away).toBe(false);
    expect(() => assignKits([{ name: "A", members: [] }, { name: "B", members: [] }])).not.toThrow();
  });

  it("a team's own shirts are used when it has them, and the away one when they clash", () => {
    const red = kitFrom(0, "solid");
    const blue = kitFrom(1, "hoops");
    const kits = assignKits([
      { name: "A", members: ["Per"], kits: { home: red, away: blue } },
      { name: "B", members: ["Ola"], kits: { home: kitFrom(3, "stripes"), away: kitFrom(6, "sash") } }, // white/red clashes with red? no — but its primary is cream
      { name: "C", members: ["Kari"], kits: { home: kitFrom(0, "sash"), away: kitFrom(2, "halves") } },
    ]);
    expect(kits.A).toEqual({ kit: red, away: false });
    expect(kits.C.away).toBe(true);
    expect(kits.C.kit).toEqual(kitFrom(2, "halves"));
    expect(colourIndexOf(kitFrom(7, "chevron"))).toBe(7);
    expect(colourIndexOf({ primary: "#000000", secondary: "#000000", trim: "#000000", pattern: "solid" })).toBe(-1);
  });

  it("with many teams, nobody changes more than necessary and nobody throws", () => {
    const teams = Array.from({ length: 8 }, (_, i) => ({ name: `T${i}`, members: [`P${i}a`, `P${i}b`] }));
    const kits = assignKits(teams);
    expect(Object.keys(kits)).toHaveLength(8);
    expect(kits.T0.away).toBe(false);
  });
});

describe("makeKit", () => {
  it("uses the second colour for collar and cuffs, and only one colour on a plain shirt", () => {
    expect(makeKit("stripes", "#d8392b", "#f4f0e8")).toEqual({ primary: "#d8392b", secondary: "#f4f0e8", trim: "#f4f0e8", pattern: "stripes" });
    const plain = makeKit("solid", "#ffd400", "#d8392b");
    expect(plain.secondary).toBe("#ffd400");
    expect(plain.trim).toBe("#1d2a4a"); // a dark edge on a light shirt
    expect(makeKit("solid", "#1b1b1b", "#d8392b").trim).toBe("#f4f0e8");
    expect(usesSecondColour("solid")).toBe(false);
    expect(colourName("#D8392B")).toBe("Rød");
    expect(colourName("#123456")).toBe("Egen farge");
  });
});
