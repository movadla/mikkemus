"use client";

import { useState } from "react";
import { ensurePlayer, useRosterNames } from "@/lib/storage";
import { BOT_LEVEL_ORDER, BOT_LEVELS, type BotLevel } from "@/lib/botLevels";
import type { Participant, TournamentMode } from "@/lib/tournament";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Person = { name: string; isBot: boolean; botLevel?: BotLevel };

export function TournamentSetupScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (mode: TournamentMode, participants: Participant[]) => void;
}) {
  const [mode, setMode] = useState<TournamentMode | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [error, setError] = useState("");
  const rosterNames = useRosterNames();

  // Team mode only: which team (index into `teams`) each person belongs to, by name.
  const [teams, setTeams] = useState<{ name: string; members: string[] }[]>([
    { name: "Lag 1", members: [] },
    { name: "Lag 2", members: [] },
  ]);

  const availableRoster = rosterNames.filter((n) => !people.some((p) => p.name.toLowerCase() === n.toLowerCase()));

  function addPerson(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" er allerede lagt til`);
      return;
    }
    ensurePlayer(trimmed);
    setPeople((prev) => [...prev, { name: trimmed, isBot: false }]);
    setNameInput("");
    setError("");
    setAddingPlayer(false);
  }

  function addBot(level: BotLevel) {
    const base = `🤖 ${BOT_LEVELS[level].name} (${level})`;
    let name = base;
    let suffix = 2;
    while (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      name = `${base} (${suffix})`;
      suffix++;
    }
    setPeople((prev) => [...prev, { name, isBot: true, botLevel: level }]);
    setShowBotPicker(false);
  }

  function removePerson(name: string) {
    setPeople((prev) => prev.filter((p) => p.name !== name));
    setTeams((prev) => prev.map((t) => ({ ...t, members: t.members.filter((m) => m !== name) })));
  }

  function assignToTeam(name: string, teamIndex: number) {
    setTeams((prev) => prev.map((t, i) => ({ ...t, members: i === teamIndex ? [...t.members.filter((m) => m !== name), name] : t.members.filter((m) => m !== name) })));
  }

  function unassignFromTeam(name: string) {
    setTeams((prev) => prev.map((t) => ({ ...t, members: t.members.filter((m) => m !== name) })));
  }

  function addTeam() {
    setTeams((prev) => [...prev, { name: `Lag ${prev.length + 1}`, members: [] }]);
  }

  function removeTeam(index: number) {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  }

  const unassigned = mode === "team" ? people.filter((p) => !teams.some((t) => t.members.includes(p.name))) : [];
  const teamsReady = mode === "team" && unassigned.length === 0 && teams.every((t) => t.members.length > 0) && teams.length >= 2;
  const individualReady = mode === "individual" && people.length >= 3;

  function handleNext() {
    if (mode === "individual") {
      const participants: Participant[] = people.map((p) => ({ name: p.name, isBot: p.isBot, botLevel: p.botLevel }));
      onNext("individual", participants);
    } else if (mode === "team") {
      const participants: Participant[] = teams.map((t) => ({ name: t.name, isBot: false, members: t.members }));
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

            {availableRoster.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {availableRoster.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => addPerson(n)}
                    className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`}
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4">
              {addingPlayer ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addPerson(nameInput)}
                    placeholder="Spillernavn"
                    className={`flex-1 px-4 py-2.5 rounded-lg ${FOCUS_RING}`}
                    style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                  />
                  <button type="button" onClick={() => addPerson(nameInput)} className={`tactile px-4 py-2.5 rounded-lg font-medium ${FOCUS_RING}`} style={{ background: "var(--color-teal)", color: "var(--color-bg)" }}>
                    Legg til
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAddingPlayer(true)} className={`tactile px-4 py-1.5 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-teal)", border: "1px solid var(--color-border)" }}>
                    Legg til spiller
                  </button>
                  {mode === "individual" && (
                    <button type="button" onClick={() => setShowBotPicker((v) => !v)} className={`tactile px-4 py-1.5 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-gold)", border: "1px solid var(--color-border)" }}>
                      🤖 Legg til bot
                    </button>
                  )}
                </div>
              )}
              {showBotPicker && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {BOT_LEVEL_ORDER.map((level) => (
                    <button key={level} type="button" onClick={() => addBot(level)} className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`} style={{ background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
                      {BOT_LEVELS[level].name} ({level})
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <p className="text-sm mt-2" style={{ color: "var(--color-red)" }}>
                  {error}
                </p>
              )}
            </div>

            <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <div className="space-y-2 min-h-[48px]">
                {people.length === 0 && (
                  <p className="text-center py-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                    Ingen deltakere lagt til enda
                  </p>
                )}
                {people.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--color-surface)" }}>
                    <span style={{ color: "var(--color-cream)" }}>
                      <span style={{ color: "var(--color-teal)", marginRight: "0.5rem" }}>{i + 1}.</span>
                      {p.name}
                    </span>
                    <button type="button" onClick={() => removePerson(p.name)} className={`text-sm px-2 ${FOCUS_RING}`} style={{ color: "var(--color-red)" }}>
                      Fjern
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {mode === "team" && people.length > 0 && (
              <>
                <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                  3. SETT SAMMEN LAG
                </p>
                <div className="space-y-3 mb-6">
                  {teams.map((team, ti) => (
                    <div key={ti} className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          value={team.name}
                          onChange={(e) => setTeams((prev) => prev.map((t, i) => (i === ti ? { ...t, name: e.target.value } : t)))}
                          className={`flex-1 px-3 py-1.5 rounded-lg text-sm ${FOCUS_RING}`}
                          style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                        />
                        {teams.length > 2 && (
                          <button type="button" onClick={() => removeTeam(ti)} className={`text-sm px-2 ${FOCUS_RING}`} style={{ color: "var(--color-red)" }}>
                            Fjern lag
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {people.map((p) => {
                          const isMember = team.members.includes(p.name);
                          return (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => (isMember ? unassignFromTeam(p.name) : assignToTeam(p.name, ti))}
                              className={`tactile px-2.5 py-1 rounded-full text-xs ${FOCUS_RING}`}
                              style={{
                                background: isMember ? "var(--color-teal)" : "var(--color-cell)",
                                color: isMember ? "var(--color-bg)" : "var(--color-muted)",
                              }}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addTeam} className={`tactile w-full py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-teal)", border: "1px solid var(--color-border)" }}>
                    + Nytt lag
                  </button>
                </div>
                {unassigned.length > 0 && (
                  <p className="text-center mb-4" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                    Ikke tildelt lag: {unassigned.map((p) => p.name).join(", ")}
                  </p>
                )}
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
