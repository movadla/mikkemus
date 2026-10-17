import { describe, expect, it } from "vitest";
import { START_COINS, atStake, balances, currentNight, lifetimeNet, liabilityFor, netByUser, potFor, settleUp, stakeProblem, type BetRow, type LedgerRow } from "./ledger";

const row = (user_id: string, delta: number, reason: LedgerRow["reason"] = "adjust", night = 1): LedgerRow => ({ id: `${user_id}${delta}${Math.random()}`, user_id, night, delta, reason, bet_id: null, created_at: "2026-10-17T12:00:00Z" });

describe("the books", () => {
  it("the other side risks the profit of the backer, whole coins, rounded down", () => {
    expect(liabilityFor(100, 1.87)).toBe(87);
    expect(liabilityFor(33, 1.5)).toBe(16); // 16,5 → 16
    expect(liabilityFor(10, 1.01)).toBe(0);
    expect(liabilityFor(1000, 2.1)).toBe(1100); // no floating-point shortfall
    expect(potFor(100, 1.87)).toBe(187);
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
    const bet = (backer_id: string, layer_id: string | null, stake: number, status: BetRow["status"]): BetRow => ({ id: "x", backer_id, layer_id, match_id: "m", pick: "A", stake, odds: 2, liability: stake, turn: 0, phase: "pre", status, placed_at: "", settled_at: null });
    const bets = [bet("a", null, 50, "open"), bet("a", "b", 70, "matched"), bet("b", "a", 30, "matched"), bet("a", "b", 20, "won"), bet("b", null, 5, "cancelled")];
    expect(atStake(bets, "a")).toBe(50 + 70 + 30);
    expect(atStake(bets, "b")).toBe(70 + 30);
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
