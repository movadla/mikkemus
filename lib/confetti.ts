export type ConfettiPiece = { left: string; rotate: string; delay: string; color: string };

export type RainPiece = ConfettiPiece & { duration: string; fall: string; width: string; height: string };

/**
 * Pieces for the full-screen rain (see .confetti-rain in globals.css) rather than the
 * single burst over the winner card. Each piece gets its own fall duration and a start
 * delay spread across that duration, so the rain is already in progress everywhere on
 * screen instead of arriving as one visible wave from the top.
 */
export function generateConfettiRain(count: number): RainPiece[] {
  const base = generateConfetti(count);
  return base.map((piece) => {
    const duration = 2.4 + Math.random() * 2.6;
    return {
      ...piece,
      // Negative delays start each piece mid-fall, so the screen is full from frame one.
      delay: `${-(Math.random() * duration).toFixed(2)}s`,
      duration: `${duration.toFixed(2)}s`,
      fall: `${105 + Math.random() * 15}vh`,
      width: `${6 + Math.round(Math.random() * 6)}px`,
      height: `${11 + Math.round(Math.random() * 9)}px`,
    };
  });
}

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
