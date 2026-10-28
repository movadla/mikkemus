import { describe, expect, it } from "vitest";
import { levelOfMed } from "./botLevels";
import {
  GAMES,
  SLOTS,
  arenaBonus,
  arenaSteps,
  buyUpgrade,
  nextPrice,
  whyNotBuy,
  LADDER,
  START_MONEY,
  TIERS,
  abandonEvent,
  closeChallenge,
  closeEvent,
  declineChallenge,
  dollars,
  factorFor,
  fieldFor,
  finishEvent,
  isUnlocked,
  newCareer,
  offerChallenge,
  openCup,
  placeIn,
  setTournament,
  settleChallenge,
  stakeFor,
  startEvent,
  whyNot,
  type Career,
  type TierId,
} from "./career";
import { nextPlayable, recordKnockoutResult } from "./knockout";
import { matchParticipants } from "./tournament";

const AT = "2026-10-28T20:00:00.000Z";
const fresh = (level = "dyktig") => newCareer("Lars", level, AT);
const rich = (money = 100000, qualified: TierId[] = []) => ({ ...fresh(), money, qualified });
const entered = (c: Career = fresh(), tier: TierId = "lu", seed = 7) => {
  const started = startEvent(c, tier, seed);
  return openCup(started, started.active!.entrants, AT);
};

/** Plays the cup so that Lars wins `wins` matches and loses the next one (winning every round wins the cup). The others' matches go to the first name. */
function playOut(c: Career, wins: number): Career {
  let t = c.active!.tournament!;
  const rounds = Math.log2(TIERS[c.active!.tier].size);
  let won = 0;
  for (let guard = 0; guard < 40 && t.status !== "done"; guard++) {
    const m = nextPlayable(t);
    if (!m) break;
    const [a, b] = matchParticipants(m);
    const mine = a === "Lars" || b === "Lars";
    const winner = mine ? (won < wins ? "Lars" : a === "Lars" ? b : a) : a;
    const loser = winner === a ? b : a;
    if (mine && winner === "Lars") won++;
    t = recordKnockoutResult(t, m.id, [winner, loser], {});
    if (mine && winner !== "Lars" && wins < rounds) break;
  }
  return setTournament(c, t);
}

describe("newCareer", () => {
  it("starts with the money, the level and the place asked for", () => {
    const c = newCareer("Lars", "sterk", AT, { home: "loft", darts: "tunge" });
    expect(c).toMatchObject({ id: "lars", player: "Lars", skillMed: 30, money: START_MONEY, points: 0, titles: 0, active: null, qualified: [], challenge: null, profile: { home: "loft", darts: "tunge" } });
  });
});

describe("dollars", () => {
  it("writes money as dollars, with a minus for what is owed", () => {
    expect(dollars(50)).toBe("$50");
    expect(dollars(1250).replace(/\s/g, " ")).toBe("$1 250");
    expect(dollars(-50)).toBe("−$50");
  });
});

describe("the ladder", () => {
  it("goes from the pub to the world championship, each step bigger and dearer than the last", () => {
    expect(LADDER.map((t) => t.id)).toEqual(["lu", "region", "nm", "gs", "vm"]);
    for (let i = 1; i < LADDER.length; i++) {
      expect(LADDER[i].fee).toBeGreaterThan(LADDER[i - 1].fee);
      expect(LADDER[i].prizes.winner!).toBeGreaterThan(LADDER[i - 1].prizes.winner!);
      expect(LADDER[i].scale).toBeGreaterThan(LADDER[i - 1].scale);
    }
  });

  it("makes the pub free and pays the first, second and semifinalists there", () => {
    expect(TIERS.lu.fee).toBe(0);
    expect(TIERS.lu.prizes).toEqual({ winner: 500, final: 300, semi: 200 });
  });

  it("leaves the pub and the regional championship open, and the rest to qualify for", () => {
    const c = rich();
    expect(isUnlocked(c, TIERS.lu)).toBe(true);
    expect(isUnlocked(c, TIERS.region)).toBe(true);
    for (const id of ["nm", "gs", "vm"] as const) {
      expect(isUnlocked(c, TIERS[id])).toBe(false);
      expect(whyNot(c, TIERS[id])).toBe(TIERS[id].qualify);
      expect(startEvent(c, id, 1)).toBe(c);
    }
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

  it.each(LADDER.map((t) => [t.id, t.size] as const))("has the right number of different names at %s (%i)", (id, size) => {
    const field = fieldFor(fresh(), TIERS[id], 11);
    expect(field).toHaveLength(size);
    expect(new Set(field.map((e) => e.name)).size).toBe(size);
    expect(field.filter((e) => !e.isBot)).toHaveLength(1);
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

  it("is a little sharper at each step up to Grand Slam, and the world championship gets sharper after every world title", () => {
    const c = fresh("klubb");
    const f = (id: TierId, cc: Career = c) => factorFor(cc, TIERS[id]);
    expect(f("lu")).toBeGreaterThan(f("region"));
    expect(f("region")).toBeGreaterThan(f("nm"));
    expect(f("nm")).toBeGreaterThan(f("gs"));
    expect(f("vm", { ...c, worldTitles: 4 })).toBeLessThan(f("vm"));
    expect(f("vm", { ...c, worldTitles: 40 })).toBeGreaterThan(0.85);
  });

  it("puts the strongest first, the player where their own level puts them", () => {
    const field = fieldFor(fresh(), TIERS.lu, 7);
    const strength = field.map((e) => (e.isBot ? e.skill! : levelOfMed(37)));
    expect(strength).toEqual([...strength].sort((a, b) => a - b));
  });
});

describe("signing up", () => {
  it("is free at the pub, so a career can never get stuck", () => {
    const broke = { ...fresh(), money: 0 };
    const c = startEvent(broke, "lu", 1);
    expect(c.money).toBe(0);
    expect(c.active).toMatchObject({ cost: 0, tournament: null, result: null, tier: "lu" });
    expect(c.active!.entrants).toHaveLength(8);
    expect(c.active!.cup).toMatchObject({ kind: "lu", name: "Lü-cupen", career: true });
    expect(startEvent(c, "lu", 2)).toBe(c);
  });

  it("costs the fee at the regional championship, and needs the money", () => {
    const c = startEvent(rich(500), "region", 1);
    expect(c.money).toBe(300);
    expect(c.active).toMatchObject({ cost: 200, tier: "region" });
    expect(c.active!.entrants).toHaveLength(16);
    const poor = { ...fresh(), money: 150 };
    expect(whyNot(poor, TIERS.region)).toBe("Du mangler $50 i inngang");
    expect(startEvent(poor, "region", 1)).toBe(poor);
  });

  it("will not take a second event while one is going", () => {
    const c = startEvent(fresh(), "lu", 1);
    expect(whyNot(c, TIERS.region)).toBe("Du har en turnering som pågår");
  });

  it("opens the cup from the draw, a knockout with the cup in it", () => {
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
  ] as const)("at the pub, wins %i matches and is %s", (wins, place) => {
    const c = playOut(entered(), wins);
    expect(placeIn(c.active!.tournament!, "Lars")).toBe(place);
  });

  it.each([
    [0, "r16"],
    [1, "quarter"],
    [2, "semi"],
    [3, "final"],
    [4, "winner"],
  ] as const)("with sixteen, wins %i matches and is %s", (wins, place) => {
    const c = playOut(entered(rich(), "region"), wins);
    expect(placeIn(c.active!.tournament!, "Lars")).toBe(place);
  });

  it("with thirty-two, goes out in the round of thirty-two at once", () => {
    const c = playOut(entered(rich(100000, ["vm"]), "vm"), 0);
    expect(placeIn(c.active!.tournament!, "Lars")).toBe("r32");
  });
});

describe("paying out", () => {
  it("ends the event for a player who is out, with the rest played and nothing won", () => {
    const c = finishEvent(playOut(entered(), 0), AT);
    expect(c.active!.tournament!.status).toBe("done");
    expect(c.active!.result).toMatchObject({ place: "quarter", prize: 0, cost: 0, points: 1 });
    expect(c.money).toBe(START_MONEY);
    expect(c.points).toBe(1);
    expect(c.played).toBe(1);
    expect(c.titles).toBe(0);
  });

  it("pays the winner of the pub $500 and counts the title", () => {
    const c = finishEvent(playOut(entered(), 3), AT);
    expect(c.active!.result).toMatchObject({ place: "winner", prize: 500, points: 10 });
    expect(c.money).toBe(START_MONEY + 500);
    expect(c.titles).toBe(1);
    expect(c.history[0]).toMatchObject({ event: "Lü-cupen", place: "winner" });
  });

  it("pays $300 for second and $200 for the semifinal at the pub", () => {
    expect(finishEvent(playOut(entered(), 2), AT).active!.result).toMatchObject({ place: "final", prize: 300 });
    expect(finishEvent(playOut(entered(), 1), AT).active!.result).toMatchObject({ place: "semi", prize: 200 });
  });

  it("pays more at a bigger step, after the fee", () => {
    const c = finishEvent(playOut(entered(rich(1000), "region"), 4), AT);
    expect(c.active!.result).toMatchObject({ place: "winner", prize: 2500, cost: 200 });
    expect(c.money).toBe(1000 - 200 + 2500);
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
    const c = abandonEvent(entered(rich(1000), "region"));
    expect(c.active).toBeNull();
    expect(c.money).toBe(800);
    expect(c.history).toHaveLength(0);
  });
});

describe("qualifying", () => {
  const after = (tier: TierId, wins: number, qualified: TierId[] = []) => finishEvent(playOut(entered(rich(100000, qualified), tier), wins), AT);

  it("opens the national championship for the best four of the regional one", () => {
    expect(after("region", 4).qualified).toEqual(["nm"]);
    expect(after("region", 3).qualified).toEqual(["nm"]);
    expect(after("region", 2).qualified).toEqual(["nm"]);
    expect(after("region", 1).qualified).toEqual([]);
  });

  it("opens Grand Slam for the winner of the national championship only", () => {
    expect(after("nm", 4, ["nm"]).qualified).toEqual(["gs"]);
    expect(after("nm", 3, ["nm"]).qualified).toEqual([]);
  });

  it("opens the world championship for the first or second of Grand Slam", () => {
    expect(after("gs", 4, ["gs"]).qualified).toEqual(["vm"]);
    expect(after("gs", 3, ["gs"]).qualified).toEqual(["vm"]);
    expect(after("gs", 2, ["gs"]).qualified).toEqual([]);
  });

  it("is for one entry: signing up spends it", () => {
    const c = rich(100000, ["nm"]);
    expect(isUnlocked(c, TIERS.nm)).toBe(true);
    const entered = startEvent(c, "nm", 3);
    expect(entered.qualified).toEqual([]);
    expect(entered.money).toBe(100000 - 750);
    expect(isUnlocked(abandonEvent(entered), TIERS.nm)).toBe(false);
  });

  it("does not hand out the same qualification twice", () => {
    const c = after("region", 4, ["nm"]);
    expect(c.qualified.filter((q) => q === "nm")).toHaveLength(1);
  });

  it("counts a world title, and makes the next field sharper", () => {
    const c = after("vm", 5, ["vm"]);
    expect(c.titles).toBe(1);
    expect(c.worldTitles).toBe(1);
    expect(c.money).toBe(100000 - 10000 + 150000);
  });
});

describe("challenges", () => {
  it("is offered in a game of the player's choice, against one of the field, for a stake", () => {
    for (const game of Object.keys(GAMES) as (keyof typeof GAMES)[]) {
      const c = offerChallenge(fresh(), game, 4);
      expect(c.challenge).toMatchObject({ game, won: null });
      expect(c.challenge!.stake).toBe(stakeFor(fresh(), game));
      expect(c.challenge!.opponent.name).not.toBe("Lars");
      expect(c.challenges).toBe(1);
    }
  });

  it("is one at a time, and not while a cup is going", () => {
    const c = offerChallenge(fresh(), "501", 1);
    expect(offerChallenge(c, "lava", 2)).toBe(c);
    const going = startEvent(fresh(), "lu", 1);
    expect(offerChallenge(going, "501", 1)).toBe(going);
  });

  it("is worth more further up the ladder", () => {
    expect(stakeFor(rich(0, ["vm"]), "501")).toBeGreaterThan(stakeFor(fresh(), "501"));
    expect(stakeFor(fresh(), "501")).toBeGreaterThanOrEqual(100);
  });

  it("pays the stake to the winner and nothing is lost by losing", () => {
    const offered = offerChallenge(fresh(), "501", 1);
    const won = settleChallenge(offered, true, AT);
    expect(won.money).toBe(START_MONEY + offered.challenge!.stake);
    expect(won.challenge!.won).toBe(true);
    expect(won.history[0]).toMatchObject({ game: "501", won: true, prize: offered.challenge!.stake });
    const lost = settleChallenge(offered, false, AT);
    expect(lost.money).toBe(START_MONEY);
    expect(lost.challenge!.won).toBe(false);
  });

  it("settles once, and is cleared when taken in or turned down", () => {
    const won = settleChallenge(offerChallenge(fresh(), "lava", 1), true, AT);
    expect(settleChallenge(won, true, AT)).toBe(won);
    expect(closeChallenge(won).challenge).toBeNull();
    expect(declineChallenge(won)).toBe(won);
    const offered = offerChallenge(fresh(), "lava", 1);
    expect(closeChallenge(offered)).toBe(offered);
    expect(declineChallenge(offered).challenge).toBeNull();
  });

  it("does not need to be won to carry on: no career can be stuck", () => {
    expect(whyNot({ ...fresh(), money: 0 }, TIERS.lu)).toBeNull();
  });
});

describe("the home arena", () => {
  it("starts with nothing bought and no effect on the opponents", () => {
    const c = fresh();
    expect(c.arena).toEqual({ wall: 0, floor: 0, board: 0, light: 0, decor: 0, crowd: 0 });
    expect(arenaSteps(c)).toBe(0);
    expect(arenaBonus(c)).toBe(1);
  });

  it("sells each thing in three steps, dearer each time", () => {
    for (const slot of SLOTS) {
      expect(slot.steps).toHaveLength(4);
      expect(slot.prices[1]).toBeGreaterThan(slot.prices[0]);
      expect(slot.prices[2]).toBeGreaterThan(slot.prices[1]);
    }
  });

  it("takes the money and lifts the step", () => {
    const c = buyUpgrade(rich(1000), "light");
    expect(c.money).toBe(1000 - SLOTS.find((s) => s.id === "light")!.prices[0]);
    expect(c.arena.light).toBe(1);
    expect(nextPrice(c, "light")).toBe(SLOTS.find((s) => s.id === "light")!.prices[1]);
  });

  it("will not sell what there is no money for, and nothing past the third step", () => {
    const poor = { ...fresh(), money: 10 };
    expect(whyNotBuy(poor, "wall")).toMatch(/^Du mangler/);
    expect(buyUpgrade(poor, "wall")).toBe(poor);
    let c = rich(1000000);
    for (let i = 0; i < 3; i++) c = buyUpgrade(c, "crowd");
    expect(c.arena.crowd).toBe(3);
    expect(whyNotBuy(c, "crowd")).toBe("Fullt utbygd");
    expect(nextPrice(c, "crowd")).toBeNull();
    expect(buyUpgrade(c, "crowd")).toBe(c);
  });

  it("makes the opponents weaker, a little for each step, and 14 % when everything is bought", () => {
    let c = rich(1000000);
    const before = arenaBonus(c);
    c = buyUpgrade(c, "board");
    expect(arenaBonus(c)).toBeGreaterThan(before);
    for (const slot of SLOTS) for (let i = 0; i < 3; i++) c = buyUpgrade(c, slot.id);
    expect(arenaSteps(c)).toBe(18);
    expect(arenaBonus(c)).toBeCloseTo(1.144, 3);
    const mean = (cc: Career) => {
      const bots = fieldFor(cc, TIERS.region, 9).filter((e) => e.isBot);
      return bots.reduce((s, b) => s + b.skill!, 0) / bots.length;
    };
    expect(mean(c)).toBeGreaterThan(mean(rich(1000000)));
  });
});
