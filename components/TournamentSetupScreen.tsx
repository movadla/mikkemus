"use client";

import { useState } from "react";
import { type Participant, type TournamentMode } from "@/lib/tournament";
import { DEFAULT_CUP_LEVEL, buildCupParticipants, cupType, makeCup, type CupConfig } from "@/lib/botCup";
import { RULES, baseOf, botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { splitPeople, toMember, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { PeopleIcon, PersonIcon, TrophyIcon } from "./icons";
import { PlayerPicker } from "./PlayerPicker";
import { RulesPicker } from "./RulesPicker";
import { ScreenTop } from "./ScreenTop";
import { CupOptions, type CupChoice } from "./CupOptions";
import { ModeToggle, commitPeople, commitTeams } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { TeamPicker } from "./TeamPicker";

const MIN_INDIVIDUAL = 2;
const MIN_TEAMS = 2;

/** The people of a previously-submitted individual tournament — used to restore state when
 *  navigating back from the draw (see initialMode/initialParticipants). */
function peopleFromParticipants(participants: Participant[]): Person[] {
  return participants.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: p.botLevel }));
}

/** Coming back from the draw: these names are final, so they stay as they are rather
 *  than being rebuilt from the members. */
function teamsFromParticipants(participants: Participant[]): PickedTeam[] {
  return participants.map((p) => ({ name: p.name, members: (p.members ?? []).map((m) => ({ name: m.name, isBot: m.isBot, botLevel: m.botLevel })), custom: true }));
}

export function TournamentSetupScreen({
  onBack,
  onNext,
  onHistory,
  initialMode = null,
  initialParticipants = null,
  initialVariant = "standard",
  initialCup = null,
}: {
  onBack: () => void;
  /** On to the draw, with everyone who is in. */
  onNext: (mode: TournamentMode, participants: Participant[], variant: GameVariant, cup?: CupConfig) => void;
  /** The trophy cabinet, one tap away. */
  onHistory?: () => void;
  /** Seeds mode/people/teams from a previous submission — lets "Tilbake" from the draw restore
   *  what was already entered instead of remounting this screen back to a blank slate. */
  initialMode?: TournamentMode | null;
  initialParticipants?: Participant[] | null;
  initialVariant?: GameVariant;
  /** Coming back from the draw of a cup against bots: its choices are restored, and only the house's own entrants are picked again. */
  initialCup?: CupConfig | null;
}) {
  // Individual to begin with, as in Enkeltkamp, so the whole screen is there from the first moment.
  const [mode, setMode] = useState<TournamentMode>(initialMode ?? "individual");
  const [variant, setVariant] = useState<GameVariant>(initialVariant);
  // A cup against bots keeps only the house's own entrants: the bots are made again when the cup is.
  const ownOf = (list: Participant[] | null) => (initialCup && list ? list.filter((p) => (p.members ? p.members.some((m) => !m.isBot) : !p.isBot)) : list);
  const [people, setPeople] = useState<Person[]>(() => (initialMode === "individual" && initialParticipants ? peopleFromParticipants(ownOf(initialParticipants) ?? []) : []));
  const [teams, setTeams] = useState<PickedTeam[]>(() => (initialMode === "team" && initialParticipants ? teamsFromParticipants(ownOf(initialParticipants) ?? []) : []));
  const [cupMode, setCupMode] = useState(!!initialCup);
  const [cup, setCup] = useState<CupChoice>(() =>
    initialCup
      ? { kind: initialCup.kind, size: initialParticipants?.length ?? cupType(initialCup.kind).defaultSize, level: initialCup.level, growth: initialCup.growth }
      : { kind: "vm", size: cupType("vm").defaultSize, level: DEFAULT_CUP_LEVEL, growth: true },
  );

  // The longer games have no bots — see botsSupported. Nothing is removed behind the user's back;
  // the button just waits until the bots are taken out or the game is shortened.
  const botsAllowed = botsSupported(variant);
  const ownCount = mode === "team" ? teams.length : people.length;
  // Against bots, the house needs only itself; the bots make up the rest, and the longer games have none.
  const cupProblem = !botsAllowed ? "Botene spiller bare 1–3 kryss" : ownCount >= cup.size ? "Velg et større antall, eller færre av dere" : null;
  const problem = cupMode
    ? mode === "team"
      ? (teamSetupProblem(teams, true, 1) ?? cupProblem)
      : (individualSetupProblem(people.map((p) => p.name), false, 1) ?? cupProblem)
    : mode === "team"
      ? teamSetupProblem(teams, botsAllowed, MIN_TEAMS)
      : individualSetupProblem(people.map((p) => p.name), !botsAllowed && people.some((p) => p.isBot), MIN_INDIVIDUAL);

  const crosses = `${RULES[baseOf(variant)].target} kryss`;

  function handleNext() {
    if (problem) return;
    if (cupMode) {
      // The house's own entrants, with the bots made to fill the cup: every random thing in it comes from one seed.
      const config = makeCup(cup.kind, cup.level, cup.growth, Math.floor(Math.random() * 2 ** 31));
      if (mode === "individual") {
        commitPeople(people);
        const own: Participant[] = people.map((p) => ({ name: p.name, isBot: false }));
        onNext("individual", buildCupParticipants("individual", own, cup.size, config), withStandRule(variant, false), config);
      } else {
        commitTeams(teams);
        const own: Participant[] = teams.map((t) => ({ name: t.name, isBot: false, members: t.members.map(toMember) }));
        onNext("team", buildCupParticipants("team", own, cup.size, config), variant, config);
      }
      return;
    }
    if (mode === "individual") {
      commitPeople(people);
      const { botLevels } = splitPeople(people);
      const participants: Participant[] = people.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: botLevels[p.name] }));
      onNext("individual", participants, withStandRule(variant, false));
    } else {
      commitTeams(teams);
      const participants: Participant[] = teams.map((t) => ({ name: t.name, isBot: false, members: t.members.map(toMember) }));
      onNext("team", participants, variant);
    }
  }

  return (
    <div className="animate-screen-enter screen has-sticky-action" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop
          title="Ny turnering"
          onBack={onBack}
          right={
            onHistory ? (
              <button type="button" onClick={onHistory} className="tactile rounded-lg text-sm px-3" style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
                Pokaler
              </button>
            ) : undefined
          }
        />

        <ModeToggle
          label="Type turnering"
          value={cupMode ? "cup" : "plain"}
          onChange={(v) => setCupMode(v === "cup")}
          options={[
            { value: "plain", label: "Vanlig", icon: <PeopleIcon className="w-4 h-4" /> },
            { value: "cup", label: "Pokal mot botter", icon: <TrophyIcon className="w-4 h-4" /> },
          ]}
        />

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

        {cupMode && <CupOptions value={cup} onChange={setCup} maxOwn={ownCount} />}

        {mode === "team" ? (
          <TeamPicker teams={teams} onChange={setTeams} botsAllowed={botsAllowed && !cupMode} />
        ) : (
          <PlayerPicker people={people} onChange={setPeople} botsAllowed={botsAllowed && !cupMode} />
        )}

        <StickyAction
          onClick={handleNext}
          ready={!problem}
          summary={setupSummary([cupMode ? `${cupType(cup.kind).name}: ${ownCount} av ${cup.size}` : mode === "team" ? `${teams.length} lag` : `${people.length} spillere`, "utslagsturnering", crosses])}
          reason={problem}
        >
          Neste: trekning
        </StickyAction>
      </div>
    </div>
  );
}
