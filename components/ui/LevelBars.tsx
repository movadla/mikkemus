import type { BotLevel } from "@/lib/botLevels";

/** How strong a bot is, as three bars (the six levels in pairs): filled from the left, in teal. Level 1 is the sharpest, so it has all three. Says the strength to a screen reader too. */
export function LevelBars({ level, name }: { level: BotLevel; name?: string }) {
  const strength = 7 - Number(level);
  const filled = Math.min(3, Math.max(1, Math.ceil(strength / 2)));
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={`${name ? `${name}, ` : ""}styrke ${strength} av 6`}>
      {[1, 2, 3].map((n) => (
        <i key={n} aria-hidden style={{ display: "block", width: 4, height: 4 + n * 3, borderRadius: 1, background: n <= filled ? "var(--color-teal)" : "var(--color-cell)" }} />
      ))}
    </span>
  );
}
