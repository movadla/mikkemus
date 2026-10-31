import { describe, expect, it } from "vitest";
import { lifeOf } from "./careerLife";
import type { TierId } from "./career";
import { weekOfInvite, weekOfTier } from "./careerCalendar";
import type { Invitation } from "./careerLife";
import { newCareer, offerChallenge, openCup, setTournament, settleChallenge, startEvent as realStartEvent, finishEvent, type Career } from "./career";
import { heroButton, heroFor } from "./careerHero";
import { nextPlayable, recordKnockoutResult } from "./knockout";
import { matchParticipants } from "./tournament";

/** The week of the plan a step (or an invitation) is played in: the tests sign up in it. */
const inItsWeek = (c: Career, tier: TierId, invite?: { key: string }): Career => ({ ...c, life: { ...lifeOf(c), week: invite ? weekOfInvite(invite.key) : weekOfTier(tier) } });
const startEvent = (c: Career, tier: TierId, seed: number, invite?: Invitation) => realStartEvent(inItsWeek(c, tier, invite), tier, seed, invite);

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

  it("points a brand new career at the pub's cup, however much money there is", () => {
    expect(heroButton(heroFor({ ...fresh(), money: 20000 }))).toEqual({ label: "SPILL", sub: "Ly · gratis" });
  });

  it("goes to the biggest step the player can enter: the regional championship once there is money for it", () => {
    const inWeek = (week: number, over: Partial<Career>): Career => ({ ...fresh(), played: 1, ...over, life: { ...lifeOf(fresh()), week } });
    expect(heroButton(heroFor(inWeek(3, { money: 500 })))).toEqual({ label: "SPILL", sub: "Region · $200" });
    expect(heroButton(heroFor(inWeek(5, { money: 20000, qualified: ["nm"] }))).sub).toMatch(/^NM · /);
  });

  it("leads to the calendar in a week with nothing to enter", () => {
    const week2: Career = { ...fresh(), played: 1, money: 500, life: { ...lifeOf(fresh()), week: 2 } };
    expect(heroButton(heroFor(week2))).toEqual({ label: "SESONG", sub: "Uke 2" });
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
