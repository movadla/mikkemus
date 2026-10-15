"use client";

import { TEAM_NAME_MAX, cleanTeamName, resolvedTeamName, teamNameProblems, type NamedTeam } from "@/lib/teamNames";
import { assignKits } from "@/lib/teamKit";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export type Team = NamedTeam;

/** Shared "which team is each person on" rule — a team can freely mix humans and bots (both are
 *  just names from this component's point of view), so readiness only cares about coverage and
 *  about every team having its own, non-empty name (see lib/teamNames.ts). */
export function isTeamSetupReady(people: { name: string }[], teams: Team[]): boolean {
  const unassigned = people.filter((p) => !teams.some((t) => t.members.includes(p.name)));
  return (
    unassigned.length === 0 &&
    teams.every((t) => t.members.length > 0) &&
    teams.length >= 2 &&
    teamNameProblems(teams).every((problem) => problem === null)
  );
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
    // A placeholder that is not already taken by another empty team, so adding a team never
    // starts out in conflict with the one before it.
    const taken = new Set(teams.map((t) => t.name));
    let n = teams.length + 1;
    while (taken.has(`Lag ${n}`)) n++;
    onChange([...teams, { name: `Lag ${n}`, members: [] }]);
  }

  function removeTeam(index: number) {
    onChange(teams.filter((_, i) => i !== index));
  }

  /** Typing makes the name the user's own — kept exactly as typed, spaces and all, until the
   *  field is left (see settleName). */
  function renameTeam(index: number, raw: string) {
    onChange(teams.map((t, i) => (i === index ? { ...t, name: raw.slice(0, TEAM_NAME_MAX), custom: true } : t)));
  }

  /** Leaving the field empty hands the name back to the default rather than leaving a team
   *  nameless: it follows its members again. */
  function settleName(index: number) {
    onChange(
      teams.map((t, i) => {
        if (i !== index || !t.custom) return t;
        const cleaned = cleanTeamName(t.name);
        return cleaned ? { ...t, name: cleaned } : { ...t, name: `Lag ${i + 1}`, custom: false };
      })
    );
  }

  const unassigned = people.filter((p) => !teams.some((t) => t.members.includes(p.name)));
  const problems = teamNameProblems(teams);
  // Shirts, by position rather than by name: a name can be mid-edit, empty or a duplicate here.
  const kits = assignKits(teams.map((t, i) => ({ name: String(i), members: t.members })));

  return (
    <>
      <div className="space-y-3 mb-6">
        {teams.map((team, ti) => {
          const problem = problems[ti];
          const nameId = `team-name-${ti}`;
          return (
            <div key={ti} className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <div className="flex items-end gap-2 mb-2">
                {/* The team's shirt: the same for the same people every time, and the away kit
                    when it would clash with an earlier team's. Nothing to set up or save. */}
                {team.members.length > 0 && (
                  <div className="flex flex-col items-center shrink-0" style={{ width: "3.2rem" }}>
                    <TeamKit kit={kits[String(ti)].kit} size={44} title={kits[String(ti)].away ? "Bortedrakt" : "Hjemmedrakt"} />
                    <span style={{ color: "var(--color-muted)", fontSize: "0.58rem", letterSpacing: "0.06em" }}>
                      {kits[String(ti)].away ? "BORTE" : "HJEMME"}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <label htmlFor={nameId} className="section-label block mb-1">
                    LAGNAVN
                  </label>
                  <input
                    id={nameId}
                    value={team.custom ? team.name : resolvedTeamName(team)}
                    onChange={(e) => renameTeam(ti, e.target.value)}
                    onBlur={() => settleName(ti)}
                    maxLength={TEAM_NAME_MAX}
                    placeholder="Gi laget et navn"
                    aria-invalid={problem !== null}
                    aria-describedby={problem ? `${nameId}-problem` : undefined}
                    className={`w-full px-3 py-2 rounded-lg ${FOCUS_RING}`}
                    style={{
                      background: "var(--color-surface)",
                      color: "var(--color-cream)",
                      border: problem ? "1px solid var(--color-red)" : "1px solid var(--color-border)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
                {teams.length > 2 && (
                  <button type="button" onClick={() => removeTeam(ti)} className={`text-sm px-2 py-2 ${FOCUS_RING}`} style={{ color: "var(--color-red)" }}>
                    Fjern lag
                  </button>
                )}
              </div>
              {problem && (
                <p id={`${nameId}-problem`} role="alert" className="mb-2" style={{ color: "var(--color-red)", fontSize: "0.78rem" }}>
                  {problem}
                </p>
              )}
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
          );
        })}
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
