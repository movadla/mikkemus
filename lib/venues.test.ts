import { afterEach, describe, expect, it, vi } from "vitest";
import { VENUES, defaultVenue, saveVenue, venueForCup, venueForSize, venueOf, venueOfTournament } from "./venues";

const tournament = (id: string, n: number, kind?: "em" | "vm") => ({ id, cup: kind ? ({ kind } as never) : undefined, participants: Array.from({ length: n }, (_, i) => ({ name: `p${i}`, isBot: false })) });

describe("the places of a tournament", () => {
  it("fits a European championship to the Grand Slam hall, and the others to their own", () => {
    expect(venueForCup("em")).toBe("gs");
    expect(venueForCup("gs")).toBe("gs");
    expect(venueForCup("vm")).toBe("vm");
    expect(venueForCup("nm")).toBe("nm");
    expect(venueForCup("open")).toBe("lu");
  });

  it("fits a tournament of friends by its size: a pub for a few, an arena for many", () => {
    expect([4, 8, 9, 16, 17, 32, 33, 64, 65, 128].map(venueForSize)).toEqual(["lu", "lu", "region", "region", "nm", "nm", "gs", "gs", "vm", "vm"]);
    expect(defaultVenue(undefined, 8)).toBe("lu");
    expect(defaultVenue("em", 8)).toBe("gs");
  });

  it("stands every place on a step of the career, and keeps the ones with pictures of their own by key", () => {
    expect(VENUES.map((v) => v.id)).toContain("wc");
    expect(venueOf("wc").tier).toBe("vm");
    expect(venueOf("wc").key).toBe("wc");
    expect(venueOf("nowhere" as never).id).toBe("lu");
  });
});

describe("remembering where a tournament is played", () => {
  const store = new Map<string, string>();
  const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it("gives back what was chosen, and otherwise what fits", () => {
    vi.stubGlobal("localStorage", fake);
    expect(venueOfTournament(tournament("a", 4))).toBe("lu");
    saveVenue("a", "region");
    expect(venueOfTournament(tournament("a", 4))).toBe("region");
    expect(venueOfTournament(tournament("b", 8, "em"))).toBe("gs");
  });

  it("keeps only the latest forty and survives a store that is not there", () => {
    vi.stubGlobal("localStorage", fake);
    for (let i = 0; i < 45; i++) saveVenue(`t${i}`, "nm");
    expect(Object.keys(JSON.parse(store.get("mikke-mus-venues")!))).toHaveLength(40);
    vi.unstubAllGlobals();
    expect(() => saveVenue("x", "vm")).not.toThrow();
    expect(venueOfTournament(tournament("x", 4))).toBe("lu");
  });
});
