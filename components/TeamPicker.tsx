"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { teamKitsOf, useTeamRecords } from "@/lib/storage";
import { TEAMS_SHOWN, getTeamCardsSnapshot, rankByUse, subscribeTeamCards, withTeamRecords, type TeamCard } from "@/lib/teamCards";
import { firstKit, type Kit } from "@/lib/teamKit";
import { TEAM_NAME_MAX, defaultTeamName, pairKey, savedTeamName, teamNameProblems } from "@/lib/teamNames";
import { makeTeam, sharesMember, teamPeople, toNamedTeam, type PickedTeam, type Person } from "@/lib/people";
import { ACTION, PlayerPicker } from "./PlayerPicker";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const NO_CARDS: TeamCard[] = [];

type Tile = { name: string; members: string[]; bots?: TeamCard["bots"]; kit: Kit; picked: PickedTeam | null };

/**
 * Which teams play: the four teams used most (and «Mer» for the rest), as tiles in two columns — the shirt, the
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
  const known = useMemo(() => rankByUse(withTeamRecords(local, records), records), [local, records]);
  // Only the four used most to begin with; «Mer» opens the rest. A team that is picked stays in view whichever it is.
  const [showAll, setShowAll] = useState(false);

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
    ...known.map((c) => ({ name: c.name, members: c.members, bots: c.bots, kit: homeKit(c.members), picked: teams[pickedIndex(c.members)] ?? null })),
    ...teams
      .filter((t) => !known.some((c) => keyOf(c.members) === keyOf(t.members.map((m) => m.name))))
      .map((t) => ({ name: t.name, members: t.members.map((m) => m.name), kit: firstKit(t.members.map((m) => m.name)), picked: t })),
  ];

  const shown = showAll ? tiles : tiles.filter((t, i) => i < TEAMS_SHOWN || t.picked);
  const hidden = tiles.length - shown.length;

  function toggle(tile: Tile) {
    const i = pickedIndex(tile.members);
    if (i !== -1) {
      onChange(teams.filter((_, j) => j !== i));
      return;
    }
    onChange([...teams, { name: tile.name, members: tile.members.map((name) => (tile.bots?.[name] ? { name, isBot: true, botLevel: tile.bots[name] } : { name, isBot: false })), custom: true }]);
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
      {/* The teams that are in: a row of their own, as with the players. A tap on one takes it out. */}
      {teams.length > 0 && (
        <div className="mb-3" role="group" aria-label="Med">
          <p className="section-label mb-1.5">MED ({teams.length})</p>
          <ul className="flex flex-wrap gap-x-2 gap-y-2.5">
            {teams.map((t, i) => {
              const names = t.members.map((m) => m.name);
              return (
                <li key={keyOf(names)}>
                  <button
                    type="button"
                    aria-pressed
                    onClick={() => {
                      const at = pickedIndex(names);
                      if (at !== -1) onChange(teams.filter((_, j) => j !== at));
                    }}
                    aria-label={`Ta ut ${t.name}, nummer ${i + 1}`}
                    className={`tactile flat relative flex flex-col items-center gap-0.5 ${FOCUS_RING}`}
                    style={{ width: "4.6rem" }}
                  >
                    <span className="relative">
                      <TeamKit kit={homeKit(names)} size={40} />
                      <span aria-hidden className="tabular rounded-full flex items-center justify-center absolute" style={{ top: -4, right: -8, width: "1.1rem", height: "1.1rem", background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "0.75rem", fontWeight: 700 }}>
                        {i + 1}
                      </span>
                    </span>
                    <span className="w-full truncate text-center" style={{ color: "var(--color-cream)", fontSize: "var(--text-micro)", fontWeight: 600 }}>
                      {t.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* The teams that can be picked: flat tiles with the shirt and the name, two to a line, and one dashed tile for the rest. */}
      {(shown.some((t) => !t.picked) || hidden > 0 || showAll) && (
        <ul className="grid grid-cols-2 gap-2 mb-4" role="group" aria-label="Lag">
          {shown
            .filter((tile) => !tile.picked)
            .map((tile) => {
              // A team with a bot in it cannot be picked where bots are not allowed (a tournament, say), nor one whose people are on a team already.
              const blocked = teams.some((t) => sharesMember(t.members.map((m) => m.name), tile.members)) || (!!tile.bots && !botsAllowed);
              return (
                <li key={keyOf(tile.members)} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={false}
                    disabled={blocked}
                    onClick={() => toggle(tile)}
                    className={`tactile flat flex w-full items-center gap-2 rounded-lg pl-2 pr-2 text-left ${FOCUS_RING}`}
                    style={{ minHeight: "2.9rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", opacity: blocked ? 0.4 : 1 }}
                  >
                    <TeamKit kit={tile.kit} size={26} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ color: "var(--color-cream)", fontSize: "var(--text-small)", fontWeight: 600, lineHeight: 1.2 }}>
                        {tile.name}
                      </span>
                      <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", lineHeight: 1.2 }}>
                        {tile.members.join(", ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          {tiles.length > TEAMS_SHOWN && (hidden > 0 || showAll) && (
            <li className="min-w-0 col-span-full">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                aria-label={showAll ? "Færre lag" : `Flere lag (${hidden})`}
                className={`tactile flat flex w-full items-center justify-center rounded-lg px-2 ${FOCUS_RING}`}
                style={{ minHeight: "2.6rem", background: "transparent", border: "1px dashed var(--color-teal)", color: "var(--color-teal)", fontSize: "var(--text-small)", fontWeight: 700 }}
              >
                {showAll ? "Færre" : `+ ${hidden} flere`}
              </button>
            </li>
          )}
        </ul>
      )}

      {!composing && (
        <button type="button" onClick={openComposer} className={`tactile flat w-full rounded-lg flex items-center justify-center gap-1.5 ${FOCUS_RING}`} style={ACTION}>
          <span aria-hidden style={{ fontSize: "1.1em", lineHeight: 1 }}>
            +
          </span>
          Nytt lag
        </button>
      )}

      {composing && (
        <div className="card" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
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
            style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          />
          {error && (
            <p role="alert" className="mb-4" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addTeam}
              className={`glossy flex-1 rounded-lg font-medium ${FOCUS_RING}`}
              style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control)" } as React.CSSProperties}
            >
              Legg til laget
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className={`tactile px-4 rounded-lg ${FOCUS_RING}`}
              style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
