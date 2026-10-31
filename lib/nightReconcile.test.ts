import { describe, expect, it } from "vitest";
import { comparisonOf, pointsOf, tableOf, type NightMatch, type NightSide } from "./nightScore";
import { compare, playerNight, playersOf, statsOf } from "./nightStats";

/**
 * The views of Kveldsscore (the table, Sammenlign, Statistikk, one person's evening, two side by side) are worked out in different places. They must
 * say the same thing: the same points, the same wins and losses, the same duels. This plays out many random evenings and checks that they do.
 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const PEOPLE = ["Vadla", "Monge", "Hans", "Erlend", "Lars", "Per"];
const GAMES = ["enkeltkamp", "301", "501", "highstriker", "lava", "halvit", "killer", "bullduel"] as const;

function evening(seed: number): NightMatch[] {
  const r = rng(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const out: NightMatch[] = [];
  const count = 1 + Math.floor(r() * 14);
  for (let i = 0; i < count; i++) {
    const sidesN = r() < 0.7 ? 2 : r() < 0.7 ? 3 : 4;
    const pool = [...PEOPLE].sort(() => r() - 0.5);
    const sides: NightSide[] = [];
    for (let s = 0; s < sidesN; s++) {
      const size = r() < 0.5 ? 1 : 2;
      const members = pool.splice(0, size).filter(Boolean);
      if (members.length === 0) break;
      sides.push({ name: members.length > 1 ? `${members[0]} og ${members[1]}` : members[0], members });
    }
    if (sides.length < 2) continue;
    const placements = [...sides.map((s) => s.name)].sort(() => r() - 0.5);
    const m: NightMatch = { id: `m${seed}-${i}`, evening: "e", at: `2026-10-30T${String(18 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 9).padStart(2, "0")}:00.000Z`, game: pick([...GAMES]), sides, placements };
    const x = r();
    if (x < 0.12) m.override = { draw: true };
    else if (x < 0.25) m.override = { placements: [...placements].sort(() => r() - 0.5) };
    if (r() < 0.12) m.deleted = true;
    if (r() < 0.15) m.bonus = [{ who: pick(sides.flatMap((s) => s.members)), feat: "180" }];
    if (sides.length === 2 && r() < 0.15) m.series = { bestOf: 3, wins: { [sides[0].name]: 2, [sides[1].name]: 1 } };
    out.push(m);
  }
  return out;
}

describe("kveldens visninger stemmer med hverandre", () => {
  for (let seed = 1; seed <= 300; seed++) {
    it(`kveld ${seed}`, () => {
      const ms = evening(seed);
      const table = tableOf(ms);
      const stats = statsOf(ms, {});
      const people = playersOf(ms);
      const grid = comparisonOf(ms);

      // Everyone who played is in the table, once.
      expect(table.map((t) => t.name).sort()).toEqual(people);

      for (const row of table) {
        const mine = ms.filter((m) => !m.deleted && m.sides.some((s) => s.members.includes(row.name)));
        // Points: the table, the sum of the matches, the graph's last step and the person's own evening all agree.
        const sum = mine.reduce((s, m) => s + (pointsOf(m)[row.name] ?? 0), 0);
        expect(row.points).toBe(sum);
        expect(stats.progress.steps.at(-1)?.points[row.name]).toBe(sum);
        const p = playerNight(ms, {}, row.name);
        expect(p.stats.points).toBe(sum);
        expect(p.progress.at(-1)?.points ?? 0).toBe(sum);
        // Wins, losses and matches.
        expect(p.stats.matches).toBe(row.matches);
        expect(p.stats.wins).toBe(row.wins);
        expect(p.stats.losses).toBe(row.losses);
        const res = stats.results.find((x) => x.name === row.name)!;
        expect(res).toEqual({ name: row.name, wins: row.wins, losses: row.losses });
        // The games one by one add up to the same.
        expect(p.games.reduce((s, g) => s + g.wins, 0)).toBe(row.wins);
        expect(p.games.reduce((s, g) => s + g.losses, 0)).toBe(row.losses);
        // The extra points are among the points.
        expect(row.bonus).toBe(mine.reduce((s, m) => s + (m.bonus ?? []).filter((b) => b.who === row.name).length, 0));
      }

      // The grid is the same from both sides, and two side by side say what the grid says.
      for (const a of people)
        for (const b of people) {
          if (a === b) continue;
          const ab = grid.against[a]?.[b] ?? { won: 0, lost: 0 };
          const ba = grid.against[b]?.[a] ?? { won: 0, lost: 0 };
          expect(ab.won).toBe(ba.lost);
          expect(ab.lost).toBe(ba.won);
          const c = compare(ms, {}, { kind: "player", name: a }, { kind: "player", name: b });
          expect(c.duels).toEqual({ a: ab.won, b: ba.won });
          expect(c.a.points).toBe(table.find((t) => t.name === a)!.points);
          expect(c.b.wins).toBe(table.find((t) => t.name === b)!.wins);
        }

      // The awards name the same person as the table where they are the same thing.
      const total = stats.awards.find((x) => x.key === "total");
      if (total) {
        expect(total.who).toBe(table[0].name);
        expect(total.value).toBe(`${table[0].points} poeng`);
      }
      // Every person on the graph ends where the table says.
      expect(stats.progress.names).toEqual(people);
    });
  }
});
