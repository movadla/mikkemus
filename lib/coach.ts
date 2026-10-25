import { STEP_LABELS, type Step } from "./game";
import type { AimBias, PlayerRecord } from "./playerRows";

/** One piece of advice: a thing to keep doing, a thing to work on, or something worth knowing. */
export type CoachTip = { tone: "good" | "work" | "info"; title: string; text: string };

export type Coaching = {
  tips: CoachTip[];
  /** How many Scolia-measured darts the advice stands on. */
  darts: number;
};

/** A player is coached once there are this many measured darts to go on — fewer say more about one night than about the player. */
export const MIN_COACH_DARTS = 30;
/** A bias this large, in millimetres, is worth a tip: half the width of the triple ring. */
const BIAS_MM = 4;
/** Darts needed before a direction is reported (the mean of fewer is mostly luck). */
const MIN_BIAS_DARTS = 30;
const MIN_RING_DARTS = 15;
const MIN_ROW_ATTEMPTS = 20;
const NUMBER_ROWS: Step[] = ["20", "19", "18", "17", "16", "15", "14"];

const mm = (v: number) => `${Math.round(Math.abs(v))} mm`;
const pct = (v: number) => `${Math.round(v)} %`;

/** The signed totals of every match that kept them, summed. */
export function sumBias(record: Pick<PlayerRecord, "matchHistory">): AimBias | null {
  let total: AimBias | null = null;
  for (const m of record.matchHistory) {
    if (!m.bias) continue;
    total = total
      ? { n: total.n + m.bias.n, dx: total.dx + m.bias.dx, dy: total.dy + m.bias.dy, rn: total.rn + m.bias.rn, rad: total.rad + m.bias.rad }
      : { ...m.bias };
  }
  return total;
}

function rowPct(record: PlayerRecord, step: Step): { pct: number; attempts: number } | null {
  const s = record.steps[step];
  const attempts = s.hits + s.misses;
  return attempts === 0 ? null : { pct: (s.hits / attempts) * 100, attempts };
}

/**
 * What a darts trainer would say, from what the numbers of a player who has thrown on Scolia show: which way the darts miss
 * the aim, which rows are strong and which weak, the form, and where the
 * spread stands in the group. Only things the data really says — a tip needs enough darts behind it, and a direction needs a
 * miss of at least a few millimetres, so a well-centred thrower hears that rather than an invented fault.
 *
 * `group` is everyone, for comparing the spread; teams are left out of it.
 */
export function coachTips(record: PlayerRecord, group: readonly PlayerRecord[] = []): Coaching {
  const darts = record.accuracy.throws;
  if (record.kind !== "player" || darts < MIN_COACH_DARTS) return { tips: [], darts };
  const tips: (CoachTip & { weight: number })[] = [];
  const add = (weight: number, tone: CoachTip["tone"], title: string, text: string) => tips.push({ weight, tone, title, text });

  // 1. Which way the darts miss the aim. Board axes: a dart that lands lower than the triple aimed at has a negative dy.
  const bias = sumBias(record);
  if (bias && bias.n >= MIN_BIAS_DARTS) {
    const dx = bias.dx / bias.n;
    const dy = bias.dy / bias.n;
    if (Math.abs(dy) >= BIAS_MM) {
      add(100 + Math.abs(dy), "work", dy < 0 ? "Du sikter for lavt" : "Du sikter for høyt", `Dartene dine lander i snitt ${mm(dy)} ${dy < 0 ? "under" : "over"} trippelfeltet du sikter på. Prøv å sikte litt ${dy < 0 ? "høyere" : "lavere"}.`);
    }
    if (Math.abs(dx) >= BIAS_MM) {
      add(100 + Math.abs(dx), "work", dx < 0 ? "Du sikter for mye mot venstre" : "Du sikter for mye mot høyre", `Dartene lander i snitt ${mm(dx)} til ${dx < 0 ? "venstre" : "høyre"} for siktepunktet. Flytt siktet litt mot ${dx < 0 ? "høyre" : "venstre"}.`);
    }
    if (Math.abs(dy) < BIAS_MM && Math.abs(dx) < BIAS_MM) {
      add(60, "good", "Godt sentrert", `I snitt lander dartene innenfor ${BIAS_MM} mm av siktepunktet, så du treffer der du sikter. Nå er det spredningen rundt midten som avgjør.`);
    }
  }
  if (bias && bias.rn >= MIN_RING_DARTS) {
    const r = bias.rad / bias.rn;
    if (Math.abs(r) >= BIAS_MM) {
      add(90 + Math.abs(r), "work", r > 0 ? "Dobbel og trippel: for langt ut" : "Dobbel og trippel: for langt inn", `På dobbel og trippel lander du i snitt ${mm(r)} ${r > 0 ? "utenfor" : "innenfor"} midten av ringen. Sikt litt ${r > 0 ? "innover" : "utover"}.`);
    }
  }

  // 2. The strongest and the weakest number.
  const rows = NUMBER_ROWS.flatMap((s) => {
    const r = rowPct(record, s);
    return r && r.attempts >= MIN_ROW_ATTEMPTS ? [{ step: s, ...r }] : [];
  });
  if (rows.length >= 3) {
    const best = rows.reduce((a, b) => (b.pct > a.pct ? b : a));
    const worst = rows.reduce((a, b) => (b.pct < a.pct ? b : a));
    if (best.pct - worst.pct >= 12) {
      add(70, "good", `Sterkest på ${STEP_LABELS[best.step]}`, `Du treffer ${pct(best.pct)} på ${STEP_LABELS[best.step]}. Det er fasongen å ta med til de andre tallene.`);
      add(80, "work", `Svakest på ${STEP_LABELS[worst.step]}`, `Bare ${pct(worst.pct)} treff på ${STEP_LABELS[worst.step]}. Legg inn noen ekstra piler der på trening.`);
    }
  }

  // Doubles and triples are not compared with the numbers here: their row percentage says little about precision, since a
  // double or triple is not aimed at all the time and is often banked before the row is reached. Where they are aimed at, the
  // signed distance in or out of the ring above is what says something.

  // 3. The bull.
  const bull = rowPct(record, "BULL");
  if (bull && bull.attempts >= MIN_RING_DARTS) {
    if (bull.pct >= 60) add(65, "good", "Trygg på bull", `${pct(bull.pct)} treff på bull — det er en fordel når kampen skal avgjøres.`);
    else if (bull.pct <= 35) add(78, "work", "Bull er tungt", `${pct(bull.pct)} treff på bull. Siden bull ofte avgjør kampen, lønner det seg å øve på den.`);
  }

  // 4. The form: the last three matches against the three before them.
  const played = [...record.matchHistory].filter((m) => m.dartsUsed > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (played.length >= 6) {
    const avg = (xs: typeof played) => xs.reduce((s, m) => s + m.hitPct * m.dartsUsed, 0) / xs.reduce((s, m) => s + m.dartsUsed, 0);
    const recent = avg(played.slice(-3));
    const before = avg(played.slice(-6, -3));
    if (recent - before >= 5) add(72, "good", "Formen er på vei opp", `Treffprosenten er ${Math.round(recent - before)} poeng høyere de tre siste kampene (${pct(recent)} mot ${pct(before)}).`);
    else if (before - recent >= 5) add(74, "work", "Formen har dalt litt", `Treffprosenten er ${Math.round(before - recent)} poeng lavere de tre siste kampene (${pct(recent)} mot ${pct(before)}). Gå tilbake til det som fungerte.`);
  }

  // 5. The spread, against the others.
  const peers = group.filter((p) => p.kind === "player" && p.accuracy.throws >= MIN_COACH_DARTS);
  if (peers.length >= 3 && peers.some((p) => p.name === record.name)) {
    const med = (p: PlayerRecord) => p.accuracy.sumDistance / p.accuracy.throws;
    const sorted = [...peers].sort((a, b) => med(a) - med(b));
    if (sorted[0].name === record.name) add(68, "good", "Jevneste kaster i gruppa", `Ingen av de andre har mindre spredning i dartene enn deg (MED ${Math.round(med(record))} mm).`);
    else if (sorted[sorted.length - 1].name === record.name) add(76, "work", "Størst spredning i gruppa", `Dartene dine ligger lengst fra målet i gruppa (MED ${Math.round(med(record))} mm). Rolig, lik teknikk i hvert kast gir mest.`);
  }

  // The most useful first, but never only faults or only praise when there is some of both.
  const work = tips.filter((t) => t.tone === "work").sort((a, b) => b.weight - a.weight);
  const good = tips.filter((t) => t.tone === "good").sort((a, b) => b.weight - a.weight);
  const picked = [...work.slice(0, 3), ...good.slice(0, 3)];
  picked.sort((a, b) => b.weight - a.weight);
  return { tips: picked.map(({ tone, title, text }) => ({ tone, title, text })), darts };
}
