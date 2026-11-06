"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ChevronRightIcon } from "./icons";
import { countOf, matchesOf, tableOf } from "@/lib/nightScore";
import { currentEvening, useNightScore } from "@/lib/nightScoreStorage";
import { nextPlanned, planGameName, type PlannedMatch } from "@/lib/nightPlan";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";

const HIDDEN_KEY = "mikke-mus-kveld-gjemt";

/** The evening whose stripe was hidden on this device: a new evening has another id, so the stripe is back with it. */
let hiddenNow: string | null | undefined;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const readHidden = (): string | null => {
  if (hiddenNow === undefined) {
    try {
      hiddenNow = localStorage.getItem(HIDDEN_KEY);
    } catch {
      hiddenNow = null;
    }
  }
  return hiddenNow;
};

function hideStripe(evening: string): void {
  hiddenNow = evening;
  try {
    localStorage.setItem(HIDDEN_KEY, evening);
  } catch {
    // Hidden until the page is opened again.
  }
  listeners.forEach((l) => l());
}

/** On the front page: the evening that is on, in a line: how many matches, and who leads. Always there, so the way in is never hidden: with no match yet it says so. */
export function NightStripe({ onNext }: { /** Plays the next planned match of the evening. */ onNext?: (eveningId: string, p: PlannedMatch) => void }) {
  const night = useNightScore();
  const evening = currentEvening(night);
  const matches = evening ? matchesOf(night.matches, evening.id) : [];
  const count = countOf(matches);
  const top = count > 0 ? tableOf(matches)[0] : undefined;
  const key = evening?.id ?? "none";
  const hidden = useSyncExternalStore(subscribe, readHidden, () => null);
  const [confirming, setConfirming] = useState(false);
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
    {hidden !== key && (
      <div className="relative mb-4">
      <Link href="/kveld" className="kv-stripe tactile" style={{ marginBottom: 0 }} aria-label={count > 0 ? `Kveldsscore: ${count} kamper i kveld` : "Kveldsscore"}>
        <span className="kv-stripe-title">Kveldsscore</span>
        <span className="kv-stripe-text">
          {count === 0 ? "Poeng og kamper i kveld" : `${count} ${count === 1 ? "kamp" : "kamper"} i kveld${top && top.points > 0 ? ` · ${top.name} leder med ${top.points}` : ""}`}
        </span>
        <ChevronRightIcon className="w-5 h-5" />
      </Link>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="tactile absolute rounded-full px-3 py-1"
          style={{ top: "0.45rem", right: "2.75rem", fontSize: "var(--text-small)", color: "var(--color-muted)" }}
        >
          Gjem
        </button>
      </div>
    )}
    {confirming && (
      <ConfirmDialog
        message="Gjemme Kveldsscore? Den kommer tilbake med en ny kveld."
        buttons={[
          { label: "Behold", onClick: () => setConfirming(false), background: "var(--color-green)" },
          {
            label: "Gjem",
            onClick: () => {
              setConfirming(false);
              hideStripe(key);
            },
            background: "var(--color-surface)",
          },
        ]}
      />
    )}
    </>
  );
}
