"use client";

import { useSyncExternalStore } from "react";
import { ensurePlayer } from "@/lib/storage";
import { applyTeamCard, getTeamCardsSnapshot, subscribeTeamCards, type PersonRef, type TeamCard } from "@/lib/teamCards";
import { firstKit } from "@/lib/teamKit";
import type { NamedTeam } from "@/lib/teamNames";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const SHOWN = 8;
const NO_CARDS: TeamCard[] = [];

/**
 * Teams that have played before, one tap each. Choosing one puts its people into the match and
 * its name on the next free team — the way to bring a team back that used to mean creating a
 * "player" called "Vadla & Lars". Only shown once there is something to show.
 */
export function SavedTeams({ onPick }: { onPick: (card: TeamCard) => void }) {
  const cards = useSyncExternalStore(subscribeTeamCards, getTeamCardsSnapshot, () => NO_CARDS);
  if (cards.length === 0) return null;

  return (
    <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
      <p className="section-label text-center mb-3">TIDLIGERE LAG</p>
      <div className="flex flex-wrap justify-center gap-2">
        {cards.slice(0, SHOWN).map((card) => (
          <button
            key={card.members.join("|")}
            type="button"
            onClick={() => onPick(card)}
            className={`tactile flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-left ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            aria-label={`${card.name}: ${card.members.join(", ")}`}
          >
            <TeamKit kit={firstKit(card.members)} size={26} />
            <span className="min-w-0">
              <span className="block truncate" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
                {card.name}
              </span>
              <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>
                {card.members.join(", ")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * What choosing a card does to the screen's state: the card's people join the pool (and are
 * saved as players if they are somehow not), and it takes the next free team. The screens each
 * hold their own people and teams, so this hands back a function that works on whatever they
 * currently hold.
 */
export function useTeamCard<P extends PersonRef>(people: P[], teams: NamedTeam[], apply: (people: P[], teams: NamedTeam[]) => void) {
  return (card: TeamCard) => {
    const known = new Set(people.map((p) => p.name.toLowerCase()));
    card.members.filter((m) => !known.has(m.toLowerCase())).forEach((m) => ensurePlayer(m));
    const next = applyTeamCard(card, people, teams, (name) => ({ name, isBot: false }) as unknown as P);
    apply(next.people, next.teams);
  };
}
