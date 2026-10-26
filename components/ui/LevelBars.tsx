import type { BotLevel } from "@/lib/botLevels";

/** How strong a bot is, as three bars (the six levels in pairs): filled from the left, in teal. Says the level to a screen reader too. */
export function LevelBars({ level, name }: { level: BotLevel; name?: string }) {
  const filled = Math.ceil(Number(level) / 2) || 1;
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={`${name ? `${name}, ` : ""}nivå ${level} av 6`}>
      {[1, 2, 3].map((n) => (
        <i key={n} aria-hidden style={{ display: "block", width: 4, height: 4 + n * 3, borderRadius: 1, background: n <= filled ? "var(--color-teal)" : "var(--color-cell)" }} />
      ))}
    </span>
  );
}
