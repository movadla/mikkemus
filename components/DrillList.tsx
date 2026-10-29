"use client";

import { STAGES, type Career } from "@/lib/career";
import { DAILY_REWARD, DRILLS, LEVEL_MAX, UNLOCK_ROOM, dailyOf, drillLevel, goalLine, isDrillOpen, levelCap, type DrillId } from "@/lib/drills";
import { levelLabel } from "./careerFormat";
import { LockIcon } from "./careerIcons";
import { CheckIcon, FlameIcon } from "./icons";
import { Button } from "./ui/Button";

const GLYPH: Record<DrillId, string> = { t20: "T20", tre20: "3×", bull9: "◉" };
const TONE: Record<DrillId, string> = { t20: "var(--color-gold)", tre20: "var(--color-teal)", bull9: "var(--color-red)" };

/**
 * The drills of the training room: the one of the day on top (with its streak and its small reward), then a card for each, with how far it has
 * come as a meter from 1 to 100, the part of it the room does not yet allow hatched, and what the room has to be for the ones that are locked.
 */
export function DrillList({ career, onTrain, today }: { career: Career; onTrain: (id: DrillId) => void; /** The day, as a date (the drill of the day changes with it). */ today: string }) {
  const cap = levelCap(career.room);
  const daily = dailyOf(career, today);
  return (
    <div className="room-tile room-tile-wide drills" role="group" aria-label="Øvelser">
      <p className="section-label">
        TRENING · NIVÅ OPP TIL {cap} I DETTE ROMMET
      </p>
      <p className="drills-skill">
        Treffsikkerhet <b>{levelLabel(career.skillMed)}</b>
      </p>
      <div className={`drill-daily ${daily.done ? "drill-daily-done" : ""}`}>
        <span className="drill-flame" aria-hidden>
          {daily.done ? <CheckIcon className="w-6 h-6" /> : <FlameIcon className="w-6 h-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <small className="drill-kicker">
            DAGENS ØVELSE{daily.streak > 0 ? ` · ${daily.streak} ${daily.streak === 1 ? "dag" : "dager"} på rad` : ""}
          </small>
          <b className="block truncate">{DRILLS.find((d) => d.id === daily.id)?.name}</b>
          <small className="block">{daily.done ? "Ferdig i dag. Kom igjen i morgen." : `+$${DAILY_REWARD} når du består den`}</small>
        </span>
        {!daily.done && <Button label={`Dagens øvelse: ${DRILLS.find((d) => d.id === daily.id)?.name}`} onClick={() => onTrain(daily.id)}>Tren</Button>}
      </div>
      <ul aria-label="Alle øvelser">
        {DRILLS.map((d) => {
          const open = isDrillOpen(career, d.id);
          const level = drillLevel(career, d.id);
          return (
            <li key={d.id} className={open ? "" : "drill-locked"}>
              <span className="drill-glyph" style={{ background: open ? TONE[d.id] : "var(--color-cell)" }} aria-hidden>
                {open ? GLYPH[d.id] : <LockIcon className="w-5 h-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block">
                  {d.name}
                  {open && <span className="tabular drills-level"> · Nivå {level}</span>}
                </b>
                <small className="block">{open ? goalLine(d.id, level) : `Åpnes i ${STAGES[UNLOCK_ROOM[d.id]].name}`}</small>
                {open && (
                  <span className="drill-meter" role="img" aria-label={`Nivå ${level} av ${cap} i dette rommet`}>
                    <i style={{ width: `${(level / LEVEL_MAX) * 100}%` }} />
                    <em style={{ left: `${(cap / LEVEL_MAX) * 100}%` }} />
                  </span>
                )}
              </span>
              {open && (
                <Button label={`Tren ${d.name}`} onClick={() => onTrain(d.id)}>
                  Tren
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
