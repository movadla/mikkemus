import { ViewTransition } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import { BotIcon } from "../icons";

/** The five sizes of a face in the app, in pixels. */
export const AVATAR_SIZES = { xs: 24, s: 32, m: 44, l: 64, xl: 96 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * One face for everyone: a photo, or the first letter, in the colour that is theirs. The ring is that colour too, except for what they
 * are at the moment: teal when it is their turn, gold when they have won. A bot has a dashed ring, and a small robot instead of a letter.
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
  const ring = state === "winner" ? "var(--color-gold)" : state === "active" ? "var(--color-teal)" : accent;
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

/** A face that grows into the same face on the player's own page (and shrinks back): the two carry one transition name. */
export function MorphAvatar(props: Parameters<typeof Avatar>[0]) {
  return (
    <ViewTransition name={`avatar-${props.name}`} share="morph" default="none">
      <span className="inline-flex">
        <Avatar {...props} />
      </span>
    </ViewTransition>
  );
}
