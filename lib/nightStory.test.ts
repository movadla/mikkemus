import { describe, expect, it } from "vitest";
import { nightSlides } from "./nightStory";
import type { NightSummary } from "./nights";

const m = (date: string, won: boolean, dartsUsed: number, hitPct: number, med: number | null = null) => ({ date, won, dartsUsed, hitPct, med, mhd: med, mvd: med });
const night = (players: NightSummary["players"]): NightSummary => ({ date: "2026-10-17", players });

describe("the night's story", () => {
  const vadla = { name: "Vadla", wins: 3, losses: 1, matches: [m("2026-10-17T18:00", true, 60, 55, 27), m("2026-10-17T18:20", true, 48, 61, 25), m("2026-10-17T18:40", true, 66, 50, 30), m("2026-10-17T19:00", false, 72, 40, 33)] };
  const monge = { name: "Monge", wins: 1, losses: 3, matches: [m("2026-10-17T18:00", false, 60, 45), m("2026-10-17T18:20", false, 48, 41), m("2026-10-17T18:40", false, 66, 38), m("2026-10-17T19:00", true, 72, 52)] };

  it("names the best of the night, the fastest win and the sharpest match", () => {
    const s = nightSlides(night([vadla, monge]));
    const by = (k: string) => s.find((x) => x.kind === k)!;
    expect(s[0].kind).toBe("mvp");
    expect(by("mvp").big).toBe("Vadla");
    expect(by("mvp").title).toBe("3 seire på 4 kamper");
    expect(by("fastest").big).toBe("16"); // 48 darts is 16 turns
    expect(by("fastest").title).toContain("Vadla");
    expect(by("sharpest").big).toBe("61 %");
    expect(by("streak").big).toBe("3");
    expect(by("closest").big).toBe("25 mm");
    expect(by("matches").big).toBe("4");
  });

  it("leaves out a card with nothing behind it", () => {
    const quiet = night([{ name: "Hans", wins: 0, losses: 1, matches: [m("2026-10-17T18:00", false, 60, 40)] }]);
    const kinds = nightSlides(quiet).map((x) => x.kind);
    expect(kinds).toEqual(["sharpest"]); // no win, no streak, no measured darts
    expect(nightSlides(night([]))).toEqual([]);
  });

  it("does not count a quit as the fastest or the sharpest", () => {
    const quit = night([{ name: "Lars", wins: 1, losses: 0, matches: [m("2026-10-17T18:00", true, 3, 100), m("2026-10-17T18:10", true, 54, 50)] }]);
    const s = nightSlides(quit);
    expect(s.find((x) => x.kind === "fastest")!.big).toBe("18");
    expect(s.find((x) => x.kind === "sharpest")!.big).toBe("50 %");
  });

  it("reads a streak in the order the matches were played", () => {
    const p = { name: "Moen", wins: 3, losses: 1, matches: [m("2026-10-17T19:00", true, 60, 50), m("2026-10-17T18:00", true, 60, 50), m("2026-10-17T18:30", false, 60, 50), m("2026-10-17T18:45", true, 60, 50)] };
    // By time: win, loss, win, win: the longest run is two.
    expect(nightSlides(night([p])).find((x) => x.kind === "streak")!.big).toBe("2");
  });
});

describe("the cards say more when asked", () => {
  const withMatch = (date: string, won: boolean, darts: number, hit: number, matchId: string, vs: string[]) => ({ ...m(date, won, darts, hit, 25), matchId, vs });
  const vadla = { name: "Vadla", wins: 2, losses: 1, matches: [withMatch("2026-10-17T18:00", true, 60, 55, "a", ["Littler"]), withMatch("2026-10-17T18:20", true, 48, 61, "b", ["Monge"]), withMatch("2026-10-17T18:40", false, 72, 40, "c", ["Hans"])] };
  const s = nightSlides(night([vadla]));

  it("names the match behind the fastest win and the sharpest match, and links to it", () => {
    const fastest = s.find((x) => x.kind === "fastest")!;
    expect(fastest.more!.matchId).toBe("b");
    expect(fastest.more!.lines[0]).toContain("Vadla vant mot Monge kl. 18:20");
    expect(fastest.more!.lines[0]).toContain("48 piler");
    expect(s.find((x) => x.kind === "sharpest")!.more!.matchId).toBe("b");
  });

  it("lists the night's matches for the best of the night, in the order they were played", () => {
    const lines = s.find((x) => x.kind === "mvp")!.more!.lines;
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Littler");
    expect(lines[2]).toContain("tapte mot Hans");
  });

  it("lists the matches of the streak, and the matches of the night on the last card", () => {
    expect(s.find((x) => x.kind === "streak")!.more!.lines).toHaveLength(2);
    const last = s.find((x) => x.kind === "matches")!.more!.lines;
    expect(last).toHaveLength(3);
    expect(last[0]).toContain("kl. 18:00");
    expect(last[0]).toContain("Vadla vant");
  });
});
