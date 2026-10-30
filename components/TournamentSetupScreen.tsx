"use client";

import { useState } from "react";
import { type Participant, type TournamentMode } from "@/lib/tournament";
import { DEFAULT_CUP_LEVEL, MAX_CUP_SIZE, TEAM_CUP_MAX, buildCupParticipants, cupColor, cupType, makeCup, type CupConfig } from "@/lib/botCup";
import { botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { splitPeople, toMember, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, teamSetupProblem } from "@/lib/setupProblem";
import { PlayerPicker } from "./PlayerPicker";
import { RulesPicker } from "./RulesPicker";
import { ScreenTop } from "./ScreenTop";
import { CupDetails, CupSizePicker, CupTypePicker, type CupChoice } from "./CupOptions";
import { useRoster } from "@/lib/storage";
import { ModeToggle, commitPeople, commitTeams } from "./SetupScreen";
import { StepStrip } from "./StepStrip";
import { TextField } from "./ui/TextField";
import { VenuePicker } from "./VenuePicker";
import { defaultVenue, venueOf, type VenueId } from "@/lib/venues";
import { StickyAction } from "./StickyAction";
import { TeamPicker } from "./TeamPicker";

/** A small label over a part of the screen: it is one screen, and the parts can be done in any order, so they are not numbered. */
function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="section-label mb-2 mt-1">{children}</h2>;
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
  // The players the house has: the teams of bots in a team tournament are made of them.
  const roster = useRoster();
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
  // A cup against bots is played where the cup is played (Ally Pally for the world championship): nothing to choose. Otherwise the chosen place, or the one that fits.
  const venue: VenueId = cupMode ? defaultVenue(cup.kind, cupSize) : (chosenVenue ?? defaultVenue(undefined, ownCount));

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
        onNext("team", buildCupParticipants("team", own, cupSize, config, roster.filter((r) => r.kind !== "team").map((r) => r.name)), variant, config, given, venue);
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

        {/* Who plays and what kind of tournament: two small choices on one line. */}
        <div className="grid items-center gap-2 mb-4" style={{ gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)" }}>
          <ModeToggle
            compact
            label="Hvem spiller"
            value={mode}
            onChange={setMode}
            options={[
              { value: "individual", label: "Spillere" },
              { value: "team", label: "Lag" },
            ]}
          />
          {/* Two different choices: a line between them. */}
          <span aria-hidden style={{ width: 2, height: "1.9rem", borderRadius: 2, background: "var(--color-muted)", opacity: 0.55 }} />
          <ModeToggle
            compact
            label="Type turnering"
            value={cupMode ? "cup" : "plain"}
            onChange={(v) => {
              setCupMode(v === "cup");
            }}
            options={[
              { value: "plain", label: "Vanlig" },
              { value: "cup", label: "Mot boter" },
            ]}
          />
        </div>
        <Label>{mode === "team" ? "LAG" : "SPILLERE"}</Label>
        {mode === "team" ? (
          <TeamPicker teams={teams} onChange={setTeams} botsAllowed={botsAllowed && !cupMode} />
        ) : (
          <PlayerPicker people={people} onChange={setPeople} botsAllowed={botsAllowed && !cupMode} />
        )}

        {/* The cup (for a tournament against bots) and the place are always on the screen, with what is chosen marked in each. */}
        <div className="mt-4 mb-3">
          {cupMode && (
            <>
              <CupTypePicker value={{ ...cup, size: cupSize }} onChange={setCup} maxSize={maxSize} />
              {mode === "team" || cupType(cup.kind).sizes.length > 1 ? (
                <>
                  <Label>ANTALL</Label>
                  <CupSizePicker value={{ ...cup, size: cupSize }} onChange={setCup} own={ownCount} maxSize={maxSize} any={mode === "team"} />
                </>
              ) : (
                ownCount >= cupSize && <p className="mb-6" style={{ color: "var(--color-red)", fontSize: "var(--text-small)" }}>For mange</p>
              )}
            </>
          )}
          {!cupMode && (
            <>
              <Label>STED · {venueOf(venue).name.toUpperCase()}</Label>
              <VenuePicker value={venue} onChange={setChosenVenue} />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`tactile flat w-full px-1 flex items-center justify-between gap-3 text-left mb-4 ${FOCUS_RING}`}
          style={{ minHeight: "var(--control)", background: "transparent", borderBottom: "1px solid var(--color-border)" }}
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

        {/* The button is always at the bottom and says what is missing, or how many are in. */}
        <StickyAction onClick={handleNext} ready={!problem} reason={null}>
          {problem ?? `Neste · ${ownCount} ${mode === "team" ? "lag" : ownCount === 1 ? "spiller" : "spillere"}`}
        </StickyAction>
      </div>
    </div>
  );
}
