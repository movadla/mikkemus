import { describe, expect, it } from "vitest";
import { applyRound, bullOffDone, bullOffScore, currentGroup, simulateBullDarts, startBullOff, tieGroups, withGroupOrder } from "./bullOff";
import { createPilot, nextPilotMatch, pilotPlayers, pilotStages, recordPilotResult } from "./pilot";
import type { Participant, Tournament } from "./tournament";

// A small seeded random source, so the run can be repeated.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["Vadla", "Hans", "Lars", "Moen", "Monge", "Sondre", "Vegard", "Charlotte", "Littler", "Cor Dekker", "Dave", "ChrisBell", "Kjetil", "Wes", "Gary", "Rhian"];
// Marks per turn on average: the stronger the first.
const SKILL = [2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 2.5, 2.4, 2.2, 2.1, 1.9, 1.8, 1.7, 1.6];
const people = (): Participant[] => NAMES.map((name, i) => ({ name, isBot: i >= 8, ...(i >= 8 ? { botLevel: "4" as const, skill: 4 } : {}) }));

type Played = { placements: string[]; remaining: Record<string, number>; ties: string[]; turns: number };

/** One match of four or two: marks per turn with some spread, 30 marks to close, the first to 30 wins and the rest are placed by what they miss. */
function playMatch(players: string[], rand: () => number): Played {
  const marks: Record<string, number> = Object.fromEntries(players.map((p) => [p, 0]));
  let turns = 0;
  let winner: string | null = null;
  while (!winner) {
    turns++;
    for (const p of players) {
      const mean = SKILL[NAMES.indexOf(p)];
      // Three darts, each a cross with some chance, a few worth two or three.
      let gain = 0;
      for (let d = 0; d < 3; d++) {
        const r = rand();
        if (r < mean / 3.2) gain += r < mean / 12 ? 3 : r < mean / 6 ? 2 : 1;
      }
      marks[p] = Math.min(30, marks[p] + gain);
      if (marks[p] >= 30) {
        winner = p;
        break;
      }
    }
  }
  const remaining = Object.fromEntries(players.map((p) => [p, 30 - marks[p]]));
  const placements = [...players].sort((a, b) => remaining[a] - remaining[b]);
  // The winner first (the sort keeps the order they threw in among equals, and the winner is the only one with nothing left).
  const ties: string[] = [];
  let order = placements;
  for (const group of tieGroups(placements, remaining)) {
    let state = startBullOff(group);
    let rounds = 0;
    while (!bullOffDone(state)) {
      rounds++;
      const points = Object.fromEntries(currentGroup(state).map((n) => [n, bullOffScore(simulateBullDarts(30, rand))]));
      state = applyRound(state, points);
    }
    ties.push(`${group.join(" = ")} -> ${state.resolved.join(", ")} (${rounds} runder)`);
    order = withGroupOrder(order, group, state.resolved);
  }
  return { placements: order, remaining, ties, turns };
}

function run(seed: number, log?: (s: string) => void): { t: Tournament; ties: number; bullRounds: number } {
  const rand = rng(seed);
  let t = createPilot("individual", people(), "sim", "2026-10-30T10:00:00Z");
  let ties = 0;
  for (let guard = 0; guard < 30; guard++) {
    const m = nextPilotMatch(t);
    if (!m) break;
    const before = pilotPlayers(m);
    const r = playMatch(before, rand);
    ties += r.ties.length;
    log?.(`${m.pilot!.label.padEnd(14)} ${before.map((n) => n.padEnd(10)).join("")} -> ${r.placements.map((n, i) => `${i + 1}. ${n}`).join("  ")}  (${r.turns} runder${r.ties.length ? `; bull-off: ${r.ties.join("; ")}` : ""})`);
    t = recordPilotResult(t, m.id, r.placements, {});
  }
  return { t, ties, bullRounds: 0 };
}

describe("Ly Pilotturnering, simulert", () => {
  it("tusen turneringer med tilfeldige resultater og bull-off: hvert løp er ferdig og hver spiller havner riktig sted", () => {
    const problems: string[] = [];
    const champs: Record<string, number> = {};
    let ties = 0;
    let matchesPlayed = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const { t, ties: n } = run(seed);
      ties += n;
      if (t.status !== "done" || !t.winner) {
        problems.push(`seed ${seed}: ikke ferdig`);
        continue;
      }
      champs[t.winner] = (champs[t.winner] ?? 0) + 1;
      matchesPlayed += t.matches.filter((m) => m.winner).length;
      const by = (id: string) => t.matches.find((m) => m.id === id)!;
      const st = pilotStages(t);
      // Every match of four has four different people, every match of two has two, and nobody is twice in one stage.
      for (const s of st) {
        const seen = new Set<string>();
        for (const m of s.matches) {
          const p = pilotPlayers(m);
          const want = s.stage === "quarter" || s.stage === "semi" || s.stage === "final" ? 2 : 4;
          if (p.length !== want || new Set(p).size !== want) problems.push(`seed ${seed}: ${m.id} har ${p.join(",")}`);
          for (const n2 of p) {
            if (seen.has(n2)) problems.push(`seed ${seed}: ${n2} er to ganger i ${s.stage}`);
            seen.add(n2);
          }
        }
        if (s.stage !== "final" && seen.size !== (s.stage === "quarter" ? 8 : s.stage === "semi" ? 4 : s.stage === "lucky" ? 8 : s.stage === "winners" ? 8 : s.stage === "losers" ? 8 : 16)) problems.push(`seed ${seed}: ${s.stage} har ${seen.size} spillere`);
      }
      // The first two of each heat are in a winners lane, the last two in a losers lane.
      for (const h of ["h1", "h2", "h3", "h4"]) {
        const pl = by(h).placements!;
        const inW = [...pilotPlayers(by("w1")), ...pilotPlayers(by("w2"))];
        const inL = [...pilotPlayers(by("l1")), ...pilotPlayers(by("l2"))];
        if (!(inW.includes(pl[0]) && inW.includes(pl[1]) && inL.includes(pl[2]) && inL.includes(pl[3]))) problems.push(`seed ${seed}: ${h} gikk feil vei`);
      }
      // Quarter-final: eight players, the first two of the winners lanes and the first two of lucky loser.
      const qf = ["q1", "q2", "q3", "q4"].flatMap((q) => pilotPlayers(by(q)));
      const expectQf = [...by("w1").placements!.slice(0, 2), ...by("w2").placements!.slice(0, 2), ...by("k1").placements!.slice(0, 2), ...by("k2").placements!.slice(0, 2)];
      if ([...qf].sort().join() !== [...expectQf].sort().join()) problems.push(`seed ${seed}: kvartfinalen har feil åtte`);
      // Each quarter has one straight through and one from lucky loser.
      for (const q of ["q1", "q2", "q3", "q4"]) {
        const [x, y] = pilotPlayers(by(q));
        const direct = [...by("w1").placements!.slice(0, 2), ...by("w2").placements!.slice(0, 2)];
        const lucky = [...by("k1").placements!.slice(0, 2), ...by("k2").placements!.slice(0, 2)];
        const ok = (direct.includes(x) && lucky.includes(y)) || (direct.includes(y) && lucky.includes(x));
        if (!ok) problems.push(`seed ${seed}: ${q} er ikke direkte mot lucky loser`);
      }
      // The two last of a losers lane are out: nowhere after it.
      const later = new Set(["k1", "k2", "q1", "q2", "q3", "q4", "s1", "s2", "f"].flatMap((id) => pilotPlayers(by(id))));
      for (const l of ["l1", "l2"]) for (const out of by(l).placements!.slice(2)) if (later.has(out)) problems.push(`seed ${seed}: ${out} er ute men spiller videre`);
      if (t.matches.filter((m) => m.winner).length !== 17) problems.push(`seed ${seed}: ${t.matches.filter((m) => m.winner).length} kamper`);
    }
    const top = Object.entries(champs).sort((a, b) => b[1] - a[1]);
    console.log(`\n1000 løp: ${matchesPlayed / 1000} kamper per turnering, ${(ties / 1000).toFixed(2)} bull-off per turnering`);
    console.log("MESTERE: " + top.map(([n, c]) => `${n} ${(c / 10).toFixed(1)} %`).join(", "));
    expect(problems.slice(0, 10)).toEqual([]);
  });
});
