"use client";

import { useState } from "react";
import { MAX_WITHOUT_GROUP_SCREEN, type Participant, type TournamentMode } from "@/lib/tournament";
import type { TeamMember } from "@/lib/botLevels";
import { botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { rememberTeamNames, resolveTeams, teamNameProblems } from "@/lib/teamNames";
import { rememberTeamCards } from "@/lib/teamCards";
import { markPlayersUsed } from "@/lib/recentPlayers";
import { PeopleIcon, PersonIcon } from "./icons";
import { PeoplePicker, type Person } from "./PeoplePicker";
import { PrimaryActionButton } from "./PrimaryActionButton";
import { RulesPicker } from "./RulesPicker";
import { FxPicker } from "./FxPicker";
import { SavedTeams, useTeamCard } from "./SavedTeams";
import { TeamComposer, isTeamSetupReady, type Team } from "./TeamComposer";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** Rebuilds the pool of pickable people from a previously-submitted participant list — used to
 *  restore state when navigating back from group-setup (see initialMode/initialParticipants). */
function peopleFromParticipants(mode: TournamentMode, participants: Participant[]): Person[] {
  if (mode === "individual") {
    return participants.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: p.botLevel }));
  }
  const seen = new Set<string>();
  const pool: Person[] = [];
  participants.forEach((p) => {
    (p.members ?? []).forEach((m) => {
      if (seen.has(m.name)) return;
      seen.add(m.name);
      pool.push({ name: m.name, isBot: m.isBot, botLevel: m.botLevel });
    });
  });
  return pool;
}

function teamsFromParticipants(mode: TournamentMode, participants: Participant[]): Team[] {
  if (mode !== "team") return [{ name: "Lag 1", members: [] }, { name: "Lag 2", members: [] }];
  // Coming back from the group screen: these names are final, so they stay as they are rather
  // than being rebuilt from the members.
  return participants.map((p) => ({ name: p.name, members: (p.members ?? []).map((m) => m.name), custom: true }));
}

export function TournamentSetupScreen({
  onBack,
  onNext,
  initialMode = null,
  initialParticipants = null,
  initialVariant = "standard",
}: {
  onBack: () => void;
  /** `adjustGroups` is true when the user asked to see the group screen even though the tournament
   *  is small enough to make without one. */
  onNext: (mode: TournamentMode, participants: Participant[], variant: GameVariant, adjustGroups: boolean) => void;
  /** Seeds mode/people/teams from a previous submission — lets "Tilbake" from group-setup restore
   *  what was already entered instead of remounting this screen back to a blank slate. */
  initialMode?: TournamentMode | null;
  initialParticipants?: Participant[] | null;
  initialVariant?: GameVariant;
}) {
  // Individual to begin with, as in Enkeltkamp, so the whole screen is there from the first moment
  // instead of waiting for a choice most people make the same way.
  const [mode, setMode] = useState<TournamentMode | null>(initialMode ?? "individual");
  const [variant, setVariant] = useState<GameVariant>(initialVariant);
  const [people, setPeople] = useState<Person[]>(() =>
    initialMode && initialParticipants ? peopleFromParticipants(initialMode, initialParticipants) : []
  );
  const [teams, setTeams] = useState<Team[]>(() =>
    initialMode && initialParticipants
      ? teamsFromParticipants(initialMode, initialParticipants)
      : [{ name: "Lag 1", members: [] }, { name: "Lag 2", members: [] }]
  );

  /** Removing a person from the pool must also drop them from whichever team they were on. */
  function handlePeopleChange(next: Person[]) {
    const removedNames = people.filter((p) => !next.some((n) => n.name === p.name)).map((p) => p.name);
    if (removedNames.length > 0) {
      setTeams((prev) => prev.map((t) => ({ ...t, members: t.members.filter((m) => !removedNames.includes(m)) })));
    }
    setPeople(next);
  }

  // The longer games have no bots — see botsSupported. Nothing is removed behind the user's back;
  // the button just waits until the bots are taken out or the game is shortened.
  const botsAllowed = botsSupported(variant);
  const blockedBots = !botsAllowed && people.some((p) => p.isBot);
  const teamsReady = mode === "team" && isTeamSetupReady(people, teams) && !blockedBots;
  const individualReady = mode === "individual" && people.length >= 3 && !blockedBots;

  const pickTeamCard = useTeamCard(people, teams, (nextPeople, nextTeams) => {
    setPeople(nextPeople);
    setTeams(nextTeams);
  });

  // Up to four take part in one group and need no group screen — the tournament is made at once.
  const participantCount = mode === "team" ? teams.length : people.length;
  const makesGroupsAtOnce = participantCount <= MAX_WITHOUT_GROUP_SCREEN;

  function handleNext(adjustGroups: boolean = false) {
    markPlayersUsed(people.filter((p) => !p.isBot).map((p) => p.name));
    if (mode === "individual") {
      const participants: Participant[] = people.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: p.botLevel }));
      onNext("individual", participants, withStandRule(variant, false), adjustGroups);
    } else if (mode === "team") {
      const playing = resolveTeams(teams);
      if (!teamNameProblems(playing).every((p) => p === null)) return;
      rememberTeamNames(teams.map((t, i) => ({ ...t, name: playing[i].name })));
      rememberTeamCards(playing);
      const participants: Participant[] = playing.map((t) => ({
        name: t.name,
        isBot: false,
        members: t.members.map((name): TeamMember => {
          const person = people.find((p) => p.name === name)!;
          return { name: person.name, isBot: person.isBot, botLevel: person.botLevel };
        }),
      }));
      onNext("team", participants, variant, adjustGroups);
    }
  }

  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-start justify-center px-6 pb-10" style={{ background: "var(--color-bg)", paddingTop: "3.5rem" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <button type="button" onClick={onBack} className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Hjem
          </button>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.7rem", letterSpacing: "0.02em" }}>
            Ny turnering
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        <p className="mb-2 section-label">
          1. INDIVIDUELT ELLER LAG?
        </p>
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode("individual")}
            className={`tactile flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={{
              background: mode === "individual" ? "var(--color-teal)" : "var(--color-surface)",
              color: mode === "individual" ? "var(--color-bg)" : "var(--color-cream)",
              border: "1px solid var(--color-border)",
            }}
          >
            <PersonIcon className="w-4 h-4" />
            Individuelt
          </button>
          <button
            type="button"
            onClick={() => setMode("team")}
            className={`tactile flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={{
              background: mode === "team" ? "var(--color-teal)" : "var(--color-surface)",
              color: mode === "team" ? "var(--color-bg)" : "var(--color-cream)",
              border: "1px solid var(--color-border)",
            }}
          >
            <PeopleIcon className="w-4 h-4" />
            Lag
          </button>
        </div>

        {/* Which game every match is played as — the same picker SetupScreen uses. */}
        <RulesPicker variant={variant} onChange={setVariant} teamPlay={mode === "team"} />
        <FxPicker />

        {mode && (
          <>
            <p className="mb-2 section-label">
              2. DELTAKERE
            </p>

            {mode === "team" && <SavedTeams onPick={pickTeamCard} />}

            <PeoplePicker people={people} onChange={handlePeopleChange} botsAllowed={botsAllowed} />

            {mode === "team" && people.length > 0 && (
              <>
                <p className="mb-2 section-label">
                  3. SETT SAMMEN LAG
                </p>
                <TeamComposer people={people} teams={teams} onChange={setTeams} />
              </>
            )}

            <PrimaryActionButton
              onClick={() => handleNext(false)}
              ready={individualReady || teamsReady}
              hint={
                blockedBots
                  ? "Fjern botene, eller velg færre treff per seksjon"
                  : mode === "team"
                    ? "Trenger minst 2 lag, alle med minst ett medlem, og ingen utildelte spillere"
                    : "Trenger minst 3 deltakere"
              }
            >
              {makesGroupsAtOnce ? "Opprett turnering" : "Neste: juster grupper"}
            </PrimaryActionButton>
            {makesGroupsAtOnce && (individualReady || teamsReady) && (
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => handleNext(true)}
                  className={`tactile px-4 py-2 rounded-lg text-sm ${FOCUS_RING}`}
                  style={{ color: "var(--color-muted)", background: "transparent", border: "1px solid var(--color-border)" }}
                >
                  Endre grupper
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
