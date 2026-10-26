import { avatarAccent } from "@/lib/avatarAccent";
import { BotIcon } from "../icons";

/** The four sizes of a face in the app, in pixels. */
export const AVATAR_SIZES = { xs: 24, s: 32, m: 44, l: 64 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * One face for everyone: a photo, or the first letter in the colour that is theirs. The ring says what they are at the moment:
 * teal when it is their turn, gold when they have won, dashed for a bot (which also gets its own colour from its name, and a
 * small robot instead of a letter), and quiet otherwise.
 */
export function Avatar({
  name,
  photo,
  size = "m",
  state = "idle",
  bot = false,
}: {
  name: string;
  photo?: string | null;
  size?: AvatarSize;
  state?: "idle" | "active" | "winner";
  bot?: boolean;
}) {
  const px = AVATAR_SIZES[size];
  const accent = avatarAccent(name);
  const ring = state === "winner" ? "var(--color-gold)" : state === "active" ? "var(--color-teal)" : bot ? accent : "var(--color-border)";
  return (
    <span
      aria-hidden
      className="rounded-full overflow-hidden shrink-0 inline-flex items-center justify-center"
      style={{
        width: px,
        height: px,
        background: "var(--color-cell)",
        border: `${px >= 44 ? 2 : 1.5}px ${bot ? "dashed" : "solid"} ${ring}`,
        boxShadow: state === "idle" ? "none" : `0 0 0 2px var(${state === "winner" ? "--gold-soft" : "--teal-soft"})`,
        color: accent,
        fontSize: px * 0.42,
        fontFamily: "var(--font-display)",
      }}
    >
      {bot ? (
        <BotIcon className="w-1/2 h-1/2" />
      ) : photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
