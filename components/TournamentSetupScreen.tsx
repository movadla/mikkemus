"use client";

import { useState } from "react";
import { type Participant, type TournamentMode } from "@/lib/tournament";
import { DEFAULT_CUP_LEVEL, MAX_CUP_SIZE, TEAM_CUP_MAX, buildCupParticipants, cupColor, cupType, makeCup, type CupConfig } from "@/lib/botCup";
import { botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { splitPeople, toMember, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, teamSetupProblem } from "@/lib/setupProblem";
import { PeopleIcon, PersonIcon, TrophyIcon } from "./icons";
import { PlayerPicker } from "./PlayerPicker";
import { RulesPicker } from "./RulesPicker";
import { ScreenTop } from "./ScreenTop";
import { CupDetails, CupSizePicker, CupTypePicker, type CupChoice } from "./CupOptions";
import { ModeToggle, commitPeople, commitTeams } from "./SetupScreen";
import { StepStrip } from "./StepStrip";
import { TextField } from "./ui/TextField";
import { VenuePicker } from "./VenuePicker";
import { defaultVenue, type VenueId } from "@/lib/venues";
import { StickyAction } from "./StickyAction";
import { TeamPicker } from "./TeamPicker";

/** A numbered heading: the screen reads as three questions, one after the other. */
function Step({ n, children, aside }: { n: number; children: React.ReactNode; aside?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-2">
      <span aria-hidden className="tabular rounded-full shrink-0 flex items-center justify-center" style={{ width: "1.75rem", height: "1.75rem", background: "var(--teal-soft)", color: "var(--color-teal)", border: "1px solid var(--color-teal)", fontWeight: 700, fontSize: "var(--text-small)" }}>
        {n}
      </span>
      <h2 className="font-display flex-1" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)", lineHeight: 1.1 }}>{children}</h2>
      {aside && <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>{aside}</span>}
    </div>
  );
}

const MIN_INDIVIDUAL = 2;
const MIN_TEAMS = 2;
const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

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
  initialName = "",
  initialVenue = null,
}: {
  onBack: () => void;
  /** On to the draw, with everyone who is in. */
  onNext: (mode: TournamentMode, participants: Participant[], variant: GameVariant, cup?: CupConfig, name?: string, venue?: VenueId) => void;
  /** The trophy cabinet, one tap away. */
  onHistory?: () => void;
  /** Seeds mode/people/teams from a previous submission — lets "Tilbake" from the draw restore
   *  what was already entered instead of remounting this screen back to a blank slate. */
  initialMode?: TournamentMode | null;
  initialParticipants?: Participant[] | null;
  initialVariant?: GameVariant;
  /** Coming back from the draw of a cup against bots: its choices are restored, and only the house's own entrants are picked again. */
  initialCup?: CupConfig | null;
  initialName?: string;
  /** The place chosen before, when coming back from the draw. */
  initialVenue?: VenueId | null;
}) {
  // Individual to begin with, as in Enkeltkamp, so the whole screen is there from the first moment.
  const [mode, setMode] = useState<TournamentMode>(initialMode ?? "individual");
  const [variant, setVariant] = useState<GameVariant>(initialVariant);
  const [name, setName] = useState(initialName);
  const [moreOpen, setMoreOpen] = useState(false);
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
  // A cup of teams is smaller than one of people: the bots of a team cup need two names each.
  const maxSize = mode === "team" ? TEAM_CUP_MAX : MAX_CUP_SIZE;
  const cupSize = Math.min(cup.size, maxSize);
  // Against bots, the house needs only itself; the bots make up the rest, and the longer games have none.
  const cupProblem = !botsAllowed ? "Boter bare på 1–3 kryss" : ownCount >= cupSize ? "For mange" : null;
  // Ly Pilotturnering has a format of its own (lib/pilot.ts): sixteen single players, four at a time, in standard.
  const pilot = cupMode && cup.kind === "open";
  const problem = cupMode
    ? mode === "team"
      ? pilot
        ? "Ly Pilotturnering spilles av enkeltspillere"
        : (teamSetupProblem(teams, true, 1) ?? cupProblem)
      : (individualSetupProblem(people.map((p) => p.name), false, 1) ?? cupProblem)
    : mode === "team"
      ? teamSetupProblem(teams, botsAllowed, MIN_TEAMS)
      : individualSetupProblem(people.map((p) => p.name), !botsAllowed && people.some((p) => p.isBot), MIN_INDIVIDUAL);

  const trimmedName = name.trim();
  // The place is the one that fits the cup (or the size) until one is chosen; choosing is only how it looks.
  const [chosenVenue, setChosenVenue] = useState<VenueId | null>(initialVenue);
  const venue: VenueId = chosenVenue ?? defaultVenue(cupMode ? cup.kind : undefined, cupMode ? cupSize : ownCount);

  function handleNext() {
    if (problem) return;
    const given = trimmedName || undefined;
    if (cupMode) {
      // The house's own entrants, with the bots made to fill the cup: every random thing in it comes from one seed.
      const config = makeCup(cup.kind, cup.level, pilot ? false : cup.growth, Math.floor(Math.random() * 2 ** 31));
      if (mode === "individual") {
        commitPeople(people);
        const own: Participant[] = people.map((p) => ({ name: p.name, isBot: false }));
        onNext("individual", buildCupParticipants("individual", own, cupSize, config), pilot ? "standard" : withStandRule(variant, false), config, given, venue);
      } else {
        commitTeams(teams);
        const own: Participant[] = teams.map((t) => ({ name: t.name, isBot: false, members: t.members.map(toMember) }));
        onNext("team", buildCupParticipants("team", own, cupSize, config), variant, config, given, venue);
      }
      return;
    }
    if (mode === "individual") {
      commitPeople(people);
      const { botLevels } = splitPeople(people);
      const participants: Participant[] = people.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: botLevels[p.name] }));
      onNext("individual", participants, withStandRule(variant, false), undefined, given, venue);
    } else {
      commitTeams(teams);
      const participants: Participant[] = teams.map((t) => ({ name: t.name, isBot: false, members: t.members.map(toMember) }));
      onNext("team", participants, variant, undefined, given, venue);
    }
  }

  return (
    <div className="animate-screen-push screen has-sticky-action" style={{ background: cupMode ? `linear-gradient(180deg, color-mix(in srgb, ${cupColor(cup.kind)} 16%, var(--color-bg)), var(--color-bg) 22rem)` : "var(--color-bg)", transition: "background var(--weight)" }}>
      <div className="screen-inner">
        <ScreenTop
          title="Ny turnering"
          onBack={onBack}
          right={
            onHistory ? (
              <button type="button" onClick={onHistory} className="tactile rounded-lg text-sm px-3" style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
                Pokaler
              </button>
            ) : undefined
          }
        />
        <StepStrip step={0} />

        <Step n={1}>Hvem</Step>
        <ModeToggle
          label="Hvem spiller"
          value={mode}
          onChange={setMode}
          options={[
            { value: "individual", label: "Spillere", icon: <PersonIcon className="w-4 h-4" /> },
            { value: "team", label: "Lag", icon: <PeopleIcon className="w-4 h-4" /> },
          ]}
        />
        {mode === "team" ? (
          <TeamPicker teams={teams} onChange={setTeams} botsAllowed={botsAllowed && !cupMode} />
        ) : (
          <PlayerPicker people={people} onChange={setPeople} botsAllowed={botsAllowed && !cupMode} />
        )}

        <Step n={2}>Turnering</Step>
        <ModeToggle
          label="Type turnering"
          value={cupMode ? "cup" : "plain"}
          onChange={(v) => setCupMode(v === "cup")}
          options={[
            { value: "plain", label: "Vanlig", icon: <PeopleIcon className="w-4 h-4" /> },
            { value: "cup", label: "Mot boter", icon: <TrophyIcon className="w-4 h-4" /> },
          ]}
        />
        {cupMode && (
          <>
            <CupTypePicker value={{ ...cup, size: cupSize }} onChange={setCup} maxSize={maxSize} />
            {cupType(cup.kind).sizes.length > 1 ? (
              <>
                <Step n={3}>Antall</Step>
                <CupSizePicker value={{ ...cup, size: cupSize }} onChange={setCup} own={ownCount} maxSize={maxSize} />
              </>
            ) : (
              ownCount >= cupSize && <p className="mb-6" style={{ color: "var(--color-red)", fontSize: "var(--text-small)" }}>For mange</p>
            )}
          </>
        )}

        <p className="section-label mb-2">STED</p>
        <VenuePicker value={venue} onChange={setChosenVenue} />

        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`tactile w-full rounded-lg px-4 flex items-center justify-between gap-3 text-left mb-4 ${FOCUS_RING}`}
          style={{ minHeight: "var(--control)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <span style={{ color: "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-body)" }}>Flere valg</span>
          <span aria-hidden style={{ color: "var(--color-muted)" }}>{moreOpen ? "⌃" : "›"}</span>
        </button>
        {moreOpen && (
          <div className="mb-6">
            <div className="mb-4">
              <TextField hideLabel value={name} onChange={setName} maxLength={40} placeholder="Navn (valgfritt)" label="Navn på turneringen" />
            </div>
            {!pilot && <RulesPicker variant={variant} onChange={setVariant} teamPlay={mode === "team"} labelAlign="left" />}
            {cupMode && !pilot && <CupDetails value={{ ...cup, size: cupSize }} onChange={setCup} />}
          </div>
        )}

        <StickyAction
          onClick={handleNext}
          ready={!problem}
          reason={problem}
        >
          Neste
        </StickyAction>
      </div>
    </div>
  );
}
