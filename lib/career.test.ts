import { describe, expect, it } from "vitest";
import { levelOfMed } from "./botLevels";
import { START_MONEY, TIERS, abandonEvent, closeEvent, dollars, entryCost, fieldFor, finishEvent, newCareer, openCup, placeIn, setTournament, startEvent, type Career } from "./career";
import { nextPlayable, recordKnockoutResult } from "./knockout";
import { matchParticipants } from "./tournament";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = (level = "dyktig") => newCareer("Lars", level, AT);
const entered = (c = fresh(), seed = 7) => {
  const started = startEvent(c, "lu", seed);
  return openCup(started, started.active!.entrants, AT);
};

/** Plays the cup so that Lars wins `wins` matches and loses the next one (a win in all three rounds wins the cup). The others' matches go to the first name. */
function playOut(c: Career, wins: number): Career {
  let t = c.active!.tournament!;
  let won = 0;
  for (let guard = 0; guard < 12 && t.status !== "done"; guard++) {
    const m = nextPlayable(t);
    if (!m) break;
    const [a, b] = matchParticipants(m);
    const mine = a === "Lars" || b === "Lars";
    const winner = mine ? (won < wins ? "Lars" : a === "Lars" ? b : a) : a;
    const loser = winner === a ? b : a;
    if (mine && winner === "Lars") won++;
    t = recordKnockoutResult(t, m.id, [winner, loser], {});
    if (mine && winner !== "Lars" && wins < 3) break;
  }
  return setTournament(c, t);
}

describe("newCareer", () => {
  it("starts with the money, the level and the place asked for", () => {
    const c = newCareer("Lars", "sterk", AT, { home: "loft", darts: "tunge" });
    expect(c).toMatchObject({ id: "lars", player: "Lars", skillMed: 30, money: START_MONEY, points: 0, titles: 0, active: null, profile: { home: "loft", darts: "tunge" } });
  });
});

describe("dollars", () => {
  it("writes money as dollars, with a minus for what is owed", () => {
    expect(dollars(50)).toBe("$50");
    expect(dollars(1250).replace(/\s/g, " ")).toBe("$1 250");
    expect(dollars(-50)).toBe("−$50");
  });
});

describe("the field", () => {
  it("is eight different names with the player in it, and the bots set from the level", () => {
    const field = fieldFor(fresh(), TIERS.lu, 7);
    expect(field).toHaveLength(8);
    expect(new Set(field.map((e) => e.name)).size).toBe(8);
    expect(field.filter((e) => !e.isBot).map((e) => e.name)).toEqual(["Lars"]);
    const lo = levelOfMed(37 * 1.2 * 0.87);
    const hi = levelOfMed(37 * 1.2 * 1.13);
    for (const e of field) {
      if (!e.isBot) continue;
      expect(e.skill!).toBeGreaterThanOrEqual(lo);
      expect(e.skill!).toBeLessThanOrEqual(hi);
    }
  });

  it("is the same for the same seed and different for another", () => {
    expect(fieldFor(fresh(), TIERS.lu, 7)).toEqual(fieldFor(fresh(), TIERS.lu, 7));
    expect(fieldFor(fresh(), TIERS.lu, 7).map((e) => e.name)).not.toEqual(fieldFor(fresh(), TIERS.lu, 8).map((e) => e.name));
  });

  it("is weaker for a weaker player and sharper for a sharper one", () => {
    const mean = (level: string) => {
      const bots = fieldFor(fresh(level), TIERS.lu, 3).filter((e) => e.isBot);
      return bots.reduce((s, b) => s + b.skill!, 0) / bots.length;
    };
    expect(mean("nybegynner")).toBeGreaterThan(mean("dyktig"));
    expect(mean("dyktig")).toBeGreaterThan(mean("sterk"));
  });

  it("puts the strongest first, the player where their own level puts them", () => {
    const field = fieldFor(fresh(), TIERS.lu, 7);
    const strength = field.map((e) => (e.isBot ? e.skill! : levelOfMed(37)));
    expect(strength).toEqual([...strength].sort((a, b) => a - b));
  });
});

describe("signing up", () => {
  it("pays the fee, once, and makes the field", () => {
    const c = startEvent(fresh(), "lu", 1);
    expect(c.money).toBe(START_MONEY - 50);
    expect(c.active).toMatchObject({ cost: 50, tournament: null, result: null });
    expect(c.active!.entrants).toHaveLength(8);
    expect(c.active!.cup).toMatchObject({ kind: "lu", name: "Lü-cupen" });
    expect(startEvent(c, "lu", 2)).toBe(c);
  });

  it("lets a player with less than the fee in on credit, so a career cannot get stuck", () => {
    const poor = { ...fresh(), money: 20 };
    expect(entryCost(poor, TIERS.lu)).toBe(20);
    expect(startEvent(poor, "lu", 1).money).toBe(0);
    expect(startEvent({ ...fresh(), money: 0 }, "lu", 1).active?.cost).toBe(0);
  });

  it("opens the cup from the draw, a knockout of eight with the cup in it", () => {
    const c = entered();
    const t = c.active!.tournament!;
    expect(t.cup?.kind).toBe("lu");
    expect(t.format).toBe("knockout");
    expect(t.matches.filter((m) => m.bracketRoundSize === 4)).toHaveLength(4);
    expect(openCup(c, c.active!.entrants, AT)).toBe(c);
  });
});

describe("how far the player got", () => {
  it.each([
    [0, "quarter"],
    [1, "semi"],
    [2, "final"],
    [3, "winner"],
  ] as const)("wins %i matches and is %s", (wins, place) => {
    const c = playOut(entered(), wins);
    expect(placeIn(c.active!.tournament!, "Lars")).toBe(place);
  });
});

describe("paying out", () => {
  it("ends the event for a player who is out, with the rest played and nothing won", () => {
    const c = finishEvent(playOut(entered(), 0), AT);
    expect(c.active!.tournament!.status).toBe("done");
    expect(c.active!.result).toMatchObject({ place: "quarter", prize: 0, cost: 50, points: 1 });
    expect(c.money).toBe(START_MONEY - 50);
    expect(c.points).toBe(1);
    expect(c.played).toBe(1);
    expect(c.titles).toBe(0);
  });

  it("pays the winner and counts the title", () => {
    const c = finishEvent(playOut(entered(), 3), AT);
    expect(c.active!.result).toMatchObject({ place: "winner", prize: 400, points: 10 });
    expect(c.money).toBe(START_MONEY - 50 + 400);
    expect(c.titles).toBe(1);
    expect(c.history[0]).toMatchObject({ event: "Lü-cupen", place: "winner" });
  });

  it("gives the finalist the second prize, and the semifinalist nothing", () => {
    expect(finishEvent(playOut(entered(), 2), AT).active!.result).toMatchObject({ place: "final", prize: 150 });
    expect(finishEvent(playOut(entered(), 1), AT).active!.result).toMatchObject({ place: "semi", prize: 0 });
  });

  it("pays once", () => {
    const c = finishEvent(playOut(entered(), 3), AT);
    expect(finishEvent(c, AT)).toBe(c);
  });

  it("leaves the finished event behind when closed, and not before", () => {
    const c = entered();
    expect(closeEvent(c)).toBe(c);
    expect(closeEvent(finishEvent(playOut(c, 0), AT)).active).toBeNull();
  });

  it("gives an unfinished event up with the fee lost and nothing won", () => {
    const c = abandonEvent(entered());
    expect(c.active).toBeNull();
    expect(c.money).toBe(START_MONEY - 50);
    expect(c.history).toHaveLength(0);
  });
});
