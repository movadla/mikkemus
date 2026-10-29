"use client";

import type { Career } from "@/lib/career";
import { CLIMB_MAX, CLIMB_REWARD, DAILY_REWARD, DRILLS, climbLevel, climbOpen, climbTarget, dailyOf, levelCap, type DrillId } from "@/lib/drills";
import { CheckIcon, FlameIcon } from "./icons";
import { Button } from "./ui/Button";

/** What a press of Tren starts: a drill of the day, or the ladder. */
export type TrainTarget = DrillId | "stige";

/**
 * What the training room holds, and nothing else: the drill of the day (it pays the most, and comes once a day), the ladder (a hundred levels,
 * each passed by making enough with three darts, each paying once) and the button for a better room.
 */
export function TrainingPanel({ career, onTrain, onUpgrade, today }: { career: Career; onTrain: (t: TrainTarget) => void; onUpgrade: () => void; /** The day, as a date (the drill of the day changes with it). */ today: string }) {
  const daily = dailyOf(career, today);
  const dailyName = DRILLS.find((d) => d.id === daily.id)?.name;
  const level = climbLevel(career);
  const finished = level > CLIMB_MAX;
  const open = climbOpen(career);
  return (
    <div className="train" role="group" aria-label="Trening">
      <div className={`drill-daily ${daily.done ? "drill-daily-done" : ""}`}>
        <span className="drill-flame" aria-hidden>
          {daily.done ? <CheckIcon className="w-6 h-6" /> : <FlameIcon className="w-6 h-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <small className="drill-kicker">DAGENS ØVELSE{daily.streak > 0 ? ` · ${daily.streak} ${daily.streak === 1 ? "dag" : "dager"} på rad` : ""}</small>
          <b className="block">{dailyName}</b>
          <small className="block">{daily.done ? "Ferdig i dag" : `+$${DAILY_REWARD} når du består den`}</small>
        </span>
        {!daily.done && (
          <Button label={`Dagens øvelse: ${dailyName}`} onClick={() => onTrain(daily.id)}>
            Tren
          </Button>
        )}
      </div>
      <div className="drill-daily train-climb">
        <span className="drill-level-badge" aria-hidden>
          {finished ? CLIMB_MAX : level}
        </span>
        <span className="min-w-0 flex-1">
          <small className="drill-kicker">{finished ? "STIGEN ER FULLFØRT" : `NIVÅ ${level} AV ${CLIMB_MAX}`}</small>
          <b className="block">{finished ? "Alle nivåene er klare" : `Få minst ${climbTarget(level)} poeng på tre piler`}</b>
          <small className="block">{finished ? "" : open ? `+$${CLIMB_REWARD} for hvert nivå` : `Oppgrader rommet for å komme videre (tak: nivå ${levelCap(career.room)})`}</small>
        </span>
        {!finished && (
          <Button label={`Stigen, nivå ${level}`} disabled={!open} onClick={() => onTrain("stige")}>
            Tren
          </Button>
        )}
      </div>
      <Button block onClick={onUpgrade}>
        Oppgrader
      </Button>
    </div>
  );
}
