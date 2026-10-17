"use client";

import { useState } from "react";
import { PlayerStatCards } from "@/components/StatsCards";
import { SeedingTab } from "@/components/SeedingTab";
import { ScreenTop } from "@/components/ScreenTop";
import { TrophyIcon } from "@/components/icons";
import Link from "next/link";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Tab = "spillere" | "seeding";

/** Statistikk: every player's numbers in one tab, and in the other who is best, who is in form and what a
 *  tournament would give. Changing a player or a team is done on Spillere. */
export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("spillere");
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop
          title="Statistikk"
          backHref="/"
          right={
            <Link
              href="/hall-of-fame"
              aria-label="Hall of Fame"
              className={`tactile rounded-lg flex items-center justify-center ${FOCUS_RING}`}
              style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-surface)", color: "var(--color-gold)", border: "1px solid var(--color-border)" }}
            >
              <TrophyIcon className="w-4 h-4" />
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-2 mb-5" role="tablist">
          {(["spillere", "seeding"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`tactile rounded-lg ${FOCUS_RING}`}
              style={{
                minHeight: "2.75rem",
                background: tab === t ? "var(--color-teal)" : "var(--color-surface)",
                color: tab === t ? "var(--color-bg)" : "var(--color-cream)",
                border: "1px solid var(--color-border)",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              {t === "spillere" ? "Spillerstatistikk" : "Seeding"}
            </button>
          ))}
        </div>

        {tab === "spillere" ? <PlayerStatCards /> : <SeedingTab />}
      </div>
    </div>
  );
}
