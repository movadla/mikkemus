"use client";

import { useState } from "react";
import { ensurePlayer } from "@/lib/storage";
import type { BotLevel, TeamMember } from "@/lib/botLevels";
import { RULES, baseOf, botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { rememberTeamNames } from "@/lib/teamNames";
import { rememberTeamCards } from "@/lib/teamCards";
import { markPlayersUsed } from "@/lib/recentPlayers";
import { savedPeople, splitPeople, teamPeople, toMember, toNamedTeam, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { PeopleIcon, PersonIcon } from "./icons";
import { PlayerPicker } from "./PlayerPicker";
import { RulesPicker } from "./RulesPicker";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";
import { TeamPicker } from "./TeamPicker";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The two ways to play, as a pair of outlined choices — not two teal buttons that look like Start. */
export function ModeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="flex gap-2 mb-6" role="radiogroup" aria-label="Hvem spiller">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`tactile flex-1 rounded-lg font-medium flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={{
              minHeight: "2.75rem",
              background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)",
              color: selected ? "var(--color-teal)" : "var(--color-muted)",
              border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Saves the people of a match that is starting: a new name becomes a player now, not when it was
 * typed, and everyone comes first in the list next time. Bots and guests have no record.
 */
export function commitPeople(people: Person[]) {
  const saved = savedPeople(people);
  saved.forEach((name) => ensurePlayer(name));
  markPlayersUsed(saved);
}

/** The same for teams: the names the user chose, the teams as cards, and their people. A team
 *  with a bot in it is not remembered as a card — picking it later would make the bot a person. */
export function commitTeams(teams: PickedTeam[]) {
  const named = teams.map(toNamedTeam);
  rememberTeamNames(named);
  rememberTeamCards(named.filter((_, i) => !teams[i].members.some((m) => m.isBot)));
  commitPeople(teamPeople(teams));
}

export function SetupScreen({
  onStart,
  onHome,
  title = "Enkeltkamp",
  variantSelectable = true,
  scolia = null,
}: {
  onStart: (
    players: string[],
    botLevels: Record<string, BotLevel>,
    teamRosters?: Record<string, TeamMember[]>,
    guestPlayers?: Record<string, true>,
    variant?: GameVariant
  ) => void;
  onHome?: () => void;
  /** Overridden by other modes (e.g. Bull-duell) that reuse this same player picker. */
  title?: React.ReactNode;
  /** Whether the crosses-per-row choice is offered — Bull-duell has its own game and hides it. */
  variantSelectable?: boolean;
  /** The board's status, for the dot in the screen top. */
  scolia?: { label: string; color: string } | null;
}) {
  const [mode, setMode] = useState<"individual" | "team">("individual");
  const [variant, setVariant] = useState<GameVariant>("standard");
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<PickedTeam[]>([]);

  // The longer games have no bots — see botsSupported. Bots already added when the length is
  // changed are not removed behind the user's back; the start button waits until they are.
  const botsAllowed = botsSupported(variant);
  const teamProblem = teamSetupProblem(teams, botsAllowed);
  const individualProblem = individualSetupProblem(
    people.map((p) => p.name),
    !botsAllowed && people.some((p) => p.isBot),
  );
  const crosses = variantSelectable ? `${RULES[baseOf(variant)].target} kryss` : null;

  function startIndividualGame() {
    if (individualProblem) return;
    commitPeople(people);
    const { players, botLevels, guestPlayers } = splitPeople(people);
    // The stand rule belongs to team play; a lone player has no one to hand over to.
    onStart(players, botLevels, undefined, guestPlayers, withStandRule(variant, false));
  }

  function startTeamGame() {
    if (teamProblem) return;
    commitTeams(teams);
    const teamRosters: Record<string, TeamMember[]> = {};
    teams.forEach((t) => {
      teamRosters[t.name] = t.members.map(toMember);
    });
    onStart(
      teams.map((t) => t.name),
      {},
      teamRosters,
      undefined,
      variant
    );
  }

  return (
    <div className="animate-screen-enter screen has-sticky-action" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title={title} onBack={onHome} scolia={scolia} />

        <ModeToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: "individual", label: "Hver for seg", icon: <PersonIcon className="w-4 h-4" /> },
            { value: "team", label: "Lag", icon: <PeopleIcon className="w-4 h-4" /> },
          ]}
        />

        {/* Which game. Shared by both modes, with the stand rule offered only where a team has
            several members to alternate between. */}
        {variantSelectable && <RulesPicker variant={variant} onChange={setVariant} teamPlay={mode === "team"} />}

        {mode === "individual" && (
          <>
            <PlayerPicker people={people} onChange={setPeople} botsAllowed={botsAllowed} guests />
            <StickyAction
              onClick={startIndividualGame}
              ready={!individualProblem}
              summary={setupSummary([`${people.length} ${people.length === 1 ? "spiller" : "spillere"}`, crosses])}
              reason={individualProblem}
            >
              Start kampen
            </StickyAction>
          </>
        )}

        {mode === "team" && (
          <>
            <TeamPicker teams={teams} onChange={setTeams} botsAllowed={botsAllowed} />
            <StickyAction
              onClick={startTeamGame}
              ready={!teamProblem}
              summary={setupSummary([`${teams.length} lag`, crosses])}
              reason={teamProblem}
            >
              Start kampen
            </StickyAction>
          </>
        )}
      </div>
    </div>
  );
}
