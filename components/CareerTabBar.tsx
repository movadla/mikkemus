"use client";

import type { ReactNode } from "react";
import { BoltIcon, BullseyeIcon, TrophyIcon } from "./icons";
import { ArenaIcon, HomeIcon } from "./careerIcons";
import { FOCUS_RING } from "./ui/focus";

export type CareerTab = "home" | "arena" | "tournaments" | "training" | "challenges";

const ITEMS: { key: CareerTab; label: string; icon: ReactNode }[] = [
  { key: "home", label: "Hjem", icon: <HomeIcon className="w-6 h-6" /> },
  { key: "arena", label: "Arena", icon: <ArenaIcon className="w-6 h-6" /> },
  { key: "tournaments", label: "Turneringer", icon: <TrophyIcon className="w-7 h-7" /> },
  { key: "training", label: "Trening", icon: <BullseyeIcon className="w-6 h-6" /> },
  { key: "challenges", label: "Utfordring", icon: <BoltIcon className="w-6 h-6" /> },
];

/**
 * The bar along the bottom of the career: the five places, the one you are in lit, and Turneringer in the middle, raised and in colour, since
 * the tournaments are what the game is about. The thumb reaches it from anywhere, so no place is more than one tap away.
 */
export function CareerTabBar({ current, onPick, pulse = false }: { current: CareerTab; onPick: (tab: CareerTab) => void; /** The tournaments button breathes: something is open that the player has not entered. */ pulse?: boolean }) {
  return (
    <nav aria-label="Karriere" className="bottom-nav fixed left-0 right-0 bottom-0 z-40">
      <div className="bottom-nav-pill mx-auto flex max-w-md items-end">
        {ITEMS.map((i) => {
          const on = i.key === current;
          const centre = i.key === "tournaments";
          const style = centre
            ? ({ minHeight: "var(--control-lg)", marginTop: "-1.1rem", color: "var(--color-bg)", fontSize: "var(--text-micro)", fontWeight: 800, background: "var(--gradient-teal, var(--color-teal))", borderRadius: "var(--radius-l)", boxShadow: on ? "0 0 0 2px var(--color-cream), var(--elevation-3)" : "var(--elevation-3)" } as const)
            : ({ minHeight: "var(--control-lg)", color: on ? "var(--color-teal)" : "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: on ? 700 : 500, boxShadow: "none", background: on ? "var(--teal-soft)" : "transparent", borderRadius: "var(--radius-pill)" } as const);
          return (
            <button key={i.key} type="button" onClick={() => onPick(i.key)} aria-current={on ? "page" : undefined} className={`tactile flex flex-col items-center justify-center gap-1 min-w-0 ${centre ? "flex-[1.3]" : "flex-1"} ${centre && pulse && !on ? "tab-pulse" : ""} ${FOCUS_RING}`} style={style}>
              {i.icon}
              <span>{i.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
