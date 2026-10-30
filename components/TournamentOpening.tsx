"use client";

import { TIERS, type Tier } from "@/lib/career";
import type { Participant, TournamentMode } from "@/lib/tournament";
import { venueOf, type VenueId } from "@/lib/venues";
import { useRoster } from "@/lib/storage";
import { EventIntro } from "./EventIntro";
import { Avatar } from "./ui/Avatar";

/**
 * The opening of a tournament played outside the career: the place it is played in (a picture of it from outside), the trophy of the step it stands
 * on, its name, how many play, and the faces of the field, so it begins like one of the career's events. TREKK goes on to the draw.
 */
export function TournamentOpening({ venue, name, mode, participants, cupName, trophy, onDone, onBack }: { venue: VenueId; name: string; mode: TournamentMode; participants: Participant[]; cupName?: string; trophy?: string; onDone: () => void; onBack: () => void }) {
  const roster = useRoster();
  const v = venueOf(venue);
  const base = TIERS[v.tier];
  const title = name || cupName || "Turnering";
  // The step the place stands on gives the look; the name, the field and the stake are this tournament's own.
  const tier = { ...base, name: title, stage: v.line, size: participants.length, fee: 0, prizes: {}, trophy: trophy ?? base.trophy, key: v.key } as Tier & { key?: string };
  const teams = mode === "team";
  const faces = teams ? [] : participants.slice(0, 8);
  return (
    <EventIntro
      tier={tier}
      player=""
      plain
      music
      label="TREKK"
      onDone={onDone}
      onBack={onBack}
      backLabel="Tilbake"
      plates={[[teams ? "Lag" : "Spillere", String(participants.length)], ["Sted", v.name], ["Pokal", trophy ?? base.trophy.replace(/-?pokalen$/, "") + "-pokalen"]]}
      extra={
        <div className="ev-field" role="group" aria-label="Feltet">
          {faces.length > 0 ? (
            <ul className="ev-faces">
              {faces.map((p) => (
                <li key={p.name}>
                  <Avatar name={p.name} photo={roster.find((r) => r.name === p.name)?.photo} bot={p.isBot} px={40} />
                </li>
              ))}
              {participants.length > faces.length && <li className="ev-more">+{participants.length - faces.length}</li>}
            </ul>
          ) : (
            <p>{participants.slice(0, 4).map((p) => p.name).join(" · ")}{participants.length > 4 ? ` · +${participants.length - 4}` : ""}</p>
          )}
        </div>
      }
    />
  );
}
