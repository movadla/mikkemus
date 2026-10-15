"use client";

import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { TeamKit } from "./TeamKit";

export type Thrower = { name: string; photo?: string | null; isBot: boolean };

export type ThrowerTeam = {
  name: string;
  /** The team's own picture, if it has one — see PhotoButton on the team's page. */
  photo?: string | null;
  members: Thrower[];
  /** Index into `members` of whoever throws now. */
  activeIdx: number;
};

function Avatar({ who, size, active = true, ring = false }: { who: Thrower; size: number; active?: boolean; ring?: boolean }) {
  const accent = avatarAccent(who.name);
  return (
    <span
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center ${ring ? "animate-thrower-ring" : ""}`}
      style={{
        width: size,
        height: size,
        background: "var(--color-cell)",
        border: `${active ? 3 : 1.5}px solid ${active ? "var(--color-teal)" : accent}`,
        opacity: active ? 1 : 0.6,
        color: accent,
        fontSize: size * 0.42,
        fontFamily: "var(--font-display)",
      }}
      aria-hidden
    >
      {who.isBot ? (
        "🤖"
      ) : who.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={who.photo} alt="" className="w-full h-full object-cover" />
      ) : (
        who.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/**
 * Who is throwing right now — the one thing every player at the board needs to read at a glance.
 *
 * A large picture (or initial) in a pulsing teal ring, KASTER over the name, and for a team its
 * shirt, its picture and its name under that; the rest of the team stands to the right in the
 * order they come up, the next one marked. A thrower who stays on under the stand rule says so,
 * because otherwise "Per again" looks like a bug.
 *
 * Keyed on the turn by the caller, so it replays its entrance when the thrower changes — the
 * "new round" cue — and is quiet when `animate` is off.
 */
export function ThrowerBar({
  thrower,
  team,
  kit,
  stood,
  animate,
  compact = false,
}: {
  thrower: Thrower;
  team: ThrowerTeam | null;
  /** The team's shirt, drawn beside its name. */
  kit?: Kit | null;
  /** The thrower kept their place after three counting darts (the stand rule). */
  stood: boolean;
  animate: boolean;
  compact?: boolean;
}) {
  // The rest of the team in the order they come up next, so the first of them is the next thrower.
  const mates = team ? team.members.map((_, i) => team.members[(team.activeIdx + 1 + i) % team.members.length]).slice(0, team.members.length - 1) : [];
  const photoSize = compact ? 44 : 72;
  const teamPhotoSize = compact ? 18 : 26;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`thrower-bar shadow-panel flex items-center rounded-xl ${animate ? "animate-thrower-in" : ""}`}
      style={{
        gap: compact ? "0.6rem" : "0.8rem",
        background: "var(--color-surface)",
        border: `1px solid var(--color-border)`,
        borderLeft: `4px solid var(--color-teal)`,
        padding: compact ? "0.4rem 0.6rem" : "0.6rem 0.8rem",
      }}
    >
      <Avatar who={thrower} size={photoSize} ring={animate} />
      <div className="min-w-0 flex-1">
        <p style={{ color: "var(--color-teal)", fontSize: compact ? "0.62rem" : "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, lineHeight: 1.2 }}>
          {thrower.isBot ? "Kaster …" : "Kaster"}
        </p>
        <p
          className="truncate"
          style={{ color: "var(--color-cream)", fontFamily: "var(--font-display)", fontSize: compact ? "1.25rem" : "1.9rem", lineHeight: 1.05 }}
        >
          {thrower.name}
        </p>
        {team && (
          <p className="truncate flex items-center gap-1.5 mt-1" style={{ color: "var(--color-cream)", opacity: 0.85, fontSize: compact ? "0.72rem" : "0.85rem", fontWeight: 600 }}>
            {kit && <TeamKit kit={kit} size={compact ? 18 : 24} />}
            {team.photo && (
              <span className="rounded-full overflow-hidden shrink-0" style={{ width: teamPhotoSize, height: teamPhotoSize, border: "1px solid var(--color-border)" }} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.photo} alt="" className="w-full h-full object-cover" />
              </span>
            )}
            <span className="truncate">{team.name}</span>
          </p>
        )}
        {stood && (
          <p style={{ color: "var(--color-gold-strong)", fontSize: "0.72rem", fontWeight: 600 }}>Står – kaster igjen</p>
        )}
      </div>
      {mates.length > 0 && (
        <div className="flex items-end gap-2 shrink-0" aria-label={`Neste på laget: ${mates.map((m) => m.name).join(", ")}`}>
          {mates.map((m, i) => (
            <span key={m.name} className="flex flex-col items-center" style={{ maxWidth: compact ? 40 : 56 }}>
              {!compact && (
                <span style={{ color: i === 0 ? "var(--color-muted)" : "transparent", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 }}>
                  neste
                </span>
              )}
              <Avatar who={m} size={compact ? 26 : 38} active={false} />
              {!compact && (
                <span className="truncate w-full text-center" style={{ color: "var(--color-muted)", fontSize: "0.68rem" }}>
                  {m.name}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
