"use client";

import type { Career } from "@/lib/career";
import { isOpen, lifeOf, seasonOf, weekInSeason, WEEKS_PER_SEASON } from "@/lib/careerLife";
import { peopleOf } from "@/lib/careerWorld";
import { CharacterFace } from "./CharacterFigure";
import { Avatar } from "./ui/Avatar";

/**
 * The season as a thing that is going on: the weeks as ticks, the finale at the end of it for the eight best, the table as it stands (the best five
 * and the player's own place), and what waits for an answer before it runs out.
 */
export function SeasonScreen({ career }: { career: Career }) {
  const life = lifeOf(career);
  const week = weekInSeason(life.week);
  const table = [...peopleOf(career).map((o) => ({ name: o.name, pts: life.world.pts[o.name] ?? 0, me: false })), { name: career.player, pts: life.seasonPts, me: true }].sort((a, b) => b.pts - a.pts || (a.me ? -1 : 1));
  const at = table.findIndex((r) => r.me);
  const shown = table.slice(0, 5);
  const waiting = life.inbox.filter((m) => isOpen(m) && m.until !== undefined);
  const left = WEEKS_PER_SEASON - week;
  return (
    <div className="space-y-4">
      <div>
        <p className="section-label mb-2">
          SESONG {seasonOf(life.week)} · UKE {week} AV {WEEKS_PER_SEASON}
        </p>
        <div className="season-ticks season-ticks-big" role="img" aria-label={`Uke ${week} av ${WEEKS_PER_SEASON}`}>
          {Array.from({ length: WEEKS_PER_SEASON }, (_, i) => (
            <i key={i} className={i < week - 1 ? "on" : i === week - 1 ? "now" : ""} />
          ))}
        </div>
      </div>
      <div className="season-finale">
        <p className="section-label" style={{ color: "var(--color-gold-strong)" }}>
          FINALEN
        </p>
        <p className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1.1 }}>
          {left === 0 ? "Denne uken" : `Om ${left} ${left === 1 ? "uke" : "uker"}`}
        </p>
        <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>De åtte beste i tabellen spiller om pokalen i siste uke.</p>
      </div>
      <div>
        <p className="section-label mb-2">TABELLEN</p>
        <ol className="season-table" aria-label="Sesongtabellen nå">
          {shown.map((r, i) => (
            <li key={r.name} className={r.me ? "me" : ""}>
              <span>{i + 1}</span>
              <b className="flex items-center gap-2 min-w-0">
                {r.me ? <CharacterFace id={career.profile.character} px={22} /> : <Avatar name={r.name} bot px={22} />}
                <span className="truncate">{r.me ? `${r.name} (deg)` : r.name}</span>
              </b>
              <span className="tabular">{r.pts}</span>
            </li>
          ))}
          {at >= shown.length && (
            <li className="me">
              <span>{at + 1}</span>
              <b className="flex items-center gap-2 min-w-0">
                <CharacterFace id={career.profile.character} px={22} />
                <span className="truncate">{career.player} (deg)</span>
              </b>
              <span className="tabular">{life.seasonPts}</span>
            </li>
          )}
        </ol>
      </div>
      {waiting.length > 0 && (
        <div>
          <p className="section-label mb-2">UTLØPER SNART</p>
          <ul className="season-next">
            {waiting.map((m) => (
              <li key={m.id}>
                <b className="truncate">{m.title}</b>
                <small>{m.until! - life.week + 1 <= 1 ? "siste uke" : `${m.until! - life.week + 1} uker igjen`}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
