/** Decorative chalk-drawn dartboard flourish — purely visual, no game data. */
export function DartboardGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-cream)" strokeWidth="2" opacity="0.35" />
      <circle cx="40" cy="40" r="24" fill="none" stroke="var(--color-cream)" strokeWidth="1.5" opacity="0.3" />
      <circle cx="40" cy="40" r="12" fill="none" stroke="var(--color-cream)" strokeWidth="1.5" opacity="0.3" />
      <circle cx="40" cy="40" r="3.5" fill="var(--color-gold)" opacity="0.7" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i * 36 * Math.PI) / 180;
        const x1 = 40 + 12 * Math.sin(a);
        const y1 = 40 - 12 * Math.cos(a);
        const x2 = 40 + 36 * Math.sin(a);
        const y2 = 40 - 36 * Math.cos(a);
        return (
          <line
            key={i}
            x1={x1.toFixed(1)}
            y1={y1.toFixed(1)}
            x2={x2.toFixed(1)}
            y2={y2.toFixed(1)}
            stroke="var(--color-cream)"
            strokeWidth="1"
            opacity="0.2"
          />
        );
      })}
    </svg>
  );
}
