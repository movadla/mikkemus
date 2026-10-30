"use client";

import Link from "next/link";
import { ChevronRightIcon } from "./icons";
import { countOf, matchesOf, tableOf } from "@/lib/nightScore";
import { currentEvening, useNightScore } from "@/lib/nightScoreStorage";

/** On the front page: the evening that is on, in a line: how many matches, and who leads. Nothing until there is a match. */
export function NightStripe() {
  const night = useNightScore();
  const evening = currentEvening(night);
  if (!evening) return null;
  const matches = matchesOf(night.matches, evening.id);
  const count = countOf(matches);
  if (count === 0) return null;
  const top = tableOf(matches)[0];
  return (
    <Link href="/kveld" className="kv-stripe tactile" aria-label={`Kveldsscore: ${count} kamper i kveld`}>
      <span className="kv-stripe-title">Kveldsscore</span>
      <span className="kv-stripe-text">
        {count} {count === 1 ? "kamp" : "kamper"} i kveld{top && top.points > 0 ? ` · ${top.name} leder med ${top.points}` : ""}
      </span>
      <ChevronRightIcon className="w-5 h-5" />
    </Link>
  );
}
