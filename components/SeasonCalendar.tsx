"use client";

import { useState } from "react";
import type { Career } from "@/lib/career";
import { PLACE_LABEL } from "@/lib/career";
import { CALENDAR } from "@/lib/careerCalendar";
import { isOpen, lifeOf, weekInSeason } from "@/lib/careerLife";
import { skipWeek } from "@/lib/careerWorld";
import { Button } from "./ui/Button";

/** What the week holds when it is one of those between the steps: the invitation or the duel, when it has come, otherwise TBA. */
function titleOf(career: Career, week: number, slot: (typeof CALENDAR)[number]): { name: string; tba: boolean } {
  if (slot.kind === "tier") return { name: slot.name, tba: false };
  const life = lifeOf(career);
  const came =
    slot.kind === "invite"
      ? life.inbox.some((m) => m.offer.kind === "invite" && m.offer.invite.key === slot.key && (isOpen(m) || m.state === "taken")) || career.active?.invite?.key === slot.key
      : life.inbox.some((m) => m.offer.kind === "challenge" && m.offer.tv && (isOpen(m) || m.state === "taken"));
  // A week that is over holds what was played; the present one holds the invitation once it has come.
  return week === weekInSeason(life.week) && !came ? { name: "TBA", tba: true } : week > weekInSeason(life.week) ? { name: "TBA", tba: true } : { name: slot.name, tba: false };
}

/** The eight weeks of the season: what is played in each, what came of the weeks that are gone, and a way to let the week go. */
export function SeasonCalendar({ career, commit }: { career: Career; commit: (c: Career) => void }) {
  const life = lifeOf(career);
  const now = weekInSeason(life.week);
  const first = life.week - (now - 1);
  const [sure, setSure] = useState(false);
  const busy = !!career.active || !!career.challenge;
  return (
    <section aria-label="Kalender">
      <ol className="season-cal">
        {CALENDAR.map((slot) => {
          const week = slot.week;
          const past = week < now;
          const log = past ? life.weeks?.[String(first + week - 1)] : undefined;
          const t = past ? { name: log?.name ?? slot.name, tba: !log && slot.kind !== "tier" } : titleOf(career, week, slot);
          const tag = past ? (log?.place ? PLACE_LABEL[log.place] : log?.skipped || !log ? "Ikke spilt" : "Spilt") : week === now ? "Denne uken" : "";
          return (
            <li key={week} className={`season-cal-row ${week === now ? "now" : ""} ${past ? "past" : ""} ${t.tba ? "tba" : ""}`} aria-current={week === now ? "step" : undefined}>
              <span className="season-cal-week tabular">Uke {week}</span>
              <b className="season-cal-name">{t.name}</b>
              {tag && <span className="season-cal-tag">{tag}</span>}
            </li>
          );
        })}
      </ol>
      <div className="season-cal-skip">
        <Button
          block
          disabled={busy}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            commit(skipWeek(career));
          }}
        >
          {sure ? "Sikker? Trykk igjen for å hoppe over uken" : "Hopp over uken"}
        </Button>
        {busy && <p className="info-line">Fullfør det som pågår først.</p>}
      </div>
    </section>
  );
}
