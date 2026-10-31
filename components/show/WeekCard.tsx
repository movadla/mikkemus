"use client";

import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import type { Career } from "@/lib/career";
import { lifeOf } from "@/lib/careerLife";
import { TROPHY } from "@/lib/scenePalette";
import { weekCardOf } from "@/lib/show";

const storeKey = (id: string) => `mikke-mus-show-week:${id}`;

/** The week of the career that was last shown a card, or 0. */
function lastShown(id: string): number {
  try {
    return Number(localStorage.getItem(storeKey(id))) || 0;
  } catch {
    return 0;
  }
}

/**
 * A card over the home screen when a new week begins: the week, what is played in it and where, and the eight ticks of the season. It comes once for
 * each week (the last week shown is kept for the career), goes away by itself after a few seconds, and a tap closes it. Only with the show.
 */
export function WeekCard({ career }: { career: Career }) {
  const { show } = useAccess();
  const week = lifeOf(career).week;
  const [open, setOpen] = useState(() => show && lastShown(career.id) < week);
  useEffect(() => {
    if (!show || !open) return;
    try {
      localStorage.setItem(storeKey(career.id), String(week));
    } catch {}
    const t = setTimeout(() => setOpen(false), 5500);
    return () => clearTimeout(t);
  }, [show, open, career.id, week]);
  if (!show || !open) return null;
  const card = weekCardOf(career);
  return (
    <button type="button" className="week-card tactile" role="status" aria-label={`Uke ${card.week} av ${card.of}: ${card.name}. Trykk for å lukke`} style={{ "--c": card.tier ? TROPHY[card.tier] : "var(--color-teal)" } as React.CSSProperties} onClick={() => setOpen(false)}>
      <small className="week-card-kick">
        UKE {card.week} AV {card.of}
      </small>
      <b className="week-card-name font-display">{card.name}</b>
      <span className="week-card-where">{card.where ?? "Ingen invitasjon ennå"}</span>
      <span className="week-card-ticks" aria-hidden>
        {card.ticks.map((t, i) => (
          <i key={i} data-t={t} />
        ))}
      </span>
    </button>
  );
}
