"use client";

import { useRoster, type PlayerRecord } from "@/lib/storage";
import { ScreenTop } from "@/components/ScreenTop";
import { PeopleIcon } from "@/components/icons";
import { MorphAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Row } from "@/components/ui/Row";
import { Section } from "@/components/ui/Section";

function PlayerRow({ p }: { p: PlayerRecord }) {
  const matches = `${p.matchesPlayed} ${p.matchesPlayed === 1 ? "kamp" : "kamper"}`;
  return <Row href={`/spillere/${encodeURIComponent(p.name)}`} leading={<MorphAvatar name={p.name} photo={p.photo} size="m" />} title={p.name} subtitle={p.kind === "team" && p.members?.length ? `${p.members.join(", ")} · ${matches}` : matches} />;
}

/** Spillere: every player and team. A row opens its own page, where name, picture, shirt and sound are changed. */
export default function PlayersPage() {
  const roster = useRoster();
  const players = roster.filter((p) => p.kind !== "team");
  const teams = roster.filter((p) => p.kind === "team");

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner wide">
        <ScreenTop title="Spillere" />

        {roster.length === 0 ? (
          <EmptyState icon={<PeopleIcon className="w-6 h-6" />} title="Ingen spillere ennå" action={<Button href="/" variant="primary">Start en kamp</Button>} />
        ) : (
          <div className="wide-columns">
            <Section label={teams.length > 0 ? "Spillere" : undefined}>
              <div className="space-y-2 stagger">
                {players.map((p) => (
                  <PlayerRow key={p.name} p={p} />
                ))}
              </div>
            </Section>
            {teams.length > 0 && (
              <Section label="Lag">
                <div className="space-y-2 stagger">
                  {teams.map((p) => (
                    <PlayerRow key={p.name} p={p} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
