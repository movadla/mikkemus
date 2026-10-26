"use client";

import { useState } from "react";
import { HallOfFameTab } from "./HallOfFameTab";
import { MatchLogTab } from "./MatchLogTab";
import { PlayerStatCards } from "./StatsCards";
import { RecordsTab } from "./RecordsTab";
import { ScreenTop } from "./ScreenTop";
import { SeedingTab } from "./SeedingTab";
import { Segmented } from "./ui/Segmented";

export type StatsTab = "spillere" | "seeding" | "rekorder" | "kamper" | "hall";

const OPTIONS: { value: StatsTab; label: string }[] = [
  { value: "spillere", label: "Spillere" },
  { value: "seeding", label: "Seeding" },
  { value: "rekorder", label: "Rekorder" },
  { value: "kamper", label: "Kamper" },
  { value: "hall", label: "Hall of Fame" },
];

/** Statistikk: every player's numbers, the seeding, the records, the matches, and who has won most. Changing a player or a team is done on Spillere. */
export function StatsView({ initialTab = "spillere" }: { initialTab?: StatsTab }) {
  const [tab, setTab] = useState<StatsTab>(initialTab);
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Statistikk" />
        <div className="mb-5">
          <Segmented value={tab} onChange={setTab} label="Statistikk" options={OPTIONS} />
        </div>
        {tab === "spillere" ? <PlayerStatCards /> : tab === "seeding" ? <SeedingTab /> : tab === "rekorder" ? <RecordsTab /> : tab === "kamper" ? <MatchLogTab /> : <HallOfFameTab />}
      </div>
    </div>
  );
}
