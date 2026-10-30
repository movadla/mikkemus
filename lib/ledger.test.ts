import { describe, expect, it } from "vitest";
import { newCareer } from "./career";
import { buyStage } from "./career";
import { book, lastWeek, totals } from "./ledger";
import { lifeOf } from "./careerLife";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = () => newCareer("Lars", "dyktig", AT);

describe("the books", () => {
  it("write a movement with the week and what it was for, and nothing for no movement", () => {
    const c = book(fresh(), "prize", "Premie: Ly-cupen", 500);
    expect(c.ledger).toEqual([{ week: 1, kind: "prize", label: "Premie: Ly-cupen", amount: 500 }]);
    expect(book(c, "fee", "Innskudd: Ly-cupen", 0)).toBe(c);
  });

  it("show the last week (this one and the one before) and the totals by kind", () => {
    let c = fresh();
    c = book(c, "prize", "Premie", 500);
    c = book(c, "fee", "Innskudd", -200);
    const later = { ...c, life: { ...lifeOf(c), week: 5 } };
    expect(lastWeek(later)).toEqual([]);
    const t = totals(later);
    expect(t.income).toBe(500);
    expect(t.spent).toBe(200);
    expect(t.byKind.map((k) => [k.kind, k.amount])).toEqual([["prize", 500], ["fee", -200]]);
  });

  it("are written when the room is bought", () => {
    const c = { ...fresh(), money: 100000 };
    const bought = buyStage(c);
    expect(bought.ledger?.[0]).toMatchObject({ kind: "room" });
    expect(bought.ledger?.[0].amount).toBeLessThan(0);
  });
});
