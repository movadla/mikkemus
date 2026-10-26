"use client";

import { useRoster, type PlayerRecord } from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { ScreenTop } from "@/components/ScreenTop";
import { PeopleIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Row } from "@/components/ui/Row";
import { Section } from "@/components/ui/Section";

/** The round picture of a player, or the first letter in the colour that is theirs. */
function Avatar({ p }: { p: PlayerRecord }) {
  return (
    <span className="rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ width: "2.5rem", height: "2.5rem", background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
      {p.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: avatarAccent(p.name) }}>{p.name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

function PlayerRow({ p }: { p: PlayerRecord }) {
  const matches = `${p.matchesPlayed} ${p.matchesPlayed === 1 ? "kamp" : "kamper"}`;
  return <Row href={`/spillere/${encodeURIComponent(p.name)}`} leading={<Avatar p={p} />} title={p.name} subtitle={p.kind === "team" && p.members?.length ? `${p.members.join(", ")} · ${matches}` : matches} />;
}

/** Spillere: every player and team. A row opens its own page, where name, picture, shirt and sound are changed. */
export default function PlayersPage() {
  const roster = useRoster();
  const players = roster.filter((p) => p.kind !== "team");
  const teams = roster.filter((p) => p.kind === "team");

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Spillere" />

        {roster.length === 0 ? (
          <EmptyState icon={<PeopleIcon className="w-6 h-6" />} title="Ingen spillere ennå" />
        ) : (
          <>
            <Section label={teams.length > 0 ? "Spillere" : undefined}>
              <div className="space-y-2">
                {players.map((p) => (
                  <PlayerRow key={p.name} p={p} />
                ))}
              </div>
            </Section>
            {teams.length > 0 && (
              <Section label="Lag">
                <div className="space-y-2">
                  {teams.map((p) => (
                    <PlayerRow key={p.name} p={p} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
