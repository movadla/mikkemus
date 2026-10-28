import { describe, expect, it } from "vitest";
import { newCareer, offerChallenge, openCup, setTournament, settleChallenge, startEvent, finishEvent, type Career } from "./career";
import { heroButton, heroFor } from "./careerHero";
import { nextPlayable, recordKnockoutResult } from "./knockout";
import { matchParticipants } from "./tournament";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = (): Career => newCareer("Lars", "dyktig", AT);
const inCup = (c = fresh(), tier: "lu" | "region" = "lu") => {
  const s = startEvent(c, tier, 7);
  return openCup(s, s.active!.entrants, AT);
};

describe("the main button of the home screen", () => {
  it("says SPILL for a new player, with the free pub under it", () => {
    const c = { ...fresh(), money: 100 };
    expect(heroFor(c)).toMatchObject({ kind: "enter" });
    expect(heroButton(heroFor(c))).toEqual({ label: "SPILL", sub: "Ly · gratis" });
  });

  it("goes to the biggest step the player can enter: the regional championship once there is money for it", () => {
    expect(heroButton(heroFor({ ...fresh(), money: 500 }))).toEqual({ label: "SPILL", sub: "Region · $200" });
    expect(heroButton(heroFor({ ...fresh(), money: 20000, qualified: ["nm"] })).sub).toMatch(/^NM · /);
  });

  it("is the cup that is going, with the round and the opponent under the word", () => {
    const hero = heroFor(inCup());
    expect(hero).toMatchObject({ kind: "event", drawn: true, done: false, round: "Kvartfinale" });
    const b = heroButton(hero);
    expect(b.label).toBe("SPILL");
    expect(b.sub).toMatch(/^Kvartfinale · \S+/);
  });

  it("says TREKK when the draw is not made", () => {
    expect(heroButton(heroFor(startEvent(fresh(), "lu", 3)))).toEqual({ label: "TREKK", sub: "Ly" });
  });

  it("says HENT with the prize when the cup is over", () => {
    let c = inCup();
    let t = c.active!.tournament!;
    for (let g = 0; g < 12 && t.status !== "done"; g++) {
      const m = nextPlayable(t);
      if (!m) break;
      const [a, b] = matchParticipants(m);
      const winner = a === "Lars" || b === "Lars" ? "Lars" : a;
      t = recordKnockoutResult(t, m.id, [winner, winner === a ? b : a], {});
    }
    c = finishEvent(setTournament(c, t), AT);
    expect(heroButton(heroFor(c))).toEqual({ label: "HENT", sub: "$500" });
  });

  it("is a challenge that is on, and then what it came to", () => {
    const c = offerChallenge(fresh(), "501", 4);
    expect(heroButton(heroFor(c)).label).toBe("SPILL");
    expect(heroButton(heroFor(c)).sub).toMatch(/^501 · \S+/);
    expect(heroButton(heroFor(settleChallenge(c, true, AT)))).toEqual({ label: "HENT", sub: "$150" });
    expect(heroButton(heroFor(settleChallenge(c, false, AT))).label).toBe("OK");
  });
});
