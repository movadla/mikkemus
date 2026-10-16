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

/** A kit colour at some opacity — the bar is tinted in the team's own colour when it is up. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

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
  run = 0,
  animate,
  compact = false,
  onPickMate,
}: {
  thrower: Thrower;
  team: ThrowerTeam | null;
  /** The team's shirt, drawn beside its name. */
  kit?: Kit | null;
  /** The thrower kept their place after three counting darts (the stand rule). */
  stood: boolean;
  /** Darts in a row that counted — shown from two up, so a lone hit is not announced. */
  run?: number;
  animate: boolean;
  compact?: boolean;
  /** A tap on a teammate's picture: the caller asks whether they should throw now. */
  onPickMate?: (name: string) => void;
}) {
  // The rest of the team in the order they come up next, so the first of them is the next thrower.
  const mates = team ? team.members.map((_, i) => team.members[(team.activeIdx + 1 + i) % team.members.length]).slice(0, team.members.length - 1) : [];
  const photoSize = compact ? 44 : 72;
  const teamPhotoSize = compact ? 18 : 26;
  const kitBadge = compact ? 26 : 40;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`thrower-bar shadow-panel flex items-center rounded-xl ${animate ? "animate-thrower-in" : ""}`}
      style={{
        gap: compact ? "0.6rem" : "0.8rem",
        // A team's turn is in the team's colours: the bar washes from the kit's main colour, and
        // the left edge is the kit, not the app's teal.
        background: kit ? `linear-gradient(90deg, ${tint(kit.primary, 0.32)}, var(--color-surface) 65%)` : "var(--color-surface)",
        border: `1px solid ${kit ? tint(kit.primary, 0.6) : "var(--color-border)"}`,
        borderLeft: `6px solid ${kit ? kit.primary : "var(--color-teal)"}`,
        padding: compact ? "0.4rem 0.6rem" : "0.6rem 0.8rem",
      }}
    >
      <span className="relative shrink-0" style={{ width: photoSize, height: photoSize }}>
        <Avatar who={thrower} size={photoSize} ring={animate} />
        {/* The shirt the thrower is playing in, worn on the picture — big enough to read across the room. */}
        {kit && (
          <span className="absolute" style={{ right: -kitBadge * 0.3, bottom: -kitBadge * 0.15 }} aria-hidden>
            <TeamKit kit={kit} size={kitBadge} />
          </span>
        )}
      </span>
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
            {team.photo && (
              <span className="rounded-full overflow-hidden shrink-0" style={{ width: teamPhotoSize, height: teamPhotoSize, border: "1px solid var(--color-border)" }} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.photo} alt="" className="w-full h-full object-cover" />
              </span>
            )}
            <span className="truncate">{team.name}</span>
          </p>
        )}
        {run >= 2 && (
          <p className="tabular truncate whitespace-nowrap" style={{ color: "var(--color-gold-strong)", fontSize: compact ? "0.72rem" : "0.85rem", fontWeight: 700 }}>
            {compact ? `${run} på rad` : `${run} piler på rad`}
          </p>
        )}
        {stood && (
          <p className="truncate whitespace-nowrap" style={{ color: "var(--color-gold-strong)", fontSize: "0.72rem", fontWeight: 600 }}>{compact ? "Står igjen" : "Står – kaster igjen"}</p>
        )}
      </div>
      {mates.length > 0 && (
        <div className="flex items-end gap-2 shrink-0" aria-label={`Neste på laget: ${mates.map((m) => m.name).join(", ")}`}>
          {mates.map((m, i) => {
            const inner = (
              <>
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
              </>
            );
            // A teammate's picture is a button: tap it to have them throw instead.
            return onPickMate ? (
              <button
                key={m.name}
                type="button"
                onClick={() => onPickMate(m.name)}
                aria-label={`La ${m.name} kaste`}
                className="tactile flex flex-col items-center justify-center rounded-lg"
                style={{ maxWidth: compact ? 44 : 60, minWidth: 44, minHeight: 44 }}
              >
                {inner}
              </button>
            ) : (
              <span key={m.name} className="flex flex-col items-center" style={{ maxWidth: compact ? 40 : 56 }}>
                {inner}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
