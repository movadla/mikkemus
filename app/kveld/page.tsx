"use client";

import { useRoster } from "@/lib/storage";
import { groupNights } from "@/lib/nights";
import { NightDetail } from "@/components/NightDetail";

/** Defaults to the most recent night with any recorded matches — /kveld/[dato] is the
 *  shareable, specific-date version of this same view. */
export default function LatestNightPage() {
  const roster = useRoster();
  const nights = groupNights(roster);
  const [latest, ...rest] = nights;
  return <NightDetail night={latest ?? null} otherDates={rest.map((n) => n.date)} />;
}
