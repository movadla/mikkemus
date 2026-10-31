import type { ShowEvent } from "./showBus";

/** The two voices at the board. */
export type Commentator = "Kåre" | "Tove";

export type CommentaryLine = { who: Commentator; text: string };

/** What the overlay knows about the match: only facts it has seen itself. */
export type CommentaryContext = {
  /** The person at the board (the career's player). */
  me: string;
  opponent?: string;
  /** The rival, when the opponent is the rival. */
  rival?: string;
  /** 180s thrown so far in this match, per name, counting the one just thrown. */
  count180?: Record<string, number>;
};

type Rnd = () => number;
type Template = (ctx: { p: string; o: string | null; n: number; points: number; num: number }) => string[];

const pick = <T,>(xs: T[], rnd: Rnd): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];

const T180: Template[] = [
  ({ p }) => [`${p} kaster hundre og åtti!`, "Maksimum! Det kan ikke gjøres bedre."],
  ({ p }) => [`Tre trippel tjue, ${p}!`, "Der satt den, alle tre i samme lomme."],
  ({ p, n }) => (n >= 2 ? [`Hundre og åtti igjen fra ${p}!`, `Det er nummer ${n} i kampen.`] : [`Hundre og åtti, ${p}!`, "Hør på folkene!"]),
];
const TTON: Template[] = [
  ({ p, points }) => [`${points} fra ${p}.`, "Solid runde."],
  ({ p }) => [`${p} er over hundre.`, "Det er et skikkelig besøk."],
];
const TBUST: Template[] = [
  ({ p }) => [`Au, ${p} går over.`, "Det svir."],
  ({ p }) => [`Over streken for ${p}.`, "Runden teller ikke."],
];
const TCHECK: Template[] = [
  ({ p, points }) => [`${p} tar den ut på ${points}!`, "Iskald avslutning."],
  ({ p }) => [`Dobbelen sitter, ${p}!`, "Det var nervene i orden."],
];
const TMATCH: Template[] = [
  ({ p, o }) => [`Kampen er over, ${p} vinner!`, o ? `${o} må vente til neste gang.` : "Fortjent."],
  ({ p }) => [`${p} tar seieren!`, "Se på den jubelen."],
];
const TLEG: Template[] = [({ p }) => [`${p} tar legget.`, "Videre til neste."]];
const TTRIPLE: Template[] = [
  ({ p, num }) => [`Trippel ${num} fra ${p}!`],
  ({ p, num }) => [`${p} treffer trippel ${num}.`, "Rent og pent."],
];
const TBULL: Template[] = [({ p }) => [`Bull! ${p} sentrerer.`], ({ p }) => [`Rett i midten, ${p}!`, "Det er presisjon."]];
const TCLOSED: Template[] = [({ p, num }) => [`${num} er lukket for ${p}.`], ({ p, num }) => [`${p} lukker ${num}.`, "Videre."]];
const TCOMEBACK: Template[] = [({ p }) => [`${p} er på vei tilbake!`, "Dette snur seg."]];

const TEMPLATES: Record<ShowEvent["kind"], Template[]> = {
  "180": T180,
  ton: TTON,
  bust: TBUST,
  checkout: TCHECK,
  leg: TLEG,
  match: TMATCH,
  triple: TTRIPLE,
  bull: TBULL,
  closed: TCLOSED,
  comeback: TCOMEBACK,
};

/** Who is at the centre of an event. */
export function subjectOf(e: ShowEvent): string {
  return e.kind === "leg" || e.kind === "match" ? e.winner : e.player;
}

/**
 * The one or two lines the commentators say for something that happened at the board. Pure: the variant is chosen with `rnd`
 * (Math.random by default, a fixed one in tests). The first line goes to Kåre, the second to Tove.
 */
export function commentate(e: ShowEvent, ctx: CommentaryContext, rnd: Rnd = Math.random): CommentaryLine[] {
  const p = subjectOf(e);
  const other = e.kind === "leg" || e.kind === "match" ? e.loser : p === ctx.me ? ctx.opponent : ctx.me;
  const o = other ?? null;
  let lines = pick(TEMPLATES[e.kind], rnd)({
    p,
    o,
    n: ctx.count180?.[p] ?? 1,
    points: "points" in e ? e.points : 0,
    num: "number" in e ? e.number : 0,
  });
  // The rival gets a remark when they are the one who threw it or lost to the player.
  if (ctx.rival && o && (e.kind === "match" && p === ctx.me && o === ctx.rival)) lines = [lines[0], `Og ${ctx.rival} får svi over det.`];
  else if (ctx.rival && p === ctx.rival && e.kind === "180") lines = [lines[0], `${ctx.rival} setter presset på.`];
  return lines.slice(0, 2).map((text, i) => ({ who: i === 0 ? "Kåre" : "Tove", text }));
}

/** Whether the crowd goes up for it, down for it, or says nothing. */
export function crowdOf(e: ShowEvent): "cheer" | "uff" | null {
  if (e.kind === "180" || e.kind === "checkout" || e.kind === "match") return "cheer";
  if (e.kind === "bust") return "uff";
  return null;
}
