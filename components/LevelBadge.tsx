import { botLevelMedal, type BotLevel } from "@/lib/botLevels";
import { MedalIcon } from "./icons";

const PLACE_COLOR = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

/** The medal of the three strongest bot levels, drawn beside the name; nothing for the others. */
export function LevelBadge({ level }: { level: BotLevel }) {
  const medal = botLevelMedal(level);
  if (medal === null) return null;
  return (
    <span aria-hidden style={{ color: PLACE_COLOR[medal], display: "inline-flex" }}>
      <MedalIcon className="w-4 h-4" />
    </span>
  );
}
