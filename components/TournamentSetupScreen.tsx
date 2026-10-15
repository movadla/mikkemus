"use client";

import { useState } from "react";
import { MAX_WITHOUT_GROUP_SCREEN, type Participant, type TournamentMode } from "@/lib/tournament";
import { RULES, baseOf, botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { splitPeople, toMember, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { PeopleIcon, PersonIcon } from "./icons";
import { PlayerPicker } from "./PlayerPicker";
import { RulesPicker } from "./RulesPicker";
import { ScreenTop } from "./ScreenTop";
import { ModeToggle, commitPeople, commitTeams } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { TeamPicker } from "./TeamPicker";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const MIN_INDIVIDUAL = 3;
const MIN_TEAMS = 2;

/** The people of a previously-submitted individual tournament — used to restore state when
 *  navigating back from group-setup (see initialMode/initialParticipants). */
function peopleFromParticipants(participants: Participant[]): Person[] {
  return participants.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: p.botLevel }));
}

/** Coming back from the group screen: these names are final, so they stay as they are rather
 *  than being rebuilt from the members. */
function teamsFromParticipants(participants: Participant[]): PickedTeam[] {
  return participants.map((p) => ({ name: p.name, members: (p.members ?? []).map((m) => ({ name: m.name, isBot: m.isBot, botLevel: m.botLevel })), custom: true }));
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
  // Individual to begin with, as in Enkeltkamp, so the whole screen is there from the first moment.
  const [mode, setMode] = useState<TournamentMode>(initialMode ?? "individual");
  const [variant, setVariant] = useState<GameVariant>(initialVariant);
  const [people, setPeople] = useState<Person[]>(() => (initialMode === "individual" && initialParticipants ? peopleFromParticipants(initialParticipants) : []));
  const [teams, setTeams] = useState<PickedTeam[]>(() => (initialMode === "team" && initialParticipants ? teamsFromParticipants(initialParticipants) : []));

  // The longer games have no bots — see botsSupported. Nothing is removed behind the user's back;
  // the button just waits until the bots are taken out or the game is shortened.
  const botsAllowed = botsSupported(variant);
  const problem =
    mode === "team"
      ? teamSetupProblem(teams, botsAllowed, MIN_TEAMS)
      : individualSetupProblem(people.map((p) => p.name), !botsAllowed && people.some((p) => p.isBot), MIN_INDIVIDUAL);

  // Up to four take part in one group and need no group screen — the tournament is made at once.
  const participantCount = mode === "team" ? teams.length : people.length;
  const makesGroupsAtOnce = participantCount <= MAX_WITHOUT_GROUP_SCREEN;
  const crosses = `${RULES[baseOf(variant)].target} kryss`;

  function handleNext(adjustGroups: boolean = false) {
    if (problem) return;
    if (mode === "individual") {
      commitPeople(people);
      const { botLevels } = splitPeople(people);
      const participants: Participant[] = people.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: botLevels[p.name] }));
      onNext("individual", participants, withStandRule(variant, false), adjustGroups);
    } else {
      commitTeams(teams);
      const participants: Participant[] = teams.map((t) => ({ name: t.name, isBot: false, members: t.members.map(toMember) }));
      onNext("team", participants, variant, adjustGroups);
    }
  }

  return (
    <div className="animate-screen-enter screen has-sticky-action" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Ny turnering" onBack={onBack} />

        <ModeToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: "individual", label: "Hver for seg", icon: <PersonIcon className="w-4 h-4" /> },
            { value: "team", label: "Lag", icon: <PeopleIcon className="w-4 h-4" /> },
          ]}
        />

        {/* Which game every match is played as — the same picker Enkeltkamp uses. */}
        <RulesPicker variant={variant} onChange={setVariant} teamPlay={mode === "team"} />

        {mode === "team" ? (
          <TeamPicker teams={teams} onChange={setTeams} botsAllowed={botsAllowed} />
        ) : (
          <PlayerPicker people={people} onChange={setPeople} botsAllowed={botsAllowed} />
        )}

        {/* The group screen is one tap away for the small tournaments that skip it. */}
        {makesGroupsAtOnce && !problem && (
          <div className="flex justify-center mb-4">
            <button
              type="button"
              onClick={() => handleNext(true)}
              className={`tactile px-4 rounded-lg text-sm ${FOCUS_RING}`}
              style={{ minHeight: "2.75rem", color: "var(--color-muted)", background: "transparent", border: "1px solid var(--color-border)" }}
            >
              Endre grupper
            </button>
          </div>
        )}

        <StickyAction
          onClick={() => handleNext(false)}
          ready={!problem}
          summary={setupSummary([mode === "team" ? `${teams.length} lag` : `${people.length} spillere`, crosses])}
          reason={problem}
        >
          {makesGroupsAtOnce ? "Opprett turnering" : "Neste: grupper"}
        </StickyAction>
      </div>
    </div>
  );
}
