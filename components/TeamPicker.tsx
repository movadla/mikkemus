"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { teamKitsOf, useTeamRecords } from "@/lib/storage";
import { getTeamCardsSnapshot, subscribeTeamCards, withTeamRecords, type TeamCard } from "@/lib/teamCards";
import { firstKit, type Kit } from "@/lib/teamKit";
import { TEAM_NAME_MAX, defaultTeamName, pairKey, savedTeamName, teamNameProblems } from "@/lib/teamNames";
import { makeTeam, sharesMember, teamPeople, toNamedTeam, type PickedTeam, type Person } from "@/lib/people";
import { PlayerPicker } from "./PlayerPicker";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const NO_CARDS: TeamCard[] = [];

type Tile = { name: string; members: string[]; kit: Kit; picked: PickedTeam | null };

/**
 * Which teams play: every team that has played before, as tiles in two columns — the shirt, the
 * name, the people — where a tap puts the team in the match and shows its place in the order. A
 * team whose people are already on a picked team cannot be picked. «Nytt lag» opens the one place
 * a team is put together: pick the people, give it a name or let it be called after them.
 *
 * The teams with a record of their own and the ones this device remembers, together — see
 * withTeamRecords. Only shown once there is something to show; the new-team panel is always there.
 */
export function TeamPicker({ teams, onChange, botsAllowed }: { teams: PickedTeam[]; onChange: (teams: PickedTeam[]) => void; botsAllowed: boolean }) {
  const local = useSyncExternalStore(subscribeTeamCards, getTeamCardsSnapshot, () => NO_CARDS);
  const records = useTeamRecords();
  const known = useMemo(() => withTeamRecords(local, records), [local, records]);

  const [composing, setComposing] = useState(false);
  const [members, setMembers] = useState<Person[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");

  const keyOf = (names: string[]) => pairKey(names);
  const pickedIndex = (names: string[]) => teams.findIndex((t) => keyOf(t.members.map((m) => m.name)) === keyOf(names));

  // A saved team's shirt is its own; a team only this device remembers wears the default one.
  const homeKit = (members: string[]): Kit => {
    const record = records.find((r) => keyOf(r.members ?? []) === keyOf(members));
    return record ? teamKitsOf(record).home : firstKit(members);
  };
  // The known teams, then the teams made just now that are not among them.
  const tiles: Tile[] = [
    ...known.map((c) => ({ name: c.name, members: c.members, kit: homeKit(c.members), picked: teams[pickedIndex(c.members)] ?? null })),
    ...teams
      .filter((t) => !known.some((c) => keyOf(c.members) === keyOf(t.members.map((m) => m.name))))
      .map((t) => ({ name: t.name, members: t.members.map((m) => m.name), kit: firstKit(t.members.map((m) => m.name)), picked: t })),
  ];

  function toggle(tile: Tile) {
    const i = pickedIndex(tile.members);
    if (i !== -1) {
      onChange(teams.filter((_, j) => j !== i));
      return;
    }
    onChange([...teams, { name: tile.name, members: tile.members.map((name) => ({ name, isBot: false })), custom: true }]);
  }

  function openComposer() {
    setComposing(true);
    setMembers([]);
    setNameInput("");
    setError("");
  }

  function addTeam() {
    if (members.length < 2) {
      setError("Velg minst to spillere");
      return;
    }
    const team = makeTeam(members, nameInput);
    // A name the user once gave exactly these people comes back by itself.
    const remembered = team.custom ? null : savedTeamName(members.map((m) => m.name));
    const next = remembered ? { ...team, name: remembered, custom: true } : team;
    const problem = teamNameProblems([...teams, next].map(toNamedTeam)).at(-1);
    if (problem) {
      setError(problem);
      return;
    }
    onChange([...teams, next]);
    setComposing(false);
  }

  const taken = teamPeople(teams).map((p) => p.name);

  return (
    <div className="mb-4">
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4" role="group" aria-label="Lag">
          {tiles.map((tile) => {
            const order = pickedIndex(tile.members);
            const selected = order !== -1;
            const blocked = !selected && teams.some((t) => sharesMember(t.members.map((m) => m.name), tile.members));
            return (
              <button
                key={keyOf(tile.members)}
                type="button"
                aria-pressed={selected}
                disabled={blocked}
                onClick={() => toggle(tile)}
                className={`tactile flex items-center gap-2 pl-2 pr-2 rounded-lg text-left ${FOCUS_RING}`}
                style={{
                  minHeight: "3.25rem",
                  background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)",
                  border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
                  opacity: blocked ? 0.4 : 1,
                }}
              >
                <TeamKit kit={tile.kit} size={28} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ color: selected ? "var(--color-cream)" : "var(--color-muted)", fontSize: "0.9rem", fontWeight: selected ? 600 : 400 }}>
                    {tile.name}
                  </span>
                  <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                    {tile.members.join(", ")}
                  </span>
                </span>
                {selected && (
                  <span
                    className="tabular rounded-full shrink-0 flex items-center justify-center"
                    style={{ width: "1.375rem", height: "1.375rem", background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "0.75rem", fontWeight: 700 }}
                    aria-label={`nummer ${order + 1}`}
                  >
                    {order + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!composing && (
        <button
          type="button"
          onClick={openComposer}
          className={`tactile w-full rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${FOCUS_RING}`}
          style={{ minHeight: "2.75rem", background: "var(--color-surface)", border: "1.5px dashed var(--color-teal)", color: "var(--color-teal)" }}
        >
          <span aria-hidden style={{ fontSize: "1.05rem", lineHeight: 1, fontWeight: 700 }}>
            +
          </span>
          Nytt lag
        </button>
      )}

      {composing && (
        <div className="shadow-panel rounded-xl p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
          <p className="section-label mb-4">NYTT LAG</p>
          <PlayerPicker people={members} onChange={setMembers} botsAllowed={botsAllowed} hidden={taken} />
          <label htmlFor="team-name" className="section-label block mb-2">
            LAGNAVN (VALGFRITT)
          </label>
          <input
            id="team-name"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && addTeam()}
            maxLength={TEAM_NAME_MAX}
            placeholder={defaultTeamName(members.map((m) => m.name)) || "Lagnavn"}
            aria-label="Lagnavn"
            className={`w-full px-4 rounded-lg mb-4 ${FOCUS_RING}`}
            style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          />
          {error && (
            <p role="alert" className="mb-4" style={{ color: "var(--color-red)", fontSize: "0.75rem" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addTeam}
              className={`glossy flex-1 rounded-lg font-medium ${FOCUS_RING}`}
              style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "2.75rem" } as React.CSSProperties}
            >
              Legg til laget
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className={`tactile px-4 rounded-lg ${FOCUS_RING}`}
              style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
