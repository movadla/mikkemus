"use client";

import type { PickedTeam, Person } from "@/lib/people";
import { PlayerPicker } from "./PlayerPicker";
import { ModeToggle } from "./SetupScreen";
import { TeamPicker } from "./TeamPicker";

export type GameMode = "individual" | "team";

/** Who plays, in the games that are for players or for teams: the choice between the two, and the picker that goes with it. */
export function GameWho({ mode, onMode, people, onPeople, teams, onTeams, guests = true, botsAllowed = true }: { mode: GameMode; onMode: (m: GameMode) => void; people: Person[]; onPeople: (p: Person[]) => void; teams: PickedTeam[]; onTeams: (t: PickedTeam[]) => void; guests?: boolean; botsAllowed?: boolean }) {
  return (
    <>
      <ModeToggle
        value={mode}
        onChange={onMode}
        options={[
          { value: "individual", label: "Hver for seg" },
          { value: "team", label: "Lag" },
        ]}
      />
      {mode === "team" ? <TeamPicker teams={teams} onChange={onTeams} botsAllowed={botsAllowed} /> : <PlayerPicker people={people} onChange={onPeople} guests={guests} botsAllowed={botsAllowed} />}
    </>
  );
}
