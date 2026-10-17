import type { NightSummary } from "./nights";
import { nightAverages } from "./nights";

/** One card of the night's summary: a small label, a big figure, and two lines under it. */
export type StorySlide = {
  kind: "mvp" | "fastest" | "sharpest" | "streak" | "closest" | "matches";
  label: string;
  big: string;
  title: string;
  sub: string;
};

/** A match shorter than this is a quit, not a match: it does not count as the fastest or the sharpest. */
const MIN_DARTS = 15;
const DARTS_PER_TURN = 3;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The longest run of wins in a row, in the order the matches were played. */
function longestStreak(dates: { date: string; won: boolean }[]): number {
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const m of sorted) {
    run = m.won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
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
    });
  }

  const wins = players.flatMap((p) => p.matches.filter((m) => m.won && m.dartsUsed >= MIN_DARTS).map((m) => ({ name: p.name, m })));
  if (wins.length > 0) {
    const f = wins.reduce((a, b) => (b.m.dartsUsed < a.m.dartsUsed ? b : a));
    const turns = Math.ceil(f.m.dartsUsed / DARTS_PER_TURN);
    slides.push({ kind: "fastest", label: "RASKESTE SEIER", big: String(turns), title: `${plural(turns, "runde", "runder")}, ${f.name}`, sub: `${f.m.dartsUsed} piler` });
  }

  const all = players.flatMap((p) => p.matches.filter((m) => m.dartsUsed >= MIN_DARTS).map((m) => ({ name: p.name, m })));
  if (all.length > 0) {
    const s = all.reduce((a, b) => (b.m.hitPct > a.m.hitPct ? b : a));
    slides.push({ kind: "sharpest", label: "FLEST TREFF I EN KAMP", big: `${Math.round(s.m.hitPct)} %`, title: `${s.name} traff slik`, sub: `${s.m.dartsUsed} piler i kampen` });
  }

  const streaks = players.map((p) => ({ name: p.name, n: longestStreak(p.matches) })).filter((s) => s.n >= 2);
  if (streaks.length > 0) {
    const s = streaks.reduce((a, b) => (b.n > a.n ? b : a));
    slides.push({ kind: "streak", label: "SEIRE PÅ RAD", big: String(s.n), title: `${s.name} vant ${s.n} på rad`, sub: "Lengste rekken i kveld" });
  }

  const measured = players.flatMap((p) => p.matches.filter((m) => m.med !== null).map((m) => ({ name: p.name, med: m.med as number })));
  if (measured.length > 0) {
    const c = measured.reduce((a, b) => (b.med < a.med ? b : a));
    slides.push({ kind: "closest", label: "NÆRMEST MIDTEN", big: `${Math.round(c.med)} mm`, title: `${c.name}, snittavstand i en kamp`, sub: "Målt av Scolia" });
  }

  // Every match has one winner on record, so the wins are the matches played.
  const matches = players.reduce((s, p) => s + p.wins, 0);
  if (matches > 0) slides.push({ kind: "matches", label: "KVELDEN", big: String(matches), title: plural(matches, "kamp spilt", "kamper spilt"), sub: `${players.length} ${plural(players.length, "spiller eller lag", "spillere og lag")}` });

  return slides;
}
