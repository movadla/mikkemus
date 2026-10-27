"use client";

import { useState } from "react";
import { useGameResults } from "@/lib/gameResultsStorage";
import { HallOfFameTab } from "./HallOfFameTab";
import { MatchLogTab } from "./MatchLogTab";
import { OtherGamesTab } from "./OtherGamesTab";
import { PlayerStatCards } from "./StatsCards";
import { RecordsTab } from "./RecordsTab";
import { ScreenTop } from "./ScreenTop";
import { SeedingTab } from "./SeedingTab";
import { Segmented } from "./ui/Segmented";

export type StatsTab = "spillere" | "seeding" | "rekorder" | "kamper" | "hall" | "andre";

const OPTIONS: { value: StatsTab; label: string }[] = [
  { value: "spillere", label: "Spillere" },
  { value: "seeding", label: "Seeding" },
  { value: "rekorder", label: "Rekorder" },
  { value: "kamper", label: "Kamper" },
  { value: "hall", label: "Hall of Fame" },
];
const OTHER_GAMES: { value: StatsTab; label: string } = { value: "andre", label: "Andre spill" };

/** Statistikk: every player's numbers, the seeding, the records, the matches, and who has won most. Changing a player or a team is done on Spillere. */
export function StatsView({ initialTab = "spillere" }: { initialTab?: StatsTab }) {
  const [tab, setTab] = useState<StatsTab>(initialTab);
  // The tab for the other games is there once one of them has been played, and not before.
  const played = useGameResults().length > 0;
  const options = played ? [...OPTIONS, OTHER_GAMES] : OPTIONS;
  const shown = tab === "andre" && !played ? "spillere" : tab;
  return (
    <div className="animate-screen-enter screen">
      <div className="screen-inner wide">
        <ScreenTop title="Statistikk" />
        <div className="mb-5">
          <Segmented value={shown} onChange={setTab} label="Statistikk" options={options} />
        </div>
        {shown === "spillere" ? <PlayerStatCards /> : shown === "seeding" ? <SeedingTab /> : shown === "rekorder" ? <RecordsTab /> : shown === "kamper" ? <MatchLogTab /> : shown === "andre" ? <OtherGamesTab /> : <HallOfFameTab />}
      </div>
    </div>
  );
}
