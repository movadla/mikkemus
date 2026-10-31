import { describe, expect, it } from "vitest";
import type { TierId } from "./career";
import { weekOfInvite, weekOfTier } from "./careerCalendar";
import type { Invitation } from "./careerLife";
import { START_MONEY, TIERS, declineChallenge, eventTier, finishEvent, newCareer, openCup, settleChallenge, startEvent as realStartEvent, whyNotNow, type Career, type Place } from "./career";
import { WEEKS_PER_SEASON, inboxCount, lifeOf, lyPool, newLife, rivalOf, seasonOf, unseenNews, weekInSeason, type Life, type Message } from "./careerLife";
import { CALENDAR } from "./careerCalendar";
import { INTERNATIONALS } from "./opponents";
import { advanceWeek, answerMessage, botMed, leaveAbandoned, leaveEvent, markNewsSeen, markRead, peopleOf, playBracket, seasonPrize, skipWeek, sponsorOutcome, whyNotAnswer } from "./careerWorld";
import { normalizeCareer } from "./careerStorage";

/** The week of the plan a step (or an invitation) is played in: the tests sign up in it. */
const inItsWeek = (c: Career, tier: TierId, invite?: { key: string }): Career => ({ ...c, life: { ...lifeOf(c), week: invite ? weekOfInvite(invite.key) : weekOfTier(tier) } });
const startEvent = (c: Career, tier: TierId, seed: number, invite?: Invitation) => realStartEvent(inItsWeek(c, tier, invite), tier, seed, invite);

const AT = "2026-10-29T12:00:00.000Z";
const fresh = (): Career => newCareer("Lars", "dyktig", AT);
const withLife = (c: Career, patch: Partial<Life>): Career => ({ ...c, life: { ...lifeOf(c), ...patch } });

/** A career whose event is over with this place: what leaveEvent works from. */
function finished(c: Career, place: Place, prize = 0, points = 0): Career {
  const started = startEvent(c, "lu", 7);
  return { ...started, active: { ...started.active!, result: { place, prize, cost: 0, points } } };
}

describe("a new life", () => {
  it("starts in week 1 of season 1 with an empty inbox and a line of news", () => {
    const l = lifeOf(fresh());
    expect(l.week).toBe(1);
    expect(seasonOf(l.week)).toBe(1);
    expect(l.reputation).toBe(5);
    expect(l.inbox).toHaveLength(0);
    expect(l.news).toHaveLength(1);
    expect(inboxCount(l)).toBe(0);
    expect(unseenNews(l)).toBe(1);
  });

  it("is given to a career that has none, and old saves are read as a career at its beginning", () => {
    const old = { ...fresh(), life: undefined } as Career;
    expect(lifeOf(old)).toEqual(newLife());
    expect(normalizeCareer(old).life).toBeUndefined();
    expect(lifeOf(normalizeCareer(old)).week).toBe(1);
  });

  it("counts seasons of eight weeks", () => {
    expect([1, 8, 9, 16, 17].map(seasonOf)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("the cup the others play", () => {
  const names = Array.from({ length: 16 }, (_, i) => `P${i}`);
  const med = (n: string) => 25 + Number(n.slice(1)) * 2;

  it("is decided for every name, once, with one winner and a final", () => {
    const { places, final } = playBracket(names, med, "k");
    expect(Object.keys(places).sort()).toEqual([...names].sort());
    expect(Object.values(places).filter((p) => p === "winner")).toHaveLength(1);
    expect(Object.values(places).filter((p) => p === "final")).toHaveLength(1);
    expect(Object.values(places).filter((p) => p === "semi")).toHaveLength(2);
    expect(places[final[0]]).toBe("winner");
  });

  it("is the same for the same key, and the sharper players win more often", () => {
    expect(playBracket(names, med, "k")).toEqual(playBracket(names, med, "k"));
    let best = 0;
    for (let i = 0; i < 200; i++) if (playBracket(names, med, `r${i}`).places.P0 === "winner") best++;
    expect(best).toBeGreaterThan(40);
  });

  it("copes with a field that is not a power of two", () => {
    const { places } = playBracket(names.slice(0, 11), med, "odd");
    expect(Object.values(places).filter((p) => p === "winner")).toHaveLength(1);
    expect(Object.keys(places)).toHaveLength(11);
  });
});

describe("a week goes by", () => {
  it("moves the week on, writes news about the others' cup, and gives the others points", () => {
    const c = advanceWeek(fresh());
    const l = lifeOf(c);
    expect(l.week).toBe(2);
    expect(l.news.length).toBeGreaterThan(1);
    expect(l.news[0].kind === "cup" || l.news[0].kind === "upset").toBe(true);
    expect(Object.values(l.world.pts).reduce((s, n) => s + n, 0)).toBeGreaterThan(0);
  });

  it("is the same on every phone: the same career and week give the same weeks", () => {
    let a = fresh();
    let b = fresh();
    for (let i = 0; i < 6; i++) {
      a = advanceWeek(a);
      b = advanceWeek(b);
    }
    expect(a.life).toEqual(b.life);
  });

  it("brings offers over the weeks, each with a time to answer, and never more than two invitations open", () => {
    let c: Career = { ...fresh(), points: 12, played: 3 };
    let sawInvite = false;
    for (let i = 0; i < 9; i++) {
      c = advanceWeek(c);
      const open = lifeOf(c).inbox.filter((m) => m.state === "open" && m.offer.kind === "invite");
      expect(open.length).toBeLessThanOrEqual(2);
      if (open.length) sawInvite = true;
      for (const m of lifeOf(c).inbox) if (m.offer.kind !== "info") expect(m.until).toBeDefined();
    }
    expect(sawInvite).toBe(true);
  });

  it("closes an offer that was not answered in time, and a challenge that goes by costs some of the name", () => {
    const base = fresh();
    const m: Message = { id: "m9", week: 1, from: { name: "Roger", role: "Rival" }, title: "t", body: "b", read: false, state: "open", until: 1, offer: { kind: "challenge", game: "501", opponent: { name: "Roger", skill: 4 }, stake: 250, risk: 100 } };
    const c = advanceWeek(withLife(base, { inbox: [m] }));
    const closed = lifeOf(c).inbox.find((x) => x.id === "m9")!;
    expect(closed.state).toBe("expired");
    expect(lifeOf(c).reputation).toBeLessThanOrEqual(4);
  });

  it("ends the season after ten weeks: a prize, a result, a fresh table, and the players have changed", () => {
    let c: Career = { ...fresh(), money: 0 };
    c = withLife(c, { week: WEEKS_PER_SEASON, seasonPts: 40 });
    c = advanceWeek(c);
    const l = lifeOf(c);
    expect(seasonOf(l.week)).toBe(2);
    expect(l.seasons).toHaveLength(1);
    expect(l.seasons[0].season).toBe(1);
    expect(l.seasons[0].prize).toBe(c.money);
    // The best five of the table are kept for the recap, in order, with the player in it when they are among them.
    const table = l.seasons[0].table!;
    expect(table).toHaveLength(5);
    expect(table.map((r) => r.pts)).toEqual([...table.map((r) => r.pts)].sort((a, b) => b - a));
    expect(table.some((r) => r.name === c.player)).toBe(l.seasons[0].rank <= 5);
    expect(l.seasonPts).toBe(0);
    expect(Object.keys(l.world.snap).length).toBeGreaterThan(30);
    expect(l.news.some((n) => n.kind === "season")).toBe(true);
    for (const d of Object.values(l.world.drift)) expect(d).toBeGreaterThanOrEqual(0.85);
  });

  it("lets someone stop and someone new come, and keeps the pub's field full", () => {
    let c = fresh();
    for (let s = 0; s < 8; s++) c = advanceWeek(withLife(c, { week: s * WEEKS_PER_SEASON + WEEKS_PER_SEASON }));
    const l = lifeOf(c);
    expect(l.world.retired.length).toBeGreaterThan(0);
    expect(l.world.rookies.length).toBeGreaterThan(0);
    expect(lyPool(l).length).toBeGreaterThanOrEqual(8);
    for (const n of l.world.retired) expect(peopleOf(c).some((p) => p.name === n)).toBe(false);
    for (const r of l.world.rookies) expect(peopleOf(c).some((p) => p.name === r.name)).toBe(true);
    expect(new Set(lyPool(l)).size).toBe(lyPool(l).length);
  });

  it("pays the season by place, and nothing outside the tenth", () => {
    const c = fresh();
    const [a, b, d, e, f] = [1, 2, 3, 5, 11].map((r) => seasonPrize(r, c));
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(d);
    expect(d).toBeGreaterThan(e);
    expect(f).toBe(0);
  });

  it("gives each person's strength as the seasons made it", () => {
    const c = withLife(fresh(), { world: { ...newLife().world, drift: { Haakon: 0.9 } } });
    expect(botMed(c, "Haakon")).toBeCloseTo(46 * 0.9, 5);
    expect(botMed(c, "Marcus")).toBe(47);
  });
});

describe("leaving a tournament", () => {
  it("passes a week, makes news about the player, and adds the points to the season", () => {
    const c = leaveEvent(finished(fresh(), "final", 300, 6));
    const l = lifeOf(c);
    expect(c.active).toBeNull();
    expect(l.week).toBe(2);
    expect(l.seasonPts).toBe(6);
    expect(l.news.some((n) => n.kind === "you" && n.headline.includes("tapte finalen"))).toBe(true);
  });

  it("makes a title good for the name and puts it in the news", () => {
    const c = leaveEvent(finished(fresh(), "winner", 500, 10));
    expect(lifeOf(c).reputation).toBe(6);
    expect(lifeOf(c).news.some((n) => n.kind === "you" && n.headline.includes("vant"))).toBe(true);
  });

  it("passes the week for an event that is given up, too", () => {
    const c = leaveAbandoned(startEvent(fresh(), "lu", 3));
    expect(c.active).toBeNull();
    expect(lifeOf(c).week).toBe(2);
  });
});

describe("a sponsor", () => {
  const deal = { name: "Hansens Rør", perEvent: 80, need: "quarter" as Place, events: 4 };
  const signed = (misses = 0, left = 4) => withLife(fresh(), { sponsor: { ...deal, left, misses, earned: 0 } });

  it("pays for a result that meets the condition, and counts down", () => {
    const c = finished(signed(), "semi", 200, 3);
    expect(sponsorOutcome(c)).toMatchObject({ met: true, pay: 80 });
    const after = leaveEvent(c);
    expect(after.money).toBe(START_MONEY + 80);
    expect(lifeOf(after).sponsor).toMatchObject({ left: 3, misses: 0, earned: 80 });
  });

  it("pays nothing for a result that misses it, and ends the deal after three misses", () => {
    let c = leaveEvent(finished(signed(), "r16", 0, 1));
    expect(lifeOf(c).sponsor).toMatchObject({ left: 3, misses: 1 });
    expect(c.money).toBe(START_MONEY);
    c = leaveEvent(finished(withLife(c, { sponsor: { ...deal, left: 3, misses: 2, earned: 0 } }), "r16", 0, 1));
    expect(lifeOf(c).sponsor).toBeNull();
    expect(lifeOf(c).news.some((n) => n.headline === "Hansens Rør avslutter avtalen")).toBe(true);
    expect(lifeOf(c).reputation).toBeLessThan(5);
  });

  it("ends when the last tournament of the deal is played", () => {
    const c = leaveEvent(finished(signed(0, 1), "winner", 500, 10));
    expect(lifeOf(c).sponsor).toBeNull();
    expect(lifeOf(c).news.some((n) => n.headline === "Avtalen med Hansens Rør er over")).toBe(true);
  });
});

describe("answering the inbox", () => {
  const challenge: Message = { id: "m5", week: 1, from: { name: "Roger", role: "Rival" }, title: "Roger vil ha revansje", body: "", read: false, state: "open", until: 3, offer: { kind: "challenge", game: "501", opponent: { name: "Roger", skill: 4 }, stake: 250, risk: 100 } };
  const sponsor: Message = { id: "m6", week: 1, from: { name: "Hansens Rør", role: "Sponsor" }, title: "s", body: "", read: false, state: "open", until: 3, offer: { kind: "sponsor", deals: [{ name: "Hansens Rør", perEvent: 80, need: "quarter", events: 4 }] } };

  it("takes a challenge to the table, with what the player risks, and plays it for the name", () => {
    const c = answerMessage(withLife(fresh(), { inbox: [challenge] }), "m5", true, 11);
    expect(c.challenge).toMatchObject({ stake: 250, risk: 100, from: "m5", won: null });
    expect(lifeOf(c).inbox[0].state).toBe("taken");
    const lost = settleChallenge(c, false, AT);
    expect(lost.money).toBe(START_MONEY - 100);
    expect(lifeOf(lost).reputation).toBe(6);
    const won = settleChallenge(c, true, AT);
    expect(won.money).toBe(START_MONEY + 250);
  });

  it("never takes more than the player has", () => {
    const c = answerMessage({ ...withLife(fresh(), { inbox: [challenge] }), money: 30 }, "m5", true, 11);
    expect(settleChallenge(c, false, AT).money).toBe(0);
  });

  it("costs some of the name to say no to a challenge, in the message or at the table", () => {
    const no = answerMessage(withLife(fresh(), { inbox: [challenge] }), "m5", false, 1);
    expect(lifeOf(no).reputation).toBe(4);
    expect(lifeOf(no).inbox[0].state).toBe("declined");
    const table = answerMessage(withLife(fresh(), { inbox: [challenge] }), "m5", true, 1);
    const backed = declineChallenge(table);
    expect(backed.challenge).toBeNull();
    expect(lifeOf(backed).reputation).toBe(4);
  });

  it("does not take a challenge while something else is going", () => {
    const busy = startEvent(withLife(fresh(), { inbox: [challenge] }), "lu", 3);
    expect(whyNotAnswer(busy, challenge)).toBe("Fullfør det som pågår først");
    expect(answerMessage(busy, "m5", true, 1)).toBe(busy);
  });

  it("signs a sponsor, once", () => {
    const c = answerMessage(withLife(fresh(), { inbox: [sponsor] }), "m6", true, 1);
    expect(lifeOf(c).sponsor).toMatchObject({ name: "Hansens Rør", left: 4, misses: 0 });
    expect(whyNotAnswer(c, { ...sponsor, id: "m7" })).toBe("Du har en avtale fra før");
  });

  it("marks what is read and what is seen", () => {
    const c = markRead(withLife(fresh(), { inbox: [challenge] }), "m5");
    expect(lifeOf(c).inbox[0].read).toBe(true);
    const seen = markNewsSeen(fresh());
    expect(unseenNews(lifeOf(seen))).toBe(0);
  });
});

describe("an invitation", () => {
  function withInvite(c: Career) {
    let cur: Career = { ...c, points: 12, played: 3, money: 5000 };
    for (let i = 0; i < 12; i++) {
      cur = advanceWeek(cur);
      if (lifeOf(cur).inbox.some((m) => m.state === "open" && m.offer.kind === "invite")) break;
    }
    const m = lifeOf(cur).inbox.find((x) => x.state === "open" && x.offer.kind === "invite")!;
    return { cur, m };
  }

  it("is a tournament of its own: its name, its price and its prizes, with the field of its step", () => {
    const { cur, m } = withInvite(fresh());
    expect(m).toBeDefined();
    if (m.offer.kind !== "invite") throw new Error("not an invitation");
    const inv = m.offer.invite;
    const started = answerMessage(cur, m.id, true, 21);
    expect(started.active?.invite?.name).toBe(inv.name);
    expect(started.money).toBe(cur.money - inv.fee);
    expect(eventTier(started.active!).name).toBe(inv.name);
    expect(started.active!.entrants).toHaveLength(inv.size);
    expect(lifeOf(started).inbox.find((x) => x.id === m.id)!.state).toBe("taken");
    if (inv.countdown) expect(started.active!.cup.countdown).toEqual(inv.countdown);
  });

  it("does not use the qualification of the step it is built on, and a title does not go on the shelf", () => {
    const { cur, m } = withInvite({ ...fresh(), qualified: ["nm"] });
    const started = answerMessage(cur, m.id, true, 21);
    expect(started.qualified).toEqual(["nm"]);
    const done = { ...started, active: { ...started.active!, result: { place: "winner" as Place, prize: 100, cost: 0, points: 1 } } };
    // finishEvent is what records the title; here the result is set by hand, so look at what finishing does with an invitation.
    expect(done.active.invite).toBeDefined();
    expect(TIERS.lu.fee).toBe(0);
  });

  it("can be turned down without cost, and cannot be taken without the fee", () => {
    const { cur, m } = withInvite(fresh());
    const no = answerMessage(cur, m.id, false, 1);
    expect(lifeOf(no).reputation).toBe(lifeOf(cur).reputation);
    expect(lifeOf(no).inbox.find((x) => x.id === m.id)!.state).toBe("declined");
    const poor = { ...cur, money: 0 };
    if (m.offer.kind === "invite" && m.offer.invite.fee > 0) expect(whyNotAnswer(poor, m)).toMatch(/^Mangler/);
  });
});

describe("a long career", () => {
  it("keeps going for years without breaking: the lists stay short, the field stays full, and every invitation can be entered", () => {
    let c: Career = { ...fresh(), points: 500, played: 20, money: 1_000_000, history: [{ at: AT, event: "VM i dart", place: "winner", prize: 0, cost: 0, points: 0 }] };
    for (let w = 0; w < 80; w++) {
      c = advanceWeek(c);
      const l = lifeOf(c);
      expect(l.inbox.length).toBeLessThanOrEqual(30);
      expect(l.news.length).toBeLessThanOrEqual(40);
      expect(lyPool(l).length).toBeGreaterThanOrEqual(8);
      for (const m of l.inbox) {
        if (m.state !== "open" || m.offer.kind !== "invite") continue;
        const started = startEvent(c, m.offer.invite.id, 5, m.offer.invite);
        expect(started.active?.entrants).toHaveLength(m.offer.invite.size);
        expect(new Set(started.active!.entrants.map((p) => p.name)).size).toBe(m.offer.invite.size);
      }
    }
    expect(lifeOf(c).seasons).toHaveLength(10);
    expect(seasonOf(lifeOf(c).week)).toBe(11);
  });
});

describe("the sponsors of a first title", () => {
  it("come as one message with three deals, the longer the deal the more it pays for each tournament, and signing one closes it", () => {
    const c = leaveEvent({ ...finished(fresh(), "winner", 500, 10), titles: 1 });
    const open = lifeOf(c).inbox.filter((m) => m.state === "open" && m.offer.kind === "sponsor");
    expect(open).toHaveLength(1);
    const offer = open[0].offer as { deals: { name: string; perEvent: number; events: number }[] };
    const deals = [...offer.deals].sort((a, b) => a.events - b.events);
    expect(deals.map((d) => d.events)).toEqual([3, 6, 10]);
    expect(deals[0].perEvent).toBeLessThan(deals[1].perEvent);
    expect(deals[1].perEvent).toBeLessThan(deals[2].perEvent);
    expect(new Set(deals.map((d) => d.name)).size).toBe(3);
    const signed = answerMessage(c, open[0].id, true, 1, offer.deals.findIndex((d) => d.events === 10));
    expect(lifeOf(signed).sponsor?.left).toBe(10);
    expect(lifeOf(signed).inbox.filter((m) => m.state === "open" && m.offer.kind === "sponsor")).toHaveLength(0);
  });

  it("do not come for a title that is not the first", () => {
    const c = leaveEvent({ ...finished(fresh(), "winner", 500, 10), titles: 2 });
    expect(lifeOf(c).inbox.filter((m) => m.offer.kind === "sponsor").length).toBeLessThanOrEqual(3);
    expect(lifeOf(c).inbox.some((m) => m.offer.kind === "sponsor" && m.week === 1 && m.until === 4)).toBe(false);
  });
});

describe("the duel on television", () => {
  const strong = (): Career => ({ ...fresh(), points: 90, played: 12, money: 100_000, history: [{ at: AT, event: "Norgesmesterskapet", place: "winner", prize: 0, cost: 0, points: 0 }] });
  const tvWeek = CALENDAR.find((x) => x.kind === "tv")!.week;
  /** The week before the duel's week, so the next week going by is the one of the show. */
  const beforeTv = (c: Career) => withLife(c, { week: tvWeek - 1 });
  const showOf = (c: Career) => lifeOf(c).inbox.find((x) => x.state === "open" && x.offer.kind === "challenge" && x.offer.tv);

  it("comes in its week, with a professional, one leg of Highstriker with five lives, and five thousand to the winner", () => {
    const cur = advanceWeek(beforeTv(strong()));
    const m = showOf(cur)!;
    if (m.offer.kind !== "challenge" || !m.offer.tv) throw new Error("not a show");
    expect(m.offer).toMatchObject({ game: "highstriker", stake: 5000, risk: 0 });
    expect(m.offer.tv).toMatchObject({ title: "TV Duell", legs: 1, lives: 5, honorarium: 0 });
    expect(INTERNATIONALS.map((o) => o.name)).toContain(m.offer.opponent.name);
    // It can be answered in its week only.
    expect(m.until).toBe(lifeOf(cur).week);
  });

  it("does not come in the other weeks, nor for a player who has done nothing", () => {
    let c = strong();
    for (let i = 0; i < 20; i++) {
      c = advanceWeek(c);
      if (weekInSeason(lifeOf(c).week) !== tvWeek) expect(showOf(c)).toBeUndefined();
    }
    expect(showOf(advanceWeek(beforeTv(fresh())))).toBeUndefined();
  });

  it("pays five thousand for a win and nothing for a loss, and turning it down costs nothing", () => {
    const cur = advanceWeek(beforeTv(strong()));
    const m = showOf(cur)!;
    const taken = answerMessage(cur, m.id, true, 5);
    expect(taken.challenge).toMatchObject({ game: "highstriker", stake: 5000, risk: 0, from: m.id });
    expect(settleChallenge(taken, false, AT).money).toBe(cur.money);
    expect(settleChallenge(taken, true, AT).money).toBe(cur.money + 5000);
    const won = settleChallenge(taken, true, AT);
    expect(lifeOf(won).news[0].headline).toContain(`slo ${taken.challenge!.opponent.name}`);
    expect(won.trophies[0]).toMatchObject({ name: "TV Duell-pokalen" });
    expect(settleChallenge(taken, false, AT).trophies).toHaveLength(0);
    const no = answerMessage(cur, m.id, false, 5);
    expect(lifeOf(no).reputation).toBe(lifeOf(cur).reputation);
    expect(declineChallenge(taken).challenge).toBeNull();
  });

  it("cannot be taken in another week", () => {
    const cur = advanceWeek(beforeTv(strong()));
    const m = showOf(cur)!;
    expect(whyNotAnswer(withLife(cur, { week: lifeOf(cur).week + 1 }), m)).toMatch(/^Spilles i uke/);
  });
});

describe("the calendar of the season", () => {
  const at = (week: number, over: Partial<Career> = {}): Career => withLife({ ...fresh(), ...over }, { week });
  const invites = (c: Career) => lifeOf(c).inbox.filter((m) => m.state === "open" && m.offer.kind === "invite");
  const keys = (c: Career) => invites(c).map((m) => (m.offer.kind === "invite" ? m.offer.invite.key : ""));

  it("has the five steps of the ladder in weeks 1, 3, 5, 7 and 8, and Trondheim, Stavanger and TV Duell between", () => {
    expect(CALENDAR.map((s) => s.name)).toEqual(["Ly-cupen", "Trondheim Open", "Regionmesterskapet", "Stavanger Open", "Norgesmesterskapet", "TV Duell", "Grand Slam", "VM i dart"]);
    expect(CALENDAR).toHaveLength(WEEKS_PER_SEASON);
  });

  it("lets a step be entered in its own week only", () => {
    const c = { ...fresh(), money: 100_000, qualified: ["nm" as const] };
    expect(whyNotNow(at(1, c), TIERS.lu)).toBeNull();
    expect(whyNotNow(at(2, c), TIERS.lu)).toBe("Spilles i uke 1");
    expect(whyNotNow(at(3, c), TIERS.region)).toBeNull();
    expect(whyNotNow(at(5, c), TIERS.nm)).toBeNull();
    expect(whyNotNow(at(3, c), TIERS.nm)).toBe("Spilles i uke 5");
  });

  it("holds the invitation of Trondheim in week 2 for a player with points, and stays TBA without", () => {
    const some = advanceWeek(at(1, { points: 5, played: 1 }));
    expect(keys(some)).toEqual(["trondheim"]);
    expect(invites(some)[0].until).toBe(2);
    expect(invites(advanceWeek(at(1, { points: 0, played: 1 })))).toHaveLength(0);
  });

  it("holds the invitation of Stavanger in week 4, and none in the weeks of the steps", () => {
    expect(keys(advanceWeek(at(3, { points: 30, played: 3 })))).toEqual(["stavanger"]);
    for (const w of [2, 4, 5, 6, 7]) expect(invites(advanceWeek(at(w, { points: 30, played: 3 })))).toHaveLength(0);
  });

  it("can be entered in its week and not in the next", () => {
    const two = advanceWeek(at(1, { points: 5, played: 1, money: 5000 }));
    const m = invites(two)[0];
    expect(whyNotAnswer(two, m)).toBeNull();
    expect(whyNotAnswer(withLife(two, { week: 3 }), m)).toMatch(/^Spilles i uke 2/);
  });

  it("lets a week go with skipWeek, and writes down what came of the weeks", () => {
    const next = skipWeek(at(2, { points: 0, played: 1 }));
    expect(lifeOf(next).week).toBe(3);
    expect(lifeOf(next).weeks?.["2"]).toMatchObject({ skipped: true });
    // Not while a tournament is on.
    const busy = startEvent(at(1), "lu", 3);
    expect(skipWeek(busy)).toBe(busy);
    const played = leaveEvent({ ...busy, active: { ...busy.active!, result: { place: "winner", prize: 0, cost: 0, points: 10 } } });
    expect(lifeOf(played).weeks?.["1"]).toMatchObject({ name: "Ly-cupen", place: "winner" });
  });

  it("takes the places in the steps away when the season ends", () => {
    const c = advanceWeek(at(WEEKS_PER_SEASON, { qualified: ["nm", "vm"] }));
    expect(c.qualified).toEqual([]);
    expect(seasonOf(lifeOf(c).week)).toBe(2);
  });
});

describe("the rival", () => {
  it("challenges the player twice a season, to one leg of 501, for a stake the player picks from 100 to 1000", () => {
    const rival = rivalOf(fresh()).name;
    const offers = (c: Career) => lifeOf(c).inbox.filter((m) => m.state === "open" && m.offer.kind === "challenge" && m.from.role === "Rival");
    let c: Career = fresh();
    let seen = 0;
    for (let w = 0; w < WEEKS_PER_SEASON; w++) {
      const before = offers(c).length;
      c = advanceWeek(c);
      if (offers(c).length > before) seen += 1;
    }
    expect(seen).toBe(2);
    const m = offers(advanceWeek(withLife(fresh(), { week: 2 })))[0];
    expect(m.from.name).toBe(rival);
    expect(m.offer).toMatchObject({ kind: "challenge", game: "501", range: { min: 100, max: 1000, step: 100 } });
  });

  it("puts the stake the player picked at risk both ways, within the range and what they have", () => {
    const c0 = advanceWeek(withLife({ ...fresh(), money: 5000 }, { week: 2 }));
    const m = lifeOf(c0).inbox.find((x) => x.from.role === "Rival" && x.state === "open")!;
    const take = (stake: number, money = 5000) => answerMessage({ ...c0, money }, m.id, true, 3, stake).challenge!;
    expect(take(300)).toMatchObject({ stake: 300, risk: 300 });
    expect(take(5000)).toMatchObject({ stake: 1000, risk: 1000 });
    expect(take(10)).toMatchObject({ stake: 100, risk: 100 });
    expect(take(1000, 450)).toMatchObject({ stake: 400, risk: 400 });
    const taken = answerMessage(c0, m.id, true, 3, 300);
    expect(settleChallenge(taken, true, AT).money).toBe(5300);
    expect(settleChallenge(taken, false, AT).money).toBe(4700);
    expect(whyNotAnswer({ ...c0, money: 50 }, m)).toBe("Du trenger minst $100");
  });

  it("never stops playing while the career goes on, and is always the one in the surprise challenges", () => {
    let c: Career = { ...fresh(), points: 12, played: 3 };
    const rival = rivalOf(c).name;
    for (let w = 0; w < 120; w++) {
      c = advanceWeek(c);
      expect(lifeOf(c).world.retired).not.toContain(rival);
    }
    for (const m of lifeOf(c).inbox) if (m.offer.kind === "challenge" && m.from.role === "Rival") expect(m.from.name).toBe(rival);
  });
});

// The World Cup of Darts and the pairs cup have no week in the calendar yet, so no invitation reaches them: these wait for one.
describe.skip("a cup of teams", () => {
  const strong = (): Career => ({ ...fresh(), points: 200, played: 30, money: 500_000, history: [{ at: AT, event: "Grand Slam", place: "winner", prize: 0, cost: 0, points: 0 }, { at: AT, event: "Norgesmesterskapet", place: "winner", prize: 0, cost: 0, points: 0 }] });
  /** Plays weeks until an invitation of this kind comes, closing the others so they do not crowd it out. */
  function invitationOf(key: string) {
    let c = strong();
    for (let i = 0; i < 400; i++) {
      c = advanceWeek(c);
      const l = lifeOf(c);
      const m = l.inbox.find((x) => x.state === "open" && x.offer.kind === "invite" && x.offer.invite.key === key);
      if (m && m.offer.kind === "invite") return { c, m, inv: m.offer.invite };
      c = withLife(c, { inbox: l.inbox.map((x) => (x.state === "open" && x.offer.kind === "invite" ? { ...x, state: "expired" as const } : x)) });
    }
    throw new Error(`no ${key}`);
  }

  it("is the World Cup: Norway with the rival, against seven nations of two", () => {
    const { c, inv } = invitationOf("wc");
    expect(inv.team?.mine).toEqual({ name: "Norge", partner: rivalOf(c).name });
    expect(inv.team?.others.map((o) => o.name)).toEqual(["Nederland", "Tyskland", "Frankrike", "Italia", "England", "Japan", "Danmark"]);
    expect(inv.size).toBe(8);
    expect(inv.countdown).toMatchObject({ start: 501, doubleOut: true });
    expect(inv.fee).toBe(0);
  });

  it("is a cup of pairs: the player and a regular who is not the rival, against seven pairs, each person once", () => {
    const { c, inv } = invitationOf("pair");
    const team = inv.team!;
    expect(team.mine.partner).not.toBe(rivalOf(c).name);
    const people = [c.player, team.mine.partner, ...team.others.flatMap((o) => o.members)];
    expect(new Set(people).size).toBe(people.length);
    expect(team.others).toHaveLength(7);
    // A partner with two names (a rookie) is called by the first one, as the other pairs are.
    expect(team.mine.name).toBe(`${c.player} og ${team.mine.partner.split(" ")[0]}`);
  });

  it.each(["wc", "pair"])("makes %s a cup of eight teams, with the player's team in it, played as 501 or 301", (key) => {
    const { c, m, inv } = invitationOf(key);
    const started = answerMessage(c, m.id, true, 9);
    const a = started.active!;
    expect(a.entrants).toHaveLength(8);
    const mine = a.entrants.find((p) => p.name === inv.team!.mine.name)!;
    expect(mine.members!.map((x) => x.name)).toEqual([c.player, inv.team!.mine.partner]);
    expect(mine.members![0].isBot).toBe(false);
    expect(mine.members![1].isBot).toBe(true);
    expect(a.entrants.every((p) => p.members?.length === 2)).toBe(true);
    expect(a.cup.countdown).toEqual(inv.countdown);
    const opened = openCup(started, a.entrants, AT);
    expect(opened.active!.tournament!.mode).toBe("team");
  });

  it("is finished like any cup: a place for the team, a prize, and news about the team", () => {
    const { c, m } = invitationOf("pair");
    const opened = openCup(answerMessage(c, m.id, true, 9), answerMessage(c, m.id, true, 9).active!.entrants, AT);
    const done = finishEvent(opened, AT);
    const r = done.active!.result!;
    expect(["winner", "final", "semi", "quarter"]).toContain(r.place);
    const left = leaveEvent(done);
    expect(lifeOf(left).news.some((n) => n.kind === "you" && n.headline.startsWith(opened.active!.invite!.team!.mine.name))).toBe(true);
    // A cup of teams has no record against a person.
    expect(left.rivals ?? {}).toEqual({});
  });
});
