import { describe, expect, it } from "vitest";
import { MAX_PRICE_ERROR, exactStakes, participantSide, priceIsExact, MARGIN_BUCKETS, START_COINS, atStake, balances, betText, betWon, bucketByLabel, bucketChance, currentNight, fairPrice, lifetimeNet, liabilityFor, netByUser, potFor, settleUp, stakeProblem, type BetRow, type LedgerRow } from "./ledger";

const row = (user_id: string, delta: number, reason: LedgerRow["reason"] = "adjust", night = 1): LedgerRow => ({ id: `${user_id}${delta}${Math.random()}`, user_id, night, delta, reason, bet_id: null, created_at: "2026-10-17T12:00:00Z" });

describe("the books", () => {
  it("the other side risks the profit of the backer, whole coins, rounded down", () => {
    expect(liabilityFor(100, 1.87)).toBe(87);
    expect(liabilityFor(33, 1.5)).toBe(17); // 16,5 → 17, to the nearest
    expect(liabilityFor(10, 1.01)).toBe(0);
    expect(liabilityFor(1000, 2.1)).toBe(1100); // no floating-point shortfall
    expect(potFor(100, 1.87)).toBe(187);
  });

  it("the price is the same from both sides: backing one is laying the other", () => {
    const pA = 0.53;
    const oA = fairPrice(pA);
    const oB = fairPrice(1 - pA);
    expect(oA).toBe(1.89);
    expect(oB).toBe(2.13);
    // Backing A with 100 puts 89 at risk for the other side. Backing B with 89 would put 100 at risk, within a coin.
    expect(Math.abs(liabilityFor(89, oB) - 100)).toBeLessThanOrEqual(1);
    expect(fairPrice(0.999)).toBe(1.01);
  });

  it("a balance is the sum of the entries, per night", () => {
    const ledger = [row("a", START_COINS, "start"), row("a", -100, "stake"), row("a", 187, "payout"), row("b", START_COINS, "start"), row("b", -87, "lay"), row("a", START_COINS, "start", 2)];
    expect(balances(ledger, 1)).toEqual({ a: 1087, b: 913 });
    expect(netByUser(ledger, 1)).toEqual({ a: 87, b: -87 });
    expect(balances(ledger, 2)).toEqual({ a: 1000 });
    expect(currentNight(ledger)).toBe(2);
    expect(currentNight([])).toBe(1);
    expect(lifetimeNet(ledger)).toEqual({ a: 87, b: -87 });
  });

  it("without a bank the nets add up to zero", () => {
    // a backs at 2,00 with 100, b takes the other side (risks 100), a wins the pot of 200.
    const ledger = [row("a", START_COINS, "start"), row("b", START_COINS, "start"), row("a", -100, "stake"), row("b", -100, "lay"), row("a", 200, "payout")];
    const nets = netByUser(ledger, 1);
    expect(nets).toEqual({ a: 100, b: -100 });
    expect(Object.values(nets).reduce((x, y) => x + y, 0)).toBe(0);
  });

  it("checks a stake", () => {
    expect(stakeProblem(100, 1000)).toBe("none");
    expect(stakeProblem(0, 1000)).toBe("too-low");
    expect(stakeProblem(1001, 1000)).toBe("too-high");
    expect(stakeProblem(12.5, 1000)).toBe("not-whole");
    expect(stakeProblem(Number.NaN, 1000)).toBe("not-whole");
  });

  it("counts what is tied up in undecided bets", () => {
    const bet = (backer_id: string, layer_id: string | null, stake: number, status: BetRow["status"]): BetRow => ({ id: "x", backer_id, layer_id, match_id: "m", market: "winner", detail: null, pick: "A", stake, odds: 2, liability: stake, turn: 0, phase: "pre", status, placed_at: "", settled_at: null });
    const bets = [bet("a", null, 50, "open"), bet("a", "b", 70, "matched"), bet("b", "a", 30, "matched"), bet("a", "b", 20, "won"), bet("b", null, 5, "cancelled")];
    expect(atStake(bets, "a")).toBe(50 + 70 + 30);
    expect(atStake(bets, "b")).toBe(70 + 30);
  });
});

describe("margin bets", () => {
  // The chance of winning with the other lacking k crosses, at index k (made up, adds to 0,6).
  const margin = [0, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.03, 0.03, 0.03, 0.01, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = (l: string) => bucketByLabel(l)!;

  it("adds up the chance of the margins in a bucket", () => {
    expect(bucketChance(margin, b("1"))).toBeCloseTo(0.1, 9);
    expect(bucketChance(margin, b("5–6"))).toBeCloseTo(0.1, 9);
    expect(bucketChance(margin, b("7–9"))).toBeCloseTo(0.09, 9);
    expect(bucketChance(margin, b("10+"))).toBeCloseTo(0.01, 9);
    expect(bucketChance(undefined, b("1"))).toBe(0);
    // Every margin is in exactly one bucket.
    const all = MARGIN_BUCKETS.reduce((s, x) => s + bucketChance(margin, x), 0);
    expect(all).toBeCloseTo(margin.reduce((a, c) => a + c, 0), 9);
  });

  it("is won only when the right side wins by a margin in the bucket", () => {
    const bet = { market: "margin" as const, pick: "Vadla", detail: "5–6" };
    expect(betWon(bet, "Vadla", 5)).toBe(true);
    expect(betWon(bet, "Vadla", 6)).toBe(true);
    expect(betWon(bet, "Vadla", 7)).toBe(false);
    expect(betWon(bet, "Vadla", 4)).toBe(false);
    expect(betWon(bet, "Monge", 5)).toBe(false);
    expect(betWon(bet, "Vadla", null)).toBeNull(); // no margin recorded: hand it back
    expect(betWon({ ...bet, detail: "10+" }, "Vadla", 22)).toBe(true);
    expect(betWon({ market: "winner", pick: "Vadla", detail: null }, "Vadla", null)).toBe(true);
  });

  it("says what it is", () => {
    expect(betText({ market: "margin", pick: "Vadla", detail: "3" })).toBe("Vadla med 3 streker");
    expect(betText({ market: "margin", pick: "Vadla", detail: "1" })).toBe("Vadla med 1 strek");
    expect(betText({ market: "winner", pick: "Vadla", detail: null })).toBe("Vadla");
  });
});

describe("who owes whom", () => {
  const apply = (nets: { id: string; net: number }[]) => {
    const t = settleUp(nets);
    const after = Object.fromEntries(nets.map((n) => [n.id, n.net]));
    for (const x of t) {
      after[x.from] += x.amount;
      after[x.to] -= x.amount;
    }
    return { t, after };
  };

  it("brings everyone level with the fewest payments", () => {
    const { t, after } = apply([{ id: "a", net: 300 }, { id: "b", net: -100 }, { id: "c", net: -200 }]);
    expect(t.length).toBeLessThanOrEqual(2);
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
    expect(t.every((x) => x.to === "a")).toBe(true);
  });

  it("owes nothing when nobody is ahead, and with one person", () => {
    expect(settleUp([{ id: "a", net: 0 }, { id: "b", net: 0 }])).toEqual([]);
    expect(settleUp([{ id: "a", net: 500 }])).toEqual([]);
    expect(settleUp([])).toEqual([]);
  });

  it("copes with nets that do not quite add up, sharing the difference", () => {
    const { after } = apply([{ id: "a", net: 100 }, { id: "b", net: 0 }, { id: "c", net: 0 }]);
    const values = Object.values(after);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });
});

describe("the price in whole coins", () => {
  it("refuses a stake where the rounding is worth more than a few per cent", () => {
    expect(priceIsExact(2, 1.99)).toBe(true); // risks 2, as the price says (it used to risk 1)
    expect(priceIsExact(2, 1.4)).toBe(false); // 0,8 would be 1
    expect(priceIsExact(3, 1.49)).toBe(false);
    expect(priceIsExact(100, 1.87)).toBe(true);
    expect(priceIsExact(10, 1.01)).toBe(false); // nothing to risk
  });

  it("lets every price through from 17 coins up, so that it is only the smallest bets that are held back", () => {
    for (let odds = 1.05; odds < 20; odds += 0.01) {
      const o = Math.round(odds * 100) / 100;
      for (let s = 40; s <= 60; s++) expect(Math.abs(liabilityFor(s, o) - s * (o - 1))).toBeLessThanOrEqual(MAX_PRICE_ERROR * s + 1e-9);
    }
  });

  it("suggests stakes that work, nearest first", () => {
    const near = exactStakes(1.49, 3);
    expect(near.length).toBe(3);
    near.forEach((s) => expect(priceIsExact(s, 1.49)).toBe(true));
  });
});

describe("who plays in the match", () => {
  const live = { players: ["Vadla", "Moen & Hans"], teams: { "Moen & Hans": ["Moen", "Hans"] } };
  it("finds a player by name, and a team member by the team", () => {
    expect(participantSide(live, "vadla")).toBe("Vadla");
    expect(participantSide(live, " Hans ")).toBe("Moen & Hans");
    expect(participantSide(live, "Monge")).toBeNull();
  });
});
