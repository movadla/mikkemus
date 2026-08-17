"use client";

import { useParams } from "next/navigation";
import { useRoster } from "@/lib/storage";
import { groupNights } from "@/lib/nights";
import { NightDetail } from "@/components/NightDetail";

export default function NightPage() {
  const params = useParams<{ dato: string }>();
  const roster = useRoster();
  const nights = groupNights(roster);
  const night = nights.find((n) => n.date === params.dato) ?? null;
  const otherDates = nights.filter((n) => n.date !== params.dato).map((n) => n.date);
  return <NightDetail night={night} otherDates={otherDates} />;
}
