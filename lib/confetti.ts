export type ConfettiPiece = { left: string; rotate: string; delay: string; color: string };

const COLORS = ["var(--color-gold)", "var(--color-cream)", "var(--color-gold-strong)"];

/**
 * Procedurally scatters `count` confetti pieces across the width, with randomized
 * rotation/stagger/color — replaces the old hand-picked 12-piece array duplicated
 * across every winner screen, so "more confetti" is just a bigger number here.
 * Call once per mount (e.g. via useMemo) — re-calling reshuffles the layout.
 */
export function generateConfetti(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    const jitter = (Math.random() - 0.5) * (100 / count) * 1.6;
    const left = Math.min(97, Math.max(1, (i / Math.max(1, count - 1)) * 100 + jitter));
    pieces.push({
      left: `${left.toFixed(1)}%`,
      rotate: `${Math.round(Math.random() * 70 - 35)}deg`,
      delay: `${Math.round(Math.random() * 380)}ms`,
      color: COLORS[i % COLORS.length],
    });
  }
  return pieces;
}
