"use client";

import Link from "next/link";
import { useRoster, type PlayerRecord } from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { ScreenTop } from "@/components/ScreenTop";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** One player or team, as a row that opens its own page: the name, the picture, the sound and the team name are
 *  changed there, and it is where a player or a team is deleted. The numbers are on Statistikk. */
function Row({ p }: { p: PlayerRecord }) {
  return (
    <Link
      href={`/spillere/${encodeURIComponent(p.name)}`}
      className={`flex items-center gap-4 shadow-panel rounded-xl px-4 ${FOCUS_RING}`}
      style={{ background: "var(--color-surface)", minHeight: "3.75rem" }}
    >
      <span className="rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <span style={{ color: avatarAccent(p.name) }}>{p.name.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{p.name}</span>
        <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
          {p.kind === "team" && p.members?.length ? `${p.members.join(", ")} · ` : ""}
          {p.matchesPlayed} {p.matchesPlayed === 1 ? "kamp" : "kamper"}
        </span>
      </span>
      <span aria-hidden style={{ color: "var(--color-muted)", fontSize: "1.4rem" }}>›</span>
    </Link>
  );
}

/** Spillere: every player and team, to change or delete. Their numbers are on Statistikk. */
export default function PlayersPage() {
  const roster = useRoster();
  const players = roster.filter((p) => p.kind !== "team");
  const teams = roster.filter((p) => p.kind === "team");

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Spillere" backHref="/" />

        {roster.length === 0 ? (
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            Ingen spillere ennå
          </p>
        ) : (
          <p className="mb-4" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
            Trykk på en spiller eller et lag for å endre navn, bilde og lyd, gi laget nytt navn eller slette. Tallene ligger under Statistikk.
          </p>
        )}

        {teams.length > 0 && players.length > 0 && <p className="section-label mb-2">SPILLERE</p>}
        <div className="space-y-2">
          {players.map((p) => (
            <Row key={p.name} p={p} />
          ))}
        </div>

        {teams.length > 0 && (
          <>
            <p className="section-label mb-2 mt-8">LAG</p>
            <div className="space-y-2">
              {teams.map((p) => (
                <Row key={p.name} p={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
