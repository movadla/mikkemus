"use client";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export type Team = { name: string; members: string[] };

/** Shared "which team is each person on" rule — a team can freely mix humans and bots (both are
 *  just names from this component's point of view), so readiness only cares about coverage. */
export function isTeamSetupReady(people: { name: string }[], teams: Team[]): boolean {
  const unassigned = people.filter((p) => !teams.some((t) => t.members.includes(p.name)));
  return unassigned.length === 0 && teams.every((t) => t.members.length > 0) && teams.length >= 2;
}

/** Shared "sort a pool of people into named teams" editor — used both by tournament setup and
 *  singel-game's Lag mode. Doesn't know or care whether a given name is a bot; that's resolved
 *  by the caller (against the same `people` list) once teams are handed off. */
export function TeamComposer({
  people,
  teams,
  onChange,
}: {
  people: { name: string }[];
  teams: Team[];
  onChange: (teams: Team[]) => void;
}) {
  function assignToTeam(name: string, teamIndex: number) {
    onChange(teams.map((t, i) => ({ ...t, members: i === teamIndex ? [...t.members.filter((m) => m !== name), name] : t.members.filter((m) => m !== name) })));
  }

  function unassignFromTeam(name: string) {
    onChange(teams.map((t) => ({ ...t, members: t.members.filter((m) => m !== name) })));
  }

  function addTeam() {
    onChange([...teams, { name: `Lag ${teams.length + 1}`, members: [] }]);
  }

  function removeTeam(index: number) {
    onChange(teams.filter((_, i) => i !== index));
  }

  function renameTeam(index: number, name: string) {
    onChange(teams.map((t, i) => (i === index ? { ...t, name } : t)));
  }

  const unassigned = people.filter((p) => !teams.some((t) => t.members.includes(p.name)));

  return (
    <>
      <div className="space-y-3 mb-6">
        {teams.map((team, ti) => (
          <div key={ti} className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <input
                value={team.name}
                onChange={(e) => renameTeam(ti, e.target.value)}
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
  );
}
