"use client";

import { StatsView } from "@/components/StatsView";

/** Hall of Fame is a tab of Statistikk now; this address still opens it. */
export default function HallOfFamePage() {
  return <StatsView initialTab="hall" />;
}
