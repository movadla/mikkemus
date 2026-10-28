import { describe, expect, it } from "vitest";
import { newCareer, offerChallenge, openCup, setTournament, settleChallenge, startEvent, finishEvent, type Career } from "./career";
import { heroCta, heroFor } from "./careerHero";
import { nextPlayable, recordKnockoutResult } from "./knockout";
import { matchParticipants } from "./tournament";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = (): Career => newCareer("Lars", "dyktig", AT);
const inCup = (c = fresh(), tier: "lu" | "region" = "lu") => {
  const s = startEvent(c, tier, 7);
  return openCup(s, s.active!.entrants, AT);
};

describe("the hero of the home screen", () => {
  it("is the pub for a new player: free, with the name on the button", () => {
    const c = { ...fresh(), money: 100 };
    const hero = heroFor(c);
    expect(hero).toMatchObject({ kind: "enter" });
    expect(heroCta(hero)).toBe("Spill Lü-cupen · gratis");
  });

  it("is the biggest step the player can enter: the regional championship once there is money for it", () => {
    expect(heroCta(heroFor({ ...fresh(), money: 500 }))).toMatch(/^Spill Regionmesterskapet · \$200$/);
    expect(heroCta(heroFor({ ...fresh(), money: 20000, qualified: ["nm"] }))).toMatch(/^Spill Norgesmesterskapet/);
  });

  it("is the cup that is going, with the round and the opponent on the button", () => {
    const hero = heroFor(inCup());
    expect(hero).toMatchObject({ kind: "event", drawn: true, done: false, round: "Kvartfinale" });
    expect(heroCta(hero)).toMatch(/^Spill kvartfinalen mot \S+/);
  });

  it("says to draw when the draw is not made", () => {
    expect(heroCta(heroFor(startEvent(fresh(), "lu", 3)))).toBe("Trekk lodd");
  });

  it("puts the prize on the button when the cup is over", () => {
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
    expect(heroCta(heroFor(c))).toMatch(/^Hent premien \(\$500\)$/);
  });

  it("is a challenge that is on, and then what it came to", () => {
    const c = offerChallenge(fresh(), "501", 4);
    expect(heroCta(heroFor(c))).toMatch(/^Spill 501 mot \S+/);
    expect(heroCta(heroFor(settleChallenge(c, true, AT)))).toMatch(/^Hent \$150$/);
    expect(heroCta(heroFor(settleChallenge(c, false, AT)))).toBe("Tilbake til rommet");
  });
});
