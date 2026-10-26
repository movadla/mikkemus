"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PlayerList } from "@/components/PlayerList";

/**
 * Spillere in two halves. On a phone it is one or the other: the list at /spillere, a player at /spillere/navn. From 900 pixels the
 * list stays on the left and the player opens on the right, with no page change in between.
 */
export default function PlayersLayout({ children }: { children: ReactNode }) {
  const detail = usePathname().replace(/\/$/, "") !== "/spillere";
  return (
    <div className="split" data-detail={detail}>
      <aside className="split-list" aria-label="Spillere">
        <PlayerList />
      </aside>
      <div className="split-detail">{children}</div>
    </div>
  );
}
