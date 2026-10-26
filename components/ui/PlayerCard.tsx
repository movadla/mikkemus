import type { CSSProperties, ReactNode } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import { Avatar, MorphAvatar, TeamAvatar } from "./Avatar";

/**
 * A player as a card to collect: the face in the player's own colour, the name, a figure that says how they stand (the rating), and
 * whatever the place has to add underneath. One card for the profile ("poster") and for a lineup or a podium ("card"), so a person
 * looks the same wherever they turn up. The colour is the same one as their ring, their stripe in a row and their line in a chart.
 */
export function PlayerCard({
  name,
  photo,
  caption,
  figure,
  figureLabel,
  bot = false,
  members,
  size = "poster",
  morph = false,
  children,
}: {
  name: string;
  photo?: string | null;
  /** A line under the name: "Lag", the members, the number of matches. */
  caption?: ReactNode;
  /** The big figure at the end of the head. */
  figure?: ReactNode;
  figureLabel?: string;
  bot?: boolean;
  /** The people of a team without a picture of its own: their faces stand in for it. */
  members?: string[];
  size?: "poster" | "card";
  /** The face grows into the one on the profile and back (see MorphAvatar). */
  morph?: boolean;
  children?: ReactNode;
}) {
  const poster = size === "poster";
  const Face = morph ? MorphAvatar : Avatar;
  return (
    <section className="player-card edge edge-sheen" style={{ "--pc": avatarAccent(name), "--edge-accent": avatarAccent(name) } as CSSProperties} aria-label={name}>
      <span aria-hidden className="sheen" />
      <div className="player-card-head" style={{ padding: poster ? "1.5rem 1.25rem 1rem" : "1rem" }}>
        {members && members.length > 0 && !photo ? <TeamAvatar name={name} members={members} size={poster ? "xxl" : "l"} /> : <Face name={name} photo={photo} size={poster ? "xxl" : "l"} bot={bot} />}
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate" style={{ color: "var(--color-cream)", fontSize: poster ? "var(--text-num)" : "var(--text-title)", lineHeight: 1.1 }}>
            {name}
          </h2>
          {caption && <p className="truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{caption}</p>}
        </div>
        {figure !== undefined && (
          <div className="shrink-0 text-right">
            <p className="font-display" style={{ color: "var(--pc)", fontSize: poster ? "2.4rem" : "var(--text-num)", lineHeight: 1, textShadow: "var(--shadow-text)" }}>
              {figure}
            </p>
            {figureLabel && <p className="section-label">{figureLabel}</p>}
          </div>
        )}
      </div>
      {children && <div className="relative" style={{ padding: poster ? "0 1.25rem 1.25rem" : "0 1rem 1rem" }}>{children}</div>}
    </section>
  );
}
