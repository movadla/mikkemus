"use client";

import { usePathname } from "next/navigation";
import { useRoster, type PlayerRecord } from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { ScreenTop } from "@/components/ScreenTop";
import { PeopleIcon } from "@/components/icons";
import { Avatar, MorphAvatar, TeamAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavList } from "@/components/ui/NavList";
import { Row } from "@/components/ui/Row";
import { Section } from "@/components/ui/Section";

/** `morph`: the face is named, so it grows into the one on the player's page when a row is opened. Only while no one is open: with a player
 *  open beside the list, two faces would carry the same name at once. */
function PlayerRow({ p, selected, morph }: { p: PlayerRecord; selected: boolean; morph: boolean }) {
  const Face = morph ? MorphAvatar : Avatar;
  const matches = `${p.matchesPlayed} ${p.matchesPlayed === 1 ? "kamp" : "kamper"}`;
  return (
    <Row
      href={`/spillere/${encodeURIComponent(p.name)}`}
      selected={selected}
      accent={avatarAccent(p.name)}
      leading={p.kind === "team" ? <TeamAvatar name={p.name} photo={p.photo} members={p.members} /> : <Face name={p.name} photo={p.photo} size="m" />}
      title={p.name}
      subtitle={p.kind === "team" && p.members?.length ? `${p.members.join(", ")} · ${matches}` : matches}
    />
  );
}

/** A name from the address, which may already be decoded and hold a percent sign: that must not throw. */
function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Every player and team, as the list half of Spillere. On a phone it is the page; from 900 pixels it stays on the left while the
 * chosen player is on the right (see app/spillere/layout.tsx), with the chosen row marked.
 */
export function PlayerList() {
  const roster = useRoster();
  const pathname = usePathname();
  const open = pathname.startsWith("/spillere/") ? safeDecode(pathname.slice("/spillere/".length)).toLowerCase() : null;
  const players = roster.filter((p) => p.kind !== "team");
  const teams = roster.filter((p) => p.kind === "team");
  const rows = (list: PlayerRecord[]) => (
    <NavList className="space-y-2 stagger" label="Spillere">
      {list.map((p) => (
        <PlayerRow key={p.name} p={p} selected={open === p.name.toLowerCase()} morph={open === null} />
      ))}
    </NavList>
  );

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Spillere" />
        {roster.length === 0 ? (
          <EmptyState icon={<PeopleIcon className="w-6 h-6" />} title="Ingen spillere ennå" action={<Button href="/" variant="primary">Start en kamp</Button>} />
        ) : (
          <div className="space-y-6">
            <Section label={teams.length > 0 ? "Spillere" : undefined}>{rows(players)}</Section>
            {teams.length > 0 && <Section label="Lag">{rows(teams)}</Section>}
          </div>
        )}
      </div>
    </div>
  );
}
