import { describe, expect, it } from "vitest";
import { GEAR, buyGear, coachWeight, dartsBonus, feeDiscount, gearBadge, gearNow, nextGear, whyNotBuyGear } from "./gear";
import { TIERS, entryCost, factorFor, newCareer, startEvent, whyNot } from "./career";
import { climbReward, dailyReward } from "./drills";
import { sessionFrom } from "./training";

const AT = "2026-10-30T20:00:00.000Z";
const fresh = (money = 2000) => ({ ...newCareer("Lars", "dyktig", AT), money });

describe("the gear", () => {
  it("is three kinds, each a few steps that cost more as they go, the first free", () => {
    expect(GEAR.map((g) => g.id)).toEqual(["darts", "coach", "travel"]);
    for (const g of GEAR) {
      expect(g.steps[0].price).toBe(0);
      for (let i = 2; i < g.steps.length; i++) expect(g.steps[i].price).toBeGreaterThan(g.steps[i - 1].price);
    }
  });

  it("starts at the first step, and a step is bought with the money and written in the books", () => {
    const c = fresh(1000);
    expect(gearNow(c, "darts").name).toBe("Messingpiler");
    expect(nextGear(c, "darts")?.price).toBe(400);
    const bought = buyGear(c, "darts");
    expect(bought.money).toBe(600);
    expect(bought.gear).toEqual({ darts: 1, coach: 0, travel: 0 });
    expect(bought.ledger?.at(-1)).toMatchObject({ kind: "gear", amount: -400, label: "Piler: Wolfram 80 %" });
    expect(gearNow(bought, "darts").name).toBe("Wolfram 80 %");
  });

  it("cannot be bought without the money, nor past the last step", () => {
    const poor = fresh(100);
    expect(whyNotBuyGear(poor, "darts")).toBe("Mangler $300");
    expect(buyGear(poor, "darts")).toBe(poor);
    let c = fresh(100000);
    for (let i = 0; i < 5; i++) c = buyGear(c, "travel");
    expect(c.gear?.travel).toBe(2);
    expect(whyNotBuyGear(c, "travel")).toBe("Ferdig");
    expect(gearBadge(fresh(100))).toBe(false);
    expect(gearBadge(fresh(1000))).toBe(true);
  });

  it("the darts make the opponents a little weaker, two per cent a step", () => {
    const c = fresh(100000);
    expect(dartsBonus(c)).toBe(1);
    const better = buyGear(buyGear(c, "darts"), "darts");
    expect(dartsBonus(better)).toBeCloseTo(1.04, 5);
    expect(factorFor(better, TIERS.lu)).toBeCloseTo(factorFor(c, TIERS.lu) * 1.04, 5);
  });

  it("the coach moves the level twice as fast, then doubles the ladder, then the drill of the day", () => {
    const c = fresh(100000);
    expect(coachWeight(c)).toBe(1);
    const rounds = Array(15).fill(60);
    const one = buyGear(c, "coach");
    expect(sessionFrom(one, rounds, AT).after - c.skillMed).toBeCloseTo((sessionFrom(c, rounds, AT).after - c.skillMed) * 2, 1);
    expect(climbReward(one)).toBe(50);
    const two = buyGear(one, "coach");
    expect(climbReward(two)).toBe(100);
    expect(dailyReward(two)).toBe(100);
    expect(dailyReward(buyGear(two, "coach"))).toBe(200);
  });

  it("the travel takes a share off the entry fees, and the fee paid is the cheaper one", () => {
    const c = { ...fresh(100000), qualified: ["nm" as const] };
    expect(feeDiscount(c)).toBe(0);
    expect(entryCost(c, TIERS.nm)).toBe(750);
    const train = buyGear(c, "travel");
    expect(entryCost(train, TIERS.nm)).toBe(640);
    expect(entryCost(train, TIERS.lu)).toBe(0);
    const fly = buyGear(train, "travel");
    expect(entryCost(fly, TIERS.nm)).toBe(530);
    const entered = startEvent(fly, "nm", 1);
    expect(fly.money - entered.money).toBe(530);
    // The money it takes is the money it costs.
    expect(whyNot({ ...fly, money: 600, active: null }, TIERS.nm)).toBeNull();
    expect(whyNot({ ...c, money: 600 }, TIERS.nm)).toBe("Mangler $150");
  });
});
