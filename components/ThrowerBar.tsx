"use client";

import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { TeamKit } from "./TeamKit";

export type Thrower = { name: string; photo?: string | null; isBot: boolean };

export type ThrowerTeam = {
  name: string;
  members: Thrower[];
  /** Index into `members` of whoever throws now. */
  activeIdx: number;
};

function Avatar({ who, size, active = true }: { who: Thrower; size: number; active?: boolean }) {
  const accent = avatarAccent(who.name);
  return (
    <span
      className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: "var(--color-cell)",
        border: `${active ? 2.5 : 1.5}px solid ${accent}`,
        opacity: active ? 1 : 0.55,
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
 * It used to be a small toast saying "Per sin tur" that floated over the column header, and only
 * in team play; in singel play the only cue was a highlighted name in the column. This is a
 * fixed bar instead: a large photo (or initial) and name, the team it is throwing for, and the
 * rest of the team dimmed beside it so the rotation is visible. A thrower who stays on under the
 * stand rule says so, because otherwise "Per again" looks like a bug.
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
  const mates = team ? team.members.filter((_, i) => i !== team.activeIdx) : [];
  const photoSize = compact ? 34 : 52;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`thrower-bar shadow-panel flex items-center gap-3 rounded-xl ${animate ? "animate-thrower-in" : ""}`}
      style={{
        background: "var(--color-surface)",
        border: `1px solid var(--color-border)`,
        borderLeft: `4px solid ${avatarAccent(thrower.name)}`,
        padding: compact ? "0.35rem 0.6rem" : "0.5rem 0.8rem",
      }}
    >
      <Avatar who={thrower} size={photoSize} />
      <div className="min-w-0 flex-1">
        {team && (
          <p className="truncate flex items-center gap-1.5" style={{ color: "var(--color-label)", fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {kit && <TeamKit kit={kit} size={compact ? 14 : 18} />}
            <span className="truncate">{team.name}</span>
          </p>
        )}
        <p
          className="truncate"
          style={{ color: "var(--color-cream)", fontFamily: "var(--font-display)", fontSize: compact ? "1.05rem" : "1.5rem", lineHeight: 1.1 }}
        >
          {thrower.name}
          <span style={{ color: "var(--color-teal)", fontFamily: "var(--font-sans)", fontSize: "0.8rem", marginLeft: "0.5rem" }}>
            {thrower.isBot ? "kaster …" : "kaster"}
          </span>
        </p>
        {stood && (
          <p style={{ color: "var(--color-gold-strong)", fontSize: "0.72rem", fontWeight: 600 }}>Står – kaster igjen</p>
        )}
      </div>
      {mates.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0" aria-label={`Resten av laget: ${mates.map((m) => m.name).join(", ")}`}>
          {mates.map((m) => (
            <span key={m.name} className="flex flex-col items-center" style={{ maxWidth: compact ? 36 : 52 }}>
              <Avatar who={m} size={compact ? 22 : 30} active={false} />
              {!compact && (
                <span className="truncate w-full text-center" style={{ color: "var(--color-muted)", fontSize: "0.62rem" }}>
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
