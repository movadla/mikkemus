"use client";

import { useState } from "react";
import type { Participant, TournamentMode } from "@/lib/tournament";
import type { TeamMember } from "@/lib/botLevels";
import { PeoplePicker, type Person } from "./PeoplePicker";
import { TeamComposer, isTeamSetupReady, type Team } from "./TeamComposer";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export function TournamentSetupScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (mode: TournamentMode, participants: Participant[]) => void;
}) {
  const [mode, setMode] = useState<TournamentMode | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([
    { name: "Lag 1", members: [] },
    { name: "Lag 2", members: [] },
  ]);

  /** Removing a person from the pool must also drop them from whichever team they were on. */
  function handlePeopleChange(next: Person[]) {
    const removedNames = people.filter((p) => !next.some((n) => n.name === p.name)).map((p) => p.name);
    if (removedNames.length > 0) {
      setTeams((prev) => prev.map((t) => ({ ...t, members: t.members.filter((m) => !removedNames.includes(m)) })));
    }
    setPeople(next);
  }

  const teamsReady = mode === "team" && isTeamSetupReady(people, teams);
  const individualReady = mode === "individual" && people.length >= 3;

  function handleNext() {
    if (mode === "individual") {
      const participants: Participant[] = people.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: p.botLevel }));
      onNext("individual", participants);
    } else if (mode === "team") {
      const participants: Participant[] = teams.map((t) => ({
        name: t.name,
        isBot: false,
        members: t.members.map((name): TeamMember => {
          const person = people.find((p) => p.name === name)!;
          return { name: person.name, isBot: person.isBot, botLevel: person.botLevel };
        }),
      }));
      onNext("team", participants);
    }
  }

  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <button type="button" onClick={onBack} className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Hjem
          </button>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.3rem" }}>
            Ny turnering
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
          1. INDIVIDUELT ELLER LAG?
        </p>
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode("individual")}
            className={`tactile flex-1 py-3 rounded-lg font-medium ${FOCUS_RING}`}
            style={{
              background: mode === "individual" ? "var(--color-teal)" : "var(--color-surface)",
              color: mode === "individual" ? "var(--color-bg)" : "var(--color-cream)",
              border: "1px solid var(--color-border)",
            }}
          >
            Individuelt
          </button>
          <button
            type="button"
            onClick={() => setMode("team")}
            className={`tactile flex-1 py-3 rounded-lg font-medium ${FOCUS_RING}`}
            style={{
              background: mode === "team" ? "var(--color-teal)" : "var(--color-surface)",
              color: mode === "team" ? "var(--color-bg)" : "var(--color-cream)",
              border: "1px solid var(--color-border)",
            }}
          >
            Lag
          </button>
        </div>

        {mode && (
          <>
            <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              2. DELTAKERE
            </p>

            <PeoplePicker people={people} onChange={handlePeopleChange} />

            {mode === "team" && people.length > 0 && (
              <>
                <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                  3. SETT SAMMEN LAG
                </p>
                <TeamComposer people={people} teams={teams} onChange={setTeams} />
              </>
            )}

            <button
              type="button"
              disabled={!(individualReady || teamsReady)}
              onClick={handleNext}
              className={`tactile w-full py-4 rounded-lg font-semibold text-lg transition-opacity ${FOCUS_RING}`}
              style={{ background: "var(--color-green)", color: "var(--color-cream)", opacity: individualReady || teamsReady ? 1 : 0.4 }}
            >
              Neste: juster grupper
            </button>
            {mode === "individual" && !individualReady && (
              <p className="text-center mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                Trenger minst 3 deltakere
              </p>
            )}
            {mode === "team" && !teamsReady && (
              <p className="text-center mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                Trenger minst 2 lag, alle med minst ett medlem, og ingen utildelte spillere
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
