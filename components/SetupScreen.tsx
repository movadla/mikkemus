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
import { FxPicker } from "./FxPicker";
import { PlayerPicker } from "./PlayerPicker";
import { RulesPicker } from "./RulesPicker";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";
import { TeamPicker } from "./TeamPicker";
import { Segmented } from "./ui/Segmented";
import { SwitchRow } from "./ui/Switch";

/** The two ways to play (or any other pair or trio of options), as one segmented control. */
export function ModeToggle<T extends string>({
  value,
  onChange,
  options,
  label = "Hvem spiller",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: React.ReactNode }[];
  label?: string;
}) {
  return (
    <div className="mb-6">
      <Segmented value={value} onChange={onChange} options={options} label={label} />
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

/** The same for teams: the names the user chose, the teams as cards, and their people. A team with a bot in it is
 *  remembered as a card only when the user gave it a name, and the card keeps which members are bots. */
export function commitTeams(teams: PickedTeam[]) {
  const named = teams.map(toNamedTeam);
  rememberTeamNames(named);
  rememberTeamCards(
    named.flatMap((t, i) => {
      const bots = Object.fromEntries(teams[i].members.filter((m) => m.isBot && m.botLevel).map((m) => [m.name, m.botLevel!]));
      const hasBot = Object.keys(bots).length > 0;
      if (hasBot && !teams[i].custom) return [];
      return [hasBot ? { ...t, bots } : t];
    }),
  );
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
    variant?: GameVariant,
    /** Played for fun: nothing from the match is written to the statistics. */
    statsOff?: boolean,
    /** Advanced: every dart keyed in by hand as the bed it hit, a miss included. */
    exactEntry?: boolean
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
  // Ticked under the start button: the match is played without a trace in the statistics.
  const [statsOff, setStatsOff] = useState(false);
  // Avanserte innstillinger: off by default. In it: crosses per row (three, as everyone plays it), the stand rule for teams, how much happens
  // on screen, and keying in every dart.
  const [advanced, setAdvanced] = useState(false);
  const [exactEntry, setExactEntry] = useState(false);

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
    onStart(players, botLevels, undefined, guestPlayers, withStandRule(variant, false), statsOff, exactEntry);
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
      variant,
      statsOff,
      exactEntry
    );
  }

  const noStatsToggle = <SwitchRow label="Spill uten at statistikken teller" checked={statsOff} onChange={setStatsOff} />;

  const advancedSettings = (
    <div className="w-full flex flex-col gap-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
      <SwitchRow
        label="Avanserte innstillinger"
        hint="Kryss per rad, animasjon, pil for pil og statistikk"
        checked={advanced}
        onChange={(on) => {
          setAdvanced(on);
          // What is hidden is not left on: closing it puts the game back as everyone plays it.
          if (!on) {
            setExactEntry(false);
            setVariant("standard");
            setStatsOff(false);
          }
        }}
      />
      {advanced && variantSelectable && (
        // Kryss per rad, and in team play the stand rule: the game is three crosses unless this says otherwise.
        <div className="w-full pt-2 text-left">
          <RulesPicker variant={variant} onChange={setVariant} teamPlay={mode === "team"} />
        </div>
      )}
      {advanced && (
        <div className="w-full pb-1">
          {/* Enkel, Vanlig, Party, Full party: the same device setting as in Innstillinger, chosen here before the match. */}
          <FxPicker />
        </div>
      )}
      {advanced && (
        // Played without a trace in the statistics.
        <div className="w-full">{noStatsToggle}</div>
      )}
      {advanced && (
        <SwitchRow label="Legg inn hver pil for hånd" hint="Velg hva hver pil traff" checked={exactEntry} onChange={setExactEntry} />
      )}
    </div>
  );

  return (
    <div className="animate-screen-push screen has-sticky-action">
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


        {mode === "individual" && (
          <>
            <PlayerPicker people={people} onChange={setPeople} botsAllowed={botsAllowed} guests />
            {variantSelectable && <div className="mt-4">{advancedSettings}</div>}
            <StickyAction
              onClick={startIndividualGame}
              ready={!individualProblem}
              summary={setupSummary([`${people.length} ${people.length === 1 ? "spiller" : "spillere"}`, crosses])}
              reason={individualProblem}
              below={!variantSelectable ? noStatsToggle : undefined}
            >
              Start kampen
            </StickyAction>
          </>
        )}

        {mode === "team" && (
          <>
            <TeamPicker teams={teams} onChange={setTeams} botsAllowed={botsAllowed} />
            {variantSelectable && <div className="mt-4">{advancedSettings}</div>}
            <StickyAction
              onClick={startTeamGame}
              ready={!teamProblem}
              summary={setupSummary([`${teams.length} lag`, crosses])}
              reason={teamProblem}
              below={!variantSelectable ? noStatsToggle : undefined}
            >
              Start kampen
            </StickyAction>
          </>
        )}
      </div>
    </div>
  );
}
