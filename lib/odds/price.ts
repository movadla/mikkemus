/**
 * From probability to price. The fair odds of an outcome are 1/p; a bookmaker's are a little
 * shorter, so that the prices taken together add up to more than a certain thing — the margin.
 * The margin is spread with the power method: every probability is raised to the same power k < 1,
 * with k chosen so that the prices add up to 1 + margin. Unlike taking a fixed share off every
 * price, it keeps a heavy favourite's price above 1 (a 92 % side with a 9 % margin would otherwise
 * be priced below the stake), and it shortens the outsiders a little more than the favourites, as
 * bookmakers do. The margin is widened a little when the probabilities themselves are uncertain (a new player, a match just started), so that a price
 * built on thin knowledge is never the generous one.
 */
export const BASE_MARGIN = 0.05;
export const MIN_P = 0.005;
export const MAX_P = 0.995;
export const MIN_ODDS = 1.01;

export type Priced = { p: number; odds: number };

/** `spread` is the width of the probability interval (0–1); each 0.05 of it adds a point of margin, up to 4. */
export function priceOutcomes(probs: number[], spreads: number[] = [], base: number = BASE_MARGIN): Priced[] {
  const widest = Math.max(0, ...spreads);
  const margin = base + Math.min(0.04, widest * 0.2);
  const clamped = probs.map((p) => Math.min(MAX_P, Math.max(MIN_P, p)));
  const total = clamped.reduce((a, b) => a + b, 0);
  const fair = clamped.map((p) => p / total);
  // Find the power k in [0.4, 1] with Σ pᵢ^k = 1 + margin (the sum falls as k rises, so bisect).
  let lo = 0.4;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fair.reduce((s, p) => s + Math.pow(p, mid), 0) > 1 + margin) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  return fair.map((p) => ({ p, odds: Math.round(Math.max(MIN_ODDS, 1 / Math.pow(p, k)) * 100) / 100 }));
}

/** 2,10 — decimal odds with a comma and two decimals. */
export function formatOdds(odds: number): string {
  return odds.toFixed(2).replace(".", ",");
}

/** 61 % */
export function formatPct(p: number): string {
  const pct = Math.round(p * 100);
  return `${Math.min(99, Math.max(1, pct))} %`;
}
