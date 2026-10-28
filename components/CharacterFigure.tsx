/* eslint-disable @next/next/no-img-element -- the characters are fixed files from public/career/chars */
import type { CSSProperties } from "react";
import { characterOf, poseSrc, type Pose } from "@/lib/characters";

/**
 * The player's character in a pose, as a standing figure with a transparent background. It fades out at the foot, since the pictures end at the
 * waist or the hips and the figure stands behind the buttons. `glow` puts a light in the colour of the character behind it.
 */
export function CharacterFigure({ id, pose = "noytral", glow = false, className = "", style, alt = "" }: { id?: string; pose?: Pose; glow?: boolean; className?: string; style?: CSSProperties; alt?: string }) {
  const character = characterOf(id);
  return (
    <span className={`char-figure ${glow ? "char-figure-glow" : ""} ${className}`} style={{ "--tint": character.tint, ...style } as CSSProperties}>
      <img key={pose} src={poseSrc(character, pose)} alt={alt} aria-hidden={alt ? undefined : true} className="char-figure-img" draggable={false} />
    </span>
  );
}

/** Just the face of the character, round, for a line of text ("Lars er med") or a card. */
export function CharacterFace({ id, pose = "noytral", px = 56 }: { id?: string; pose?: Pose; px?: number }) {
  const character = characterOf(id);
  return (
    <span className="char-face" style={{ width: px, height: px, "--tint": character.tint } as CSSProperties}>
      <img src={poseSrc(character, pose)} alt="" aria-hidden draggable={false} />
    </span>
  );
}
