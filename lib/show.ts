/**
 * The show around the career (only for the code that has it, lib/access.tsx): what the week card, the film of a season, the front page of the
 * paper, the story of the rival and the card of the last results are made from. Everything here is plain data in and out, built from what the
 * career has kept: nothing is made up, a fact that is not kept is left out.
 */
import { PLACE_LABEL, TIERS, dollars, type Career, type Place, type Rival, type TierId } from "./career";
import { CALENDAR, slotOf } from "./careerCalendar";
import { PLACE_ORDER, WEEKS_PER_SEASON, isOpen, lifeOf, rivalOf, seasonOf, weekInSeason, type SeasonResult } from "./careerLife";

/** A number from 0 to 1 that is always the same for the same text (so a headline does not change when the paper is opened again). */
const unit = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
const pick = <T,>(list: readonly T[], seed: string): T => list[Math.floor(unit(seed) * list.length)];

/** A place in a word or two, for the rows of a film and a card. */
export const PLACE_SHORT: Record<Place, string> = { winner: "Vinner", final: "Finale", semi: "Semifinale", quarter: "Kvartfinale", r16: "Åttedelsfinale", r32: "Sekstendelsfinale" };

/* ----------------------------------------------------------------- the card of a week */

export type WeekCardData = {
  week: number;
  of: number;
  name: string;
  /** Nothing is to be played yet: an invitation or a show that has not come. */
  tba: boolean;
  /** Where it is held, when it is known. */
  where: string | null;
  /** The step it is built on (for the colour), when it has a name. */
  tier: TierId | null;
  ticks: ("done" | "now" | "ahead")[];
};

/** The card of the week the career is in: what is played, where, and how far into the season it is. */
export function weekCardOf(career: Career): WeekCardData {
  const life = lifeOf(career);
  const week = weekInSeason(life.week);
  const slot = slotOf(life.week);
  const ticks = Array.from({ length: WEEKS_PER_SEASON }, (_, i): "done" | "now" | "ahead" => (i < week - 1 ? "done" : i === week - 1 ? "now" : "ahead"));
  const base = { week, of: WEEKS_PER_SEASON, ticks };
  if (slot.kind === "tier") return { ...base, name: slot.name, tba: false, where: TIERS[slot.tier].venue, tier: slot.tier };
  if (slot.kind === "invite") {
    const m = life.inbox.find((x) => x.offer.kind === "invite" && x.offer.invite.key === slot.key && (isOpen(x) || x.state === "taken"));
    const invite = m && m.offer.kind === "invite" ? m.offer.invite : career.active?.invite?.key === slot.key ? career.active.invite : undefined;
    return invite ? { ...base, name: invite.name, tba: false, where: invite.city, tier: invite.id } : { ...base, name: "TBA", tba: true, where: null, tier: null };
  }
  const came = life.inbox.some((x) => x.offer.kind === "challenge" && !!x.offer.tv && (isOpen(x) || x.state === "taken"));
  return came ? { ...base, name: slot.name, tba: false, where: "TV-studioet", tier: null } : { ...base, name: "TBA", tba: true, where: null, tier: null };
}

/* ----------------------------------------------------------------- the film of a season */

export type FilmWeek = { week: number; name: string; /** What came of it, in words. */ result: string; place?: Place; skipped?: boolean };

export type FilmScene =
  | { kind: "title"; ms: number; season: number; player: string }
  | { kind: "weeks"; ms: number; rows: FilmWeek[]; part: 1 | 2 }
  | { kind: "best"; ms: number; place: Place; name: string; week: number }
  | { kind: "trophy"; ms: number; cups: { name: string; tier: TierId | null }[] }
  | { kind: "rival"; ms: number; name: string; w: number; l: number; line: string }
  | { kind: "table"; ms: number; rows: { name: string; pts: number; me: boolean }[]; rank: number; points: number }
  | { kind: "end"; ms: number; season: number; rank: number; points: number; prize: number; winner: string };

/** How long the film runs, in milliseconds. */
export const filmLength = (scenes: FilmScene[]) => scenes.reduce((s, x) => s + x.ms, 0);

/** The weeks of one season, in order, from what the career has kept (it keeps the last two seasons). A week that was not kept is not told. */
export function weeksOfSeason(career: Career, season: number): FilmWeek[] {
  const kept = lifeOf(career).weeks ?? {};
  const first = (season - 1) * WEEKS_PER_SEASON + 1;
  const rows: FilmWeek[] = [];
  for (let i = 0; i < WEEKS_PER_SEASON; i++) {
    const log = kept[String(first + i)];
    if (!log) continue;
    rows.push({ week: i + 1, name: log.name, result: log.place ? PLACE_SHORT[log.place] : log.skipped ? "Ikke spilt" : "Spilt", ...(log.place ? { place: log.place } : {}), ...(log.skipped ? { skipped: true as const } : {}) });
  }
  return rows;
}

/** The record against the rival, as a line: where the two of them stand. Null before they have met. */
export function rivalRecordLine(name: string, rec: Rival | undefined): string | null {
  if (!rec || rec.w + rec.l === 0) return null;
  if (rec.w === 0) return "Du har ikke slått ham ennå.";
  if (rec.l === 0) return `Du har slått ham ${rec.w} ${rec.w === 1 ? "gang" : "ganger"} og aldri tapt.`;
  const last = rec.lastWon ? " Sist tok du ham." : " Sist tok han deg.";
  if (rec.w === rec.l) return `Dere står ${rec.w}–${rec.l}.${last}`;
  return rec.w > rec.l ? `Du leder ${rec.w}–${rec.l}.${last}` : `${name} leder ${rec.l}–${rec.w}.${last}`;
}

/**
 * The scenes of a season as a film of 25 to 30 seconds: the title, the eight weeks (in two parts), the best of them, the cups when there were any,
 * the rival's record when the two have met, the table at the end and the line under it. A scene with nothing to tell is left out.
 */
export function seasonFilm(career: Career, result: SeasonResult): FilmScene[] {
  const rows = weeksOfSeason(career, result.season);
  const scenes: FilmScene[] = [{ kind: "title", ms: 2500, season: result.season, player: career.player }];
  if (rows.length > 0) {
    const half = Math.ceil(rows.length / 2);
    scenes.push({ kind: "weeks", ms: 4000, rows: rows.slice(0, half), part: 1 });
    if (rows.length > half) scenes.push({ kind: "weeks", ms: 4000, rows: rows.slice(half), part: 2 });
  }
  // The best place of the season (the latest of equals), when it is a quarter-final or better and not a title (the cups have a scene of their own).
  const placed = rows.filter((r): r is FilmWeek & { place: Place } => !!r.place);
  const best = placed.reduce<(FilmWeek & { place: Place }) | null>((b, r) => (!b || PLACE_ORDER.indexOf(r.place) <= PLACE_ORDER.indexOf(b.place) ? r : b), null);
  if (best && best.place !== "winner" && PLACE_ORDER.indexOf(best.place) <= PLACE_ORDER.indexOf("quarter")) scenes.push({ kind: "best", ms: 3500, place: best.place, name: best.name, week: best.week });
  const first = (result.season - 1) * WEEKS_PER_SEASON + 1;
  const cups = placed
    .filter((r) => r.place === "winner")
    .map((r) => {
      const slot = CALENDAR[r.week - 1];
      return { name: r.name, tier: slot.kind === "tier" ? slot.tier : null, at: first + r.week - 1 };
    })
    .reverse()
    .slice(0, 3);
  if (cups.length > 0) scenes.push({ kind: "trophy", ms: 3500, cups: cups.map(({ name, tier }) => ({ name, tier })) });
  const rival = rivalOf(career).name;
  const rec = career.rivals?.[rival];
  const line = rivalRecordLine(rival, rec);
  if (rec && line) scenes.push({ kind: "rival", ms: 3500, name: rival, w: rec.w, l: rec.l, line });
  if (result.table && result.table.length > 0) scenes.push({ kind: "table", ms: 4500, rows: result.table.map((r) => ({ name: r.name, pts: r.pts, me: r.name === career.player })), rank: result.rank, points: result.points });
  scenes.push({ kind: "end", ms: 3000, season: result.season, rank: result.rank, points: result.points, prize: result.prize, winner: result.winner });
  return scenes;
}

/* ----------------------------------------------------------------- the front page */

export type Front = { paper: string; dateLine: string; headline: string; lede: string };

const ROUND_OUT: Record<"quarter" | "r16" | "r32", string> = { quarter: "kvartfinalen", r16: "åttedelsfinalen", r32: "sekstendelsfinalen" };

/**
 * The front page after a tournament: a headline and a lede for the outcome (title, final, semi-final, out early), from the name of the
 * tournament, the place, the prize and the points. The text is the same for the same career, week and tournament. It tells no more than is kept.
 */
export function frontPage(f: { careerId: string; week: number; player: string; tournament: string; place: Place; prize: number; points: number }): Front {
  const { player: p, tournament: t, prize, points } = f;
  const pay = prize > 0 ? ` Premien er ${dollars(prize)}.` : "";
  const pts = points > 0 ? ` Det gir ${points} rankingpoeng.` : "";
  const seed = `${f.careerId}|${f.week}|${t}|${f.place}`;
  const dateLine = `Sesong ${seasonOf(f.week)} · uke ${weekInSeason(f.week)}`;
  const paper = "Dart Dagbladet";
  let pair: [string, string];
  if (f.place === "winner") {
    pair = pick<[string, string]>(
      [
        [`${p} vant ${t}`, `Pokalen er hentet hjem.${pay}${pts}`],
        [`Seier til ${p}`, `${t} har en ny vinner.${pay}${pts}`],
        [`${p} tok tittelen i ${t}`, `Ingen kom forbi i finalen.${pay}${pts}`],
        [`Pokal til ${p}`, `${t} endte som ${p} ville ha det.${pay}${pts}`],
      ],
      seed,
    );
  } else if (f.place === "final") {
    pair = pick<[string, string]>(
      [
        [`${p} tapte finalen i ${t}`, `Helt til siste kamp, men pokalen ble igjen.${pay}${pts}`],
        [`Så nær i ${t}`, `${p} nådde finalen, men måtte se seieren gå til en annen.${pay}${pts}`],
        [`Sølv til ${p}`, `Finaleplassen i ${t} holdt ikke helt hele veien.${pay}${pts}`],
        [`Finale, men ingen pokal`, `${p} kom til siste kamp i ${t}.${pay}${pts}`],
      ],
      seed,
    );
  } else if (f.place === "semi") {
    pair = pick<[string, string]>(
      [
        [`${p} ute i semifinalen`, `Veien stoppet blant de fire siste i ${t}.${pay}${pts}`],
        [`Semifinale-smell for ${p}`, `${t} gikk videre uten ${p}.${pay}${pts}`],
        [`${p} blant de fire beste i ${t}`, `Men finaleplassen gikk til en annen.${pay}${pts}`],
        [`Nær finalen i ${t}`, `${p} tapte semifinalen.${pay}${pts}`],
      ],
      seed,
    );
  } else {
    const round = ROUND_OUT[f.place];
    pair = pick<[string, string]>(
      [
        [`${p} ute i ${round}`, `${t} ble kortere enn håpet.${pay}${pts}`],
        [`Tidlig slutt for ${p}`, `Det stoppet i ${round} i ${t}.${pay}${pts}`],
        [`${t}: ${p} røk ut`, `Tapte ${round}.${pay}${pts}`],
        [`Ikke denne gangen, ${p}`, `${round.charAt(0).toUpperCase() + round.slice(1)} i ${t} ble siste stopp.${pay}${pts}`],
      ],
      seed,
    );
  }
  return { paper, dateLine, headline: pair[0], lede: pair[1].trim() };
}

/** The front page of a tournament the career has just played. */
export const frontOf = (career: Career, tournament: string, place: Place, prize: number, points: number): Front =>
  frontPage({ careerId: career.id, week: lifeOf(career).week, player: career.player, tournament, place, prize, points });

/* ----------------------------------------------------------------- the rival's words */

/** A line from the rival after a meeting, by who won it: always the same for the same career, week and rival. */
export function rivalQuip(careerId: string, week: number, name: string, playerWon: boolean): string {
  const won = ["Tilfeldig. Neste gang er det min tur.", "Bra kastet. Ikke vent det samme to ganger.", "Du fortjente den. Jeg vil ha revansje."];
  const lost = ["Ikke ta det personlig. Jeg trengte den.", "Kom igjen når du er klar for en ny omgang.", "Det var nært. Men nært teller ikke."];
  return `${name}: «${pick(playerWon ? won : lost, `${careerId}|${week}|${name}|quip|${playerWon}`)}»`;
}

/* ----------------------------------------------------------------- "previously" */

/** The last results of the player, newest first, each as the name and the place: for the card before a big opening. Duels have no place and are left out. */
export function previouslyOf(career: Career, count = 3): string[] {
  return career.history
    .filter((h): h is typeof h & { place: Place } => !!h.place)
    .slice(0, count)
    .map((h) => `${h.event} · ${PLACE_LABEL[h.place]}`);
}

/** The steps that are big enough to have the card: the national championship, the Grand Slam and the world championship. */
export const BIG_STEPS: readonly TierId[] = ["nm", "gs", "vm"];
