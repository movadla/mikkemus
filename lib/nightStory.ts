import type { NightSummary } from "./nights";
import { nightAverages } from "./nights";
import { shownHitPct, type MatchHistoryEntry } from "./playerRows";

/** One card of the night's summary: a small label, a big figure, and two lines under it. */
export type StorySlide = {
  kind: "mvp" | "fastest" | "sharpest" | "streak" | "closest" | "matches";
  label: string;
  big: string;
  title: string;
  sub: string;
  /** What «Mer» shows: the matches behind the card, one to a line, and the match that the card is about when it is about one. */
  more?: { lines: string[]; matchId?: string };
};

/** The time of day of a match, «18:20». */
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** One match as a line: who against whom and how it went, with the time. «Vadla vant mot Littler kl. 18:20, 48 piler, 61 % treff». */
function matchLine(name: string, m: MatchHistoryEntry): string {
  const against = (m.vs ?? []).join(" og ");
  const result = against ? `${name} ${m.won ? "vant" : "tapte"} mot ${against}` : `${name} ${m.won ? "vant" : "tapte"}`;
  return `${result} kl. ${clock(m.date)}, ${m.dartsUsed} piler, ${Math.round(shownHitPct(m))} % treff`;
}

/** A match shorter than this is a quit, not a match: it does not count as the fastest or the sharpest. */
const MIN_DARTS = 15;
const DARTS_PER_TURN = 3;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The longest run of wins in a row, in the order the matches were played, with the matches it was made of. */
function longestStreak<T extends { date: string; won: boolean }>(dates: T[]): { n: number; matches: T[] } {
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));
  let best: T[] = [];
  let run: T[] = [];
  for (const m of sorted) {
    run = m.won ? [...run, m] : [];
    if (run.length > best.length) best = run;
  }
  return { n: best.length, matches: best };
}

/**
 * The cards for one night, as in a story: who was the best of the night, the fastest win, the match
 * with the most darts counting, the longest streak and the sharpest throwing. Only what the night's
 * records can say; a card with nothing behind it is left out, so a night of two matches gets a short story.
 */
export function nightSlides(night: NightSummary): StorySlide[] {
  const slides: StorySlide[] = [];
  const players = night.players;
  if (players.length === 0) return slides;

  // The best of the night: most wins, then fewest losses, then the better hit rate.
  const ranked = [...players].sort((a, b) => b.wins - a.wins || a.losses - b.losses || (nightAverages(b).hitPct ?? 0) - (nightAverages(a).hitPct ?? 0));
  const top = ranked[0];
  if (top.wins > 0) {
    const hit = nightAverages(top).hitPct;
    slides.push({
      kind: "mvp",
      label: "KVELDENS BESTE",
      big: top.name,
      title: `${top.wins} ${plural(top.wins, "seier", "seire")} på ${top.wins + top.losses} ${plural(top.wins + top.losses, "kamp", "kamper")}`,
      sub: hit === null ? "" : `Snitt ${Math.round(hit)} % treff`,
      more: { lines: [...top.matches].sort((a, b) => a.date.localeCompare(b.date)).map((m) => matchLine(top.name, m)) },
    });
  }

  const wins = players.flatMap((p) => p.matches.filter((m) => m.won && m.dartsUsed >= MIN_DARTS).map((m) => ({ name: p.name, m })));
  if (wins.length > 0) {
    const f = wins.reduce((a, b) => (b.m.dartsUsed < a.m.dartsUsed ? b : a));
    const turns = Math.ceil(f.m.dartsUsed / DARTS_PER_TURN);
    slides.push({ kind: "fastest", label: "RASKESTE SEIER", big: String(turns), title: `${plural(turns, "runde", "runder")}, ${f.name}`, sub: `${f.m.dartsUsed} piler`, more: { lines: [matchLine(f.name, f.m)], matchId: f.m.matchId } });
  }

  const all = players.flatMap((p) => p.matches.filter((m) => m.dartsUsed >= MIN_DARTS).map((m) => ({ name: p.name, m })));
  if (all.length > 0) {
    const s = all.reduce((a, b) => (shownHitPct(b.m) > shownHitPct(a.m) ? b : a));
    slides.push({ kind: "sharpest", label: "FLEST TREFF I EN KAMP", big: `${Math.round(shownHitPct(s.m))} %`, title: `${s.name} traff slik`, sub: `${s.m.dartsUsed} piler i kampen`, more: { lines: [matchLine(s.name, s.m)], matchId: s.m.matchId } });
  }

  const streaks = players.map((p) => ({ name: p.name, ...longestStreak(p.matches) })).filter((s) => s.n >= 2);
  if (streaks.length > 0) {
    const s = streaks.reduce((a, b) => (b.n > a.n ? b : a));
    slides.push({ kind: "streak", label: "SEIRE PÅ RAD", big: String(s.n), title: `${s.name} vant ${s.n} på rad`, sub: "Lengste rekken i kveld", more: { lines: s.matches.map((m) => matchLine(s.name, m)) } });
  }

  const measured = players.flatMap((p) => p.matches.filter((m) => m.med !== null).map((m) => ({ name: p.name, med: m.med as number, m })));
  if (measured.length > 0) {
    const c = measured.reduce((a, b) => (b.med < a.med ? b : a));
    slides.push({ kind: "closest", label: "NÆRMEST MIDTEN", big: `${Math.round(c.med)} mm`, title: `${c.name}, snittavstand i en kamp`, sub: "Målt av Scolia", more: { lines: [matchLine(c.name, c.m)], matchId: c.m.matchId } });
  }

  // A match has the id its sides share, so those are counted by id (a loss to a bot has no winner row to count). The
  // older matches have none, and every one of those has one winner on record, so there the wins are the matches.
  const ids = new Set<string>();
  let legacyWins = 0;
  players.forEach((p) => p.matches.forEach((m) => (m.matchId ? ids.add(m.matchId) : m.won && legacyWins++)));
  const matches = ids.size + legacyWins;
  // The matches in the order they were played: the people who had a record of it, and who won where that is known.
  const byMatch = new Map<string, { at: string; names: Set<string>; winner?: string }>();
  players.forEach((p) =>
    p.matches.forEach((m) => {
      if (!m.matchId) return;
      const e = byMatch.get(m.matchId) ?? { at: m.date, names: new Set<string>() };
      e.names.add(p.name);
      (m.vs ?? []).forEach((v) => e.names.add(v));
      if (m.won) e.winner = p.name;
      byMatch.set(m.matchId, e);
    }),
  );
  const matchLines = [...byMatch.values()].sort((x, y) => x.at.localeCompare(y.at)).map((e) => `kl. ${clock(e.at)}: ${[...e.names].join(" mot ")}${e.winner ? `, ${e.winner} vant` : ""}`);
  if (matches > 0) slides.push({ more: { lines: matchLines }, kind: "matches", label: "KVELDEN", big: String(matches), title: plural(matches, "kamp spilt", "kamper spilt"), sub: `${players.length} ${plural(players.length, "spiller eller lag", "spillere og lag")}` });

  return slides;
}
