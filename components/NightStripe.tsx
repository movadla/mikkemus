"use client";

import Link from "next/link";
import { ChevronRightIcon } from "./icons";
import { countOf, matchesOf, tableOf } from "@/lib/nightScore";
import { currentEvening, useNightScore } from "@/lib/nightScoreStorage";
import { nextPlanned, planGameName, type PlannedMatch } from "@/lib/nightPlan";
import { Button } from "./ui/Button";

/** On the front page: the evening that is on, in a line: how many matches, and who leads. Always there, so the way in is never hidden: with no match yet it says so. */
export function NightStripe({ onNext }: { /** Plays the next planned match of the evening. */ onNext?: (eveningId: string, p: PlannedMatch) => void }) {
  const night = useNightScore();
  const evening = currentEvening(night);
  const matches = evening ? matchesOf(night.matches, evening.id) : [];
  const count = countOf(matches);
  const top = count > 0 ? tableOf(matches)[0] : undefined;
  const next = onNext ? nextPlanned(evening, matches) : null;
  return (
    <>
    {evening && next && (
      <div className="mb-2">
        <Button variant="primary" size="lg" block onClick={() => onNext?.(evening.id, next)}>
          Neste: {planGameName(next.game)}
          {next.who ? ` · ${next.who}` : ""}
        </Button>
      </div>
    )}
    <Link href="/kveld" className="kv-stripe tactile" aria-label={count > 0 ? `Kveldsscore: ${count} kamper i kveld` : "Kveldsscore"}>
      <span className="kv-stripe-title">Kveldsscore</span>
      <span className="kv-stripe-text">
        {count === 0 ? "Poeng og kamper i kveld" : `${count} ${count === 1 ? "kamp" : "kamper"} i kveld${top && top.points > 0 ? ` · ${top.name} leder med ${top.points}` : ""}`}
      </span>
      <ChevronRightIcon className="w-5 h-5" />
    </Link>
    </>
  );
}
