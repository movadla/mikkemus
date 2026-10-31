import { describe, expect, it } from "vitest";
import { newCareer, type Career } from "./career";
import { newLife, rivalOf } from "./careerLife";
import { filmLength, frontPage, previouslyOf, rivalQuip, rivalRecordLine, seasonFilm, weekCardOf, weeksOfSeason } from "./show";

const base = (): Career => newCareer("Kari", "dyktig", "2026-01-01T00:00:00.000Z");

/** A career that has played the first season: a few weeks logged, a title in week 3 and a record against the rival. */
function played(): Career {
  const c = base();
  return {
    ...c,
    rivals: { [rivalOf(c).name]: { w: 1, l: 1, last: "2026-02-01T00:00:00.000Z", lastWon: true } },
    life: {
      ...newLife(),
      week: 9,
      weeks: { "1": { name: "Ly-cupen", place: "semi" }, "2": { name: "TBA", skipped: true }, "3": { name: "Regionmesterskapet", place: "winner" }, "5": { name: "Norgesmesterskapet", place: "quarter" } },
      seasons: [{ season: 1, rank: 2, points: 40, prize: 500, winner: "Emil", table: [{ name: "Emil", pts: 60 }, { name: "Kari", pts: 40 }] }],
    },
  };
}

describe("weekCardOf", () => {
  it("names the week of the plan and has eight ticks", () => {
    const c = { ...base(), life: { ...newLife(), week: 3 } };
    const card = weekCardOf(c);
    expect(card).toMatchObject({ week: 3, of: 8, name: "Regionmesterskapet", tba: false, tier: "region" });
    expect(card.ticks).toEqual(["done", "done", "now", "ahead", "ahead", "ahead", "ahead", "ahead"]);
  });
  it("is TBA in a week with no invitation", () => {
    const card = weekCardOf({ ...base(), life: { ...newLife(), week: 2 } });
    expect(card).toMatchObject({ name: "TBA", tba: true, where: null });
  });
});

describe("seasonFilm", () => {
  it("builds the scenes from what is kept and runs 25 to 30 seconds at most", () => {
    const c = played();
    const scenes = seasonFilm(c, c.life!.seasons[0]);
    expect(scenes.map((s) => s.kind)).toEqual(["title", "weeks", "weeks", "trophy", "rival", "table", "end"]);
    expect(filmLength(scenes)).toBeGreaterThanOrEqual(25000);
    expect(filmLength(scenes)).toBeLessThanOrEqual(30000);
    expect(weeksOfSeason(c, 1)).toHaveLength(4);
  });
  it("tells the best place when there is no title", () => {
    const c = played();
    const lost = { ...c, life: { ...c.life!, weeks: { "1": { name: "Ly-cupen", place: "semi" as const }, "3": { name: "Regionmesterskapet", place: "quarter" as const } } } };
    expect(seasonFilm(lost, lost.life.seasons[0]).find((s) => s.kind === "best")).toMatchObject({ place: "semi", name: "Ly-cupen" });
  });
  it("leaves out what is not kept", () => {
    const c = { ...base(), life: { ...newLife(), week: 9, seasons: [{ season: 1, rank: 5, points: 3, prize: 0, winner: "Emil" }] } };
    expect(seasonFilm(c, c.life!.seasons[0]).map((s) => s.kind)).toEqual(["title", "end"]);
  });
});

describe("frontPage", () => {
  const f = { careerId: "kari", week: 3, player: "Kari", tournament: "Regionmesterskapet", prize: 1000, points: 20 };
  it("is the same for the same input", () => {
    expect(frontPage({ ...f, place: "winner" })).toEqual(frontPage({ ...f, place: "winner" }));
  });
  it("tells only the facts that exist", () => {
    for (const place of ["winner", "final", "semi", "quarter", "r16", "r32"] as const) {
      const p = frontPage({ ...f, place, prize: 0, points: 0 });
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.lede).not.toMatch(/Premien|poeng/);
      expect(frontPage({ ...f, place }).lede).toMatch(/\$1\s?000/);
    }
  });
  it("has more than one wording for a title", () => {
    const heads = new Set(Array.from({ length: 40 }, (_, i) => frontPage({ ...f, week: i + 1, place: "winner" }).headline.replace(/Kari|Regionmesterskapet/g, "")));
    expect(heads.size).toBeGreaterThan(1);
  });
});

describe("rival and previously", () => {
  it("reads the record", () => {
    expect(rivalRecordLine("Dave", undefined)).toBeNull();
    expect(rivalRecordLine("Dave", { w: 0, l: 2, last: "", lastWon: false })).toBe("Du har ikke slått ham ennå.");
    expect(rivalRecordLine("Dave", { w: 1, l: 1, last: "", lastWon: true })).toMatch(/^Dere står 1–1\./);
    expect(rivalRecordLine("Dave", { w: 1, l: 3, last: "", lastWon: false })).toMatch(/^Dave leder 3–1\./);
  });
  it("gives the same quip every time", () => {
    expect(rivalQuip("kari", 3, "Dave", true)).toBe(rivalQuip("kari", 3, "Dave", true));
  });
  it("lists the last three placed results", () => {
    const c = { ...base(), history: [{ at: "", event: "A", place: "final" as const, prize: 0, cost: 0, points: 0 }, { at: "", event: "Duell", prize: 0, cost: 0, points: 0, won: true }, { at: "", event: "B", place: "winner" as const, prize: 0, cost: 0, points: 0 }] };
    expect(previouslyOf(c)).toEqual(["A · Finalist", "B · Vinner"]);
  });
});
