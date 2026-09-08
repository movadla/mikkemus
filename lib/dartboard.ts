import type { Progress, Step } from "./game";
import { parseSector, stepForSector } from "./scoliaMapping";

// Standard dartboard number layout, clockwise starting from straight up (12 o'clock).
const NUMBER_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Standard steel-tip radii in millimetres from board center — matches real
// Scolia coordinate samples observed from the relay log (e.g. a genuine "T1"
// throw landed at [23, 98], ~101mm out, right in the 99–107mm triple band).
export const BULL_INNER_RADIUS = 6.35;
export const BULL_OUTER_RADIUS = 15.9;
export const TRIPLE_INNER_RADIUS = 99;
export const TRIPLE_OUTER_RADIUS = 107;
export const DOUBLE_INNER_RADIUS = 162;
export const DOUBLE_OUTER_RADIUS = 170;
const TRIPLE_RADIUS = 103; // mid-band of the triple ring (99–107mm)
const DOUBLE_RADIUS = 166; // mid-band of the double ring (162–170mm)
const OUTER_SINGLE_RADIUS = 134.5; // mid-band between triple and double (107–162mm)
export const DOUBLE_RING_OUTER = 170;

function angleForNumber(n: number): number {
  const index = NUMBER_ORDER.indexOf(n);
  return (index * 18 * Math.PI) / 180; // radians, clockwise from straight up
}

function pointAt(radiusMm: number, angleRad: number): [number, number] {
  return [radiusMm * Math.sin(angleRad), radiusMm * Math.cos(angleRad)];
}

function angleOf([x, y]: [number, number]): number {
  return Math.atan2(x, y); // radians clockwise from straight up, inverse of pointAt
}

export type ThrowAccuracy = { distance: number; horizontal: number; vertical: number };

/**
 * How far a physical throw landed from "the" target for the step it's judged
 * against — the MED/MHD/MVD dispersion metrics (mean euclidean/horizontal/
 * vertical distance) Scolia itself reports for training routines, applied
 * here to a free-form game rather than a single-target drill:
 * - A number step (20–14) has one real target: the center of that number's
 *   outer-single band.
 * - D and T don't have "the" number once pre-banking any double/triple
 *   counts (see isRegistrable in lib/game.ts) — there's no principled way to
 *   guess which number was being aimed at, so only radial accuracy is
 *   judged: the target sits on the double/triple ring at the SAME angle the
 *   dart actually landed at.
 * - BULL is always dead center.
 * Returns null if the coordinate isn't a finite pair (defensive only —
 * Scolia is expected to always report one for a real detected throw).
 */
export function throwAccuracy(step: Step, actual: [number, number]): ThrowAccuracy | null {
  const [ax, ay] = actual;
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return null;

  let target: [number, number];
  if (step === "BULL") target = [0, 0];
  else if (step === "D") target = pointAt(DOUBLE_RADIUS, angleOf(actual));
  else if (step === "T") target = pointAt(TRIPLE_RADIUS, angleOf(actual));
  else target = pointAt(OUTER_SINGLE_RADIUS, angleForNumber(Number(step)));

  const dx = ax - target[0];
  const dy = ay - target[1];
  return { distance: Math.hypot(dx, dy), horizontal: Math.abs(dx), vertical: Math.abs(dy) };
}

export type AimTarget = { ring: "S" | "D" | "T"; number: number } | { ring: "BULL" };

/** The ideal landing point (board-center-relative mm) for a given ring/number — the bot's aim point. */
export function aimPointFor(target: AimTarget): [number, number] {
  if (target.ring === "BULL") return [0, 0];
  const radius = target.ring === "T" ? TRIPLE_RADIUS : target.ring === "D" ? DOUBLE_RADIUS : OUTER_SINGLE_RADIUS;
  return pointAt(radius, angleForNumber(target.number));
}

/**
 * Inverse of the coordinate system above: classifies a physical landing point into
 * the same Scolia sector-string format parseSector() expects ("T20", "D5", "S17",
 * "25", "Bull", "None") — used by the bot to score its own simulated throws through
 * exactly the same scoring pipeline a real Scolia-reported throw goes through, so
 * the bot's plan can never diverge from how a dart is actually judged.
 */
// Half-width of one number's wedge (18° sectors around the board), in
// radians — shared by sectorAt's own wedge lookup and the luck geometry
// below, so both use exactly the same wedge boundaries.
const WEDGE_HALF_ANGLE = Math.PI / NUMBER_ORDER.length;

/** Which of the 20 numbers a given angle (radians, same convention as
 *  angleOf) falls closest to — the wedge lookup sectorAt already needed,
 *  pulled out so the luck calculation below can reuse it too. */
function numberForAngle(theta: number): number {
  let t = theta;
  if (t < 0) t += 2 * Math.PI;
  const wedge = Math.round(t / (2 * WEDGE_HALF_ANGLE)) % NUMBER_ORDER.length;
  return NUMBER_ORDER[wedge];
}

export function sectorAt([x, y]: [number, number]): string {
  const r = Math.hypot(x, y);
  if (r > DOUBLE_OUTER_RADIUS) return "None";
  if (r <= BULL_INNER_RADIUS) return "Bull";
  if (r <= BULL_OUTER_RADIUS) return "25";

  const number = numberForAngle(angleOf([x, y]));

  if (r >= TRIPLE_INNER_RADIUS && r <= TRIPLE_OUTER_RADIUS) return `T${number}`;
  if (r >= DOUBLE_INNER_RADIUS && r <= DOUBLE_OUTER_RADIUS) return `D${number}`;
  return `S${number}`;
}

// ---- "Expected Goals" (flaks/uflaks) ----------------------------------

type LuckTarget = { ring: "BULL" } | { ring: "S" | "D" | "T"; number: number };

/**
 * What the player is assumed to have been aiming at for THIS dart. Trusts
 * whatever ring the dart actually landed in for Bull/T/D unconditionally —
 * there is no way to tell a deliberate pre-bank from a lucky drift using
 * only coordinates (see isRegistrable in lib/game.ts: a double/triple can
 * legally be pre-banked at any time, not just once the numbers are done),
 * and trying to guess would misjudge a real, intentional pre-banked triple
 * as an absurd "lucky" fluke. Only falls back to the naive "current step"
 * (numbers in order, then D, then T, then BULL) when the dart landed in a
 * single band or missed the board entirely — matching the house-rule
 * simplification this stat is explicitly built around.
 */
function inferLuckTarget(actual: [number, number], activeStepAtThrow: Step | null): LuckTarget | null {
  const sector = sectorAt(actual);
  if (sector === "Bull" || sector === "25") return { ring: "BULL" };
  const tripleMatch = /^T(\d+)$/.exec(sector);
  if (tripleMatch) return { ring: "T", number: Number(tripleMatch[1]) };
  const doubleMatch = /^D(\d+)$/.exec(sector);
  if (doubleMatch) return { ring: "D", number: Number(doubleMatch[1]) };

  if (activeStepAtThrow === null) return null;
  if (activeStepAtThrow === "BULL") return { ring: "BULL" };
  if (activeStepAtThrow === "D" || activeStepAtThrow === "T") {
    return { ring: activeStepAtThrow, number: numberForAngle(angleOf(actual)) };
  }
  return { ring: "S", number: Number(activeStepAtThrow) };
}

type RadialBand = { inner: number; outer: number };

/** Which radial band a distance-from-center falls in, and its two edges.
 *  The band beyond the board ("miss") is given the double ring's own width
 *  so a throw drifting further and further out fades smoothly to "not
 *  close to anything" instead of dividing by a near-zero width. */
function radialBandFor(r: number): RadialBand {
  if (r <= BULL_INNER_RADIUS) return { inner: 0, outer: BULL_INNER_RADIUS };
  if (r <= BULL_OUTER_RADIUS) return { inner: BULL_INNER_RADIUS, outer: BULL_OUTER_RADIUS };
  if (r < TRIPLE_INNER_RADIUS) return { inner: BULL_OUTER_RADIUS, outer: TRIPLE_INNER_RADIUS };
  if (r <= TRIPLE_OUTER_RADIUS) return { inner: TRIPLE_INNER_RADIUS, outer: TRIPLE_OUTER_RADIUS };
  if (r < DOUBLE_INNER_RADIUS) return { inner: TRIPLE_OUTER_RADIUS, outer: DOUBLE_INNER_RADIUS };
  if (r <= DOUBLE_OUTER_RADIUS) return { inner: DOUBLE_INNER_RADIUS, outer: DOUBLE_OUTER_RADIUS };
  const missBandWidth = DOUBLE_OUTER_RADIUS - DOUBLE_INNER_RADIUS;
  return { inner: DOUBLE_OUTER_RADIUS, outer: DOUBLE_OUTER_RADIUS + missBandWidth };
}

/** Normalized distance from r to the nearest edge of its radial band (0 =
 *  on the edge, 1 = as far as possible from it), plus the radius to nudge
 *  to in order to land just past that same edge. The innermost band (true
 *  bull) is a solid disk, not a ring — its center (r=0) isn't a boundary,
 *  so it's judged against its one real edge only, over the FULL band width
 *  rather than half of it. */
function radialProximity(r: number, band: RadialBand): { normDist: number; nudgedR: number } {
  if (band.inner === 0) {
    // r=0 (true center) is as far from the one real edge as this band
    // allows — safe, so normDist=1 there; r=band.outer is the edge itself,
    // so normDist=0. (Same "0=edge, 1=safe" convention as the ring case
    // below, just measured from center instead of from a band midpoint.)
    const normDist = band.outer > 0 ? 1 - r / band.outer : 1;
    return { normDist: Math.max(0, Math.min(1, normDist)), nudgedR: band.outer + 0.1 };
  }
  const halfWidth = (band.outer - band.inner) / 2;
  const nearestIsOuter = Math.abs(r - band.outer) < Math.abs(r - band.inner);
  return {
    normDist: halfWidth > 0 ? Math.min(Math.abs(r - band.inner), Math.abs(r - band.outer)) / halfWidth : 1,
    nudgedR: nearestIsOuter ? band.outer + 0.1 : Math.max(0.05, band.inner - 0.1),
  };
}

/** How many crosses this sector is worth right now, capped by however much
 *  room is left in the relevant step (0 once that step is already full, or
 *  if the sector can't score at all). Reuses the exact same scoring
 *  pipeline (parseSector → stepForSector) a real Scolia throw goes
 *  through, so "value" can never diverge from how a dart is actually
 *  judged by the rest of the app. */
function valueOf(sector: string, progress: Progress): number {
  const { step, crosses } = stepForSector(parseSector(sector, false));
  if (!step) return 0;
  return Math.min(crosses, Math.max(0, 3 - progress[step]));
}

/**
 * A triple/double landing on the player's OWN active number can end up two
 * ways (see classifyThrow in lib/scoliaMapping.ts and PendingAmbiguous in
 * lib/game.ts): staying on T/D as a normal ring cross, or being redirected
 * to finish the number instead (worth 3x/2x crosses there) — either
 * because that's the only sensible outcome once the ring is already full,
 * or because the player later chooses the redirect at Confirm.
 *
 * Takes a raw sector string rather than the already-resolved `target` so it
 * can be applied uniformly to BOTH sides of a luckForThrow comparison — the
 * dart's actual landing AND the coordinate nudged across the nearest
 * boundary. A single near a double/triple ring's inner edge has its
 * "other side" resolve to that T/D sector; without this, the comparison
 * would undervalue how much a real double/triple there could have been
 * worth, since only a DIRECT T/D hit got the redirect consideration before.
 * Mirrors classifyThrow's own "is this T/D hit on my own active number"
 * condition exactly, so the two can never drift apart.
 */
function valueWithRedirect(sector: string, activeStepAtThrow: Step | null, progress: Progress): number {
  // Mirrors classifyThrow's early-bullseye house rule (see lib/scoliaMapping.ts): thrown
  // before BULL is up, the red bull scores one double, not a bull. Valuing it as a bull
  // here would price the dart at something the game never actually pays out.
  if (sector === "Bull" && activeStepAtThrow !== "BULL") {
    return Math.min(1, Math.max(0, 3 - progress["D"]));
  }

  const base = valueOf(sector, progress);
  if (activeStepAtThrow === null || activeStepAtThrow === "D" || activeStepAtThrow === "T" || activeStepAtThrow === "BULL") return base;
  const match = /^([TD])(\d+)$/.exec(sector);
  if (!match || Number(match[2]) !== Number(activeStepAtThrow)) return base;
  const multiplier = match[1] === "T" ? 3 : 2;
  const redirectValue = Math.min(multiplier, Math.max(0, 3 - progress[activeStepAtThrow]));
  return Math.max(base, redirectValue);
}

/** Which of the 10 game steps a dart's xG is attributed to — wherever it
 *  was actually judged (where it landed, or the active number for a
 *  single/miss), regardless of how a nearby boundary's value (see
 *  valueWithRedirect) affected the NUMBER. */
function stepForTarget(target: LuckTarget): Step {
  if (target.ring === "BULL") return "BULL";
  if (target.ring === "T" || target.ring === "D") return target.ring;
  return String(target.number) as Step;
}

/**
 * "Expected Goals" for a single dart, expressed directly in crosses (0–3) —
 * the same unit the game itself scores in. Dead center of whatever the dart
 * is judged against is worth exactly that field's value; a dart sitting
 * exactly on a boundary is worth the AVERAGE of the two neighboring values
 * (it could just as easily have landed on either side); everything in
 * between is a linear blend based on `proximity` (0 = center, 1 = boundary):
 *
 *   xG = actualValue + (proximity / 2) × (otherSideValue − actualValue)
 *
 * ~ the field's own exact value when nothing was close (dead center), and
 * blends toward the neighbor's value near a boundary — even when that
 * neighbor is worth the same (e.g. between two still-needed triples, see
 * valueOf), in which case the blend is a no-op and xG just stays at that
 * shared value. `valueWithRedirect` is applied to BOTH sides of that blend
 * (not just the actual landing), so a single sitting right next to a
 * double/triple ring on the player's own active number correctly reflects
 * how much that double/triple could have been worth, not just its plain
 * ring value.
 *
 * Returns null when no target could be inferred at all (see
 * inferLuckTarget) — callers should exclude these from any average rather
 * than treating a null as a neutral 0. Otherwise returns which of the 10
 * steps this dart belongs to alongside its xG, so callers can track
 * "Expected Goals" broken down per section rather than one overall mean.
 */
export function luckForThrow(
  actual: [number, number],
  activeStepAtThrow: Step | null,
  progress: Progress,
): { step: Step; xg: number } | null {
  const target = inferLuckTarget(actual, activeStepAtThrow);
  if (!target) return null;

  const r = Math.hypot(actual[0], actual[1]);
  const theta = angleOf(actual);
  const band = radialBandFor(r);
  const radial = radialProximity(r, band);
  const radialNudge: [number, number] = pointAt(radial.nudgedR, theta);

  let angularNormDist = Infinity;
  let angularNudge: [number, number] | null = null;
  if (target.ring !== "BULL") {
    const center = angleForNumber(target.number);
    let diff = theta - center;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    angularNormDist = Math.abs(Math.abs(diff) - WEDGE_HALF_ANGLE) / WEDGE_HALF_ANGLE;
    const edgeAngle = diff >= 0 ? center + WEDGE_HALF_ANGLE : center - WEDGE_HALF_ANGLE;
    angularNudge = pointAt(r, diff >= 0 ? edgeAngle + 0.01 : edgeAngle - 0.01);
  }

  const primaryNormDist = Math.min(1, Math.min(radial.normDist, angularNormDist));
  const proximity = 1 - primaryNormDist;
  const nudged = angularNormDist < radial.normDist && angularNudge ? angularNudge : radialNudge;

  const actualValue = valueWithRedirect(sectorAt(actual), activeStepAtThrow, progress);
  const otherSideValue = valueWithRedirect(sectorAt(nudged), activeStepAtThrow, progress);
  const xg = actualValue + (proximity / 2) * (otherSideValue - actualValue);
  return { step: stepForTarget(target), xg };
}

// ---- "Expected Goals" for Bull-duell -----------------------------------

/** Bull-duell only ever scores bull itself — 2 points for inner bull, 1 for
 *  outer bull ("25"), 0 for anything else. Reuses the exact same sector
 *  strings sectorAt already produces, so this can never drift from how a
 *  real dart is classified. */
function bullPointsFor(sector: string): number {
  if (sector === "Bull") return 2;
  if (sector === "25") return 1;
  return 0;
}

/**
 * How far past green's outer edge proximity keeps fading before settling at
 * a flat 0 — half the green ring's own width (4.775mm), matching the pace
 * proximity already decays at approaching this exact edge from the green
 * side (radialProximity fades a ring to 0 over half its width too). Once a
 * dart is this far past the edge, there's nothing meaningful left to be
 * "close" to — it's just a miss.
 */
const BULL_DUEL_MISS_FADE_WIDTH = (BULL_OUTER_RADIUS - BULL_INNER_RADIUS) / 2;

/**
 * Proximity to green's outer edge for a dart that landed outside it —
 * deliberately NOT radialBandFor + radialProximity, which would borrow the
 * real board's next scoring boundary (the triple ring, 99mm away) as the
 * far edge of a two-sided band. That boundary means nothing in Bull-duell
 * (there is no triple ring to be close to), and treating it as a real edge
 * would make proximity fade out and then rise again approaching it — a
 * dart 40mm outside the green ring would register as meaningfully "close to
 * something" again. Outside green there is only ONE real boundary (green's
 * own edge); this fades one-sidedly away from it and stays at 0, never
 * spiking back up.
 */
function missProximity(r: number): number {
  const d = r - BULL_OUTER_RADIUS;
  return Math.max(0, 1 - d / BULL_DUEL_MISS_FADE_WIDTH);
}

/**
 * "Expected Goals" for a single Bull-duell dart, expressed directly in
 * points (0–2) — the same unit the game itself scores in, so it reads just
 * like football xG: a mean xG of 1.3 across a match is directly comparable
 * to the points actually scored. Dead center of a ring is worth exactly
 * that ring's value; a dart sitting exactly on a boundary is worth the
 * AVERAGE of the two neighboring values (it could just as easily have
 * landed on either side); everything in between is a linear blend based on
 * `proximity` (0 = center, 1 = boundary):
 *
 *   xG = actualValue + (proximity / 2) × (otherSideValue − actualValue)
 *
 * A clean miss with no boundary nearby (see missProximity) skips the blend
 * entirely and returns the actual value outright (0) — there's nothing
 * left to be uncertain about.
 *
 * Unlike the main game, a Bull-duell target has no fixed cap (a player can
 * choose any target score) — so the "how much is this dart really worth"
 * cap is `target - pointsSoFar` (how many points are actually still needed
 * to win) rather than a fixed step size. A hit that would only be worth 1 of
 * its 2 points because the player only needed 1 to win is correctly judged
 * as no more valuable than a plain green hit would have been.
 */
export function luckForBullDuelThrow(actual: [number, number], pointsSoFar: number, target: number): number {
  const r = Math.hypot(actual[0], actual[1]);
  const theta = angleOf(actual);
  const remaining = Math.max(0, target - pointsSoFar);
  const actualValue = Math.min(bullPointsFor(sectorAt(actual)), remaining);

  let proximity: number;
  let nudged: [number, number];
  if (r <= BULL_OUTER_RADIUS) {
    // Inside bull entirely — both of its real edges matter, same two-sided
    // geometry the main game uses for an ordinary ring/disk.
    const band: RadialBand = r <= BULL_INNER_RADIUS ? { inner: 0, outer: BULL_INNER_RADIUS } : { inner: BULL_INNER_RADIUS, outer: BULL_OUTER_RADIUS };
    const radial = radialProximity(r, band);
    proximity = 1 - radial.normDist;
    nudged = pointAt(radial.nudgedR, theta);
  } else {
    proximity = missProximity(r);
    if (proximity === 0) return actualValue;
    nudged = pointAt(BULL_OUTER_RADIUS - 0.1, theta);
  }

  const otherSideValue = Math.min(bullPointsFor(sectorAt(nudged)), remaining);
  return actualValue + (proximity / 2) * (otherSideValue - actualValue);
}
