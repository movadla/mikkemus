import type { Step } from "./game";

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
export function sectorAt([x, y]: [number, number]): string {
  const r = Math.hypot(x, y);
  if (r > DOUBLE_OUTER_RADIUS) return "None";
  if (r <= BULL_INNER_RADIUS) return "Bull";
  if (r <= BULL_OUTER_RADIUS) return "25";

  let theta = angleOf([x, y]);
  if (theta < 0) theta += 2 * Math.PI;
  const wedgeAngle = (2 * Math.PI) / NUMBER_ORDER.length;
  const wedge = Math.round(theta / wedgeAngle) % NUMBER_ORDER.length;
  const number = NUMBER_ORDER[wedge];

  if (r >= TRIPLE_INNER_RADIUS && r <= TRIPLE_OUTER_RADIUS) return `T${number}`;
  if (r >= DOUBLE_INNER_RADIUS && r <= DOUBLE_OUTER_RADIUS) return `D${number}`;
  return `S${number}`;
}
