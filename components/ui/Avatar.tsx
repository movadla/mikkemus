"use client";

import { createContext, useContext, ViewTransition } from "react";
import { CharacterFace } from "../CharacterFigure";
import { avatarAccent } from "@/lib/avatarAccent";
import { useRoster } from "@/lib/storage";
import { faceSrc, opponentOf } from "@/lib/opponents";
import { characterOf, poseSrc } from "@/lib/characters";

/**
 * In the career the player is their character, not a letter: a game that is played inside it (a match of a cup, a duel) gives the name and the
 * character here, and the face of that name is drawn as the character, wherever the game draws it.
 */
export const CareerFaceContext = createContext<{ name: string; character?: string } | null>(null);

/**
 * The teams of a tournament in the career, by name: a team is drawn with the faces of its members (the player's own as their character), wherever
 * the app draws a face for that name.
 */
export const TeamsContext = createContext<Record<string, string[]>>({});

/** Two faces in one circle, a half each: a team. */
export function TeamFaces({ members, character, me }: { members: string[]; character?: string; me?: string }) {
  return (
    <span className="team-faces" aria-hidden>
      {members.slice(0, 2).map((m) => {
        const mine = m === me;
        const c = characterOf(character);
        return (
          <span key={m} className="team-half" style={mine ? ({ background: c.tint } as React.CSSProperties) : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mine ? poseSrc(c, "noytral") : faceSrc(opponentOf(m).face)} alt="" draggable={false} style={{ objectPosition: mine ? "50% 4%" : facePosition(opponentOf(m).face) }} />
          </span>
        );
      })}
    </span>
  );
}

/** The five sizes of a face in the app, in pixels (any other size is a `px`). */
export const AVATAR_SIZES = { xs: 24, s: 32, m: 44, l: 64, xl: 96, xxl: 120 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * One face for everyone, in one frame: a double ring (the colour that is theirs, then a thin gap), a hairline of light just inside the
 * picture, a soft vignette so a bright photo and a dark illustration sit alike, and a short shadow under. With no photo it is the first
 * letter on a wash of their colour. The ring is theirs except for what they are at the moment: teal when it is their turn, gold when
 * they have won. A bot has a dashed ring and a face made from its name (BotFace). No glow: the frame is the same size of fuss everywhere.
 */
/** Where the face sits in a portrait, for a round crop of the top of it: the pictures with a hand and a dart (the n set) have their heads lower than the studio portraits (the p set). */
const facePosition = (face: number) => (face >= 100 ? "50% 30%" : "50% 8%");

export function Avatar({
  name,
  photo,
  size = "m",
  px: pixels,
  state = "idle",
  bot = false,
}: {
  name: string;
  photo?: string | null;
  size?: AvatarSize;
  /** A size in pixels that is none of the five (a larger portrait, a card's own). Wins over `size`. */
  px?: number;
  state?: "idle" | "active" | "winner";
  bot?: boolean;
}) {
  const px = pixels ?? AVATAR_SIZES[size];
  const career = useContext(CareerFaceContext);
  const teams = useContext(TeamsContext);
  const team = !photo ? teams[name] : undefined;
  const mine = !bot && !photo && !team && career?.name === name ? career : null;
  const accent = avatarAccent(name);
  const ring = state === "winner" ? "var(--color-gold)" : state === "active" ? "var(--color-teal)" : accent;
  const ringWidth = px >= 96 ? 4 : px >= 64 ? 3 : px >= 44 ? 2.5 : 2;
  const gap = px >= 64 ? 3 : 2;
  return (
    <span
      aria-hidden
      className="rounded-full shrink-0 inline-flex"
      style={{
        width: px,
        height: px,
        padding: gap,
        border: `${ringWidth}px ${bot ? "dashed" : "solid"} ${ring}`,
        boxShadow: px >= 44 ? "var(--shadow-avatar)" : undefined,
      }}
    >
      <span
        className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{
          background: photo || bot || mine || team ? "var(--color-cell)" : `radial-gradient(circle at 30% 24%, color-mix(in srgb, ${accent} 40%, var(--color-surface)), color-mix(in srgb, ${accent} 12%, var(--color-surface)))`,
          color: "var(--color-cream)",
          fontSize: px * 0.4,
          fontFamily: "var(--font-display)",
        }}
      >
        {team ? (
          <TeamFaces members={team} character={career?.character} me={career?.name} />
        ) : bot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faceSrc(opponentOf(name.replace(/ (\d+)$/, "")).face)} alt="" className="w-full h-full object-cover" style={{ objectPosition: facePosition(opponentOf(name.replace(/ (d+)$/, "")).face) }} draggable={false} />
        ) : photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : mine ? (
          <CharacterFace id={mine.character} px={Math.max(16, px - 2 * (ringWidth + gap))} />
        ) : (
          name.charAt(0).toUpperCase()
        )}
        <span aria-hidden className="avatar-lens" />
      </span>
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

/**
 * The face of a team: its own picture if it has one, otherwise the faces of its members side by side, overlapping, up to three — where
 * it used to be a letter on a coloured disc, which said nothing about who the team is.
 */
export function TeamAvatar({ name, photo, members, size = "m", px: pixels }: { name: string; photo?: string | null; members?: string[]; size?: AvatarSize; px?: number }) {
  const roster = useRoster();
  const px = pixels ?? AVATAR_SIZES[size];
  const faces = (members ?? []).slice(0, 3);
  if (photo || faces.length === 0) return <Avatar name={name} photo={photo} size={size} px={pixels} />;
  const small = Math.round(px * 0.74);
  const step = Math.round(small * 0.6);
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center" style={{ width: small + step * (faces.length - 1), height: px }}>
      {faces.map((m, i) => (
        <span key={m} style={{ marginLeft: i === 0 ? 0 : step - small, zIndex: faces.length - i, display: "inline-flex" }}>
          <Avatar name={m} photo={roster.find((r) => r.name === m)?.photo} px={small} />
        </span>
      ))}
    </span>
  );
}
