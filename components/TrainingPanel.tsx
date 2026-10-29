"use client";

import type { Career } from "@/lib/career";
import { CLIMB_MAX, CLIMB_REWARD, DAILY_REWARD, DRILLS, climbLevel, climbOpen, climbTarget, dailyOf, goalLine, drillLevel, type DrillId } from "@/lib/drills";
import { CheckIcon, FlameIcon } from "./icons";
import { Button } from "./ui/Button";

/** What a press of Tren starts: a drill of the day, or the ladder. */
export type TrainTarget = DrillId | "stige";

/**
 * What the training room holds, and nothing else: the button for a better room on top, then the drill of the day (one line, with what it pays as a
 * badge) and the ladder (a hundred levels, each passed by making enough with three darts, each paying once), each with a Tren button.
 */
export function TrainingPanel({ career, onTrain, onUpgrade, today }: { career: Career; onTrain: (t: TrainTarget) => void; onUpgrade: () => void; /** The day, as a date (the drill of the day changes with it). */ today: string }) {
  const daily = dailyOf(career, today);
  const dailyName = DRILLS.find((d) => d.id === daily.id)?.name;
  const level = climbLevel(career);
  const finished = level > CLIMB_MAX;
  const open = climbOpen(career);
  return (
    <div className="train" role="group" aria-label="Trening">
      <Button block onClick={onUpgrade}>
        Oppgrader
      </Button>
      <div className={`train-row ${daily.done ? "train-row-done" : ""}`}>
        <span className="drill-flame" aria-hidden>
          {daily.done ? <CheckIcon className="w-5 h-5" /> : <FlameIcon className="w-5 h-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <small className="drill-kicker">DAGENS ØVELSE{daily.streak > 0 ? ` · ${daily.streak} på rad` : ""}</small>
          <span className="train-line">
            <b>{dailyName}</b> <em>{goalLine(daily.id, drillLevel(career, daily.id)).toLowerCase()}</em>
          </span>
        </span>
        <span className="train-badge">{daily.done ? "ferdig" : `+$${DAILY_REWARD}`}</span>
        {!daily.done && (
          <Button label={`Dagens øvelse: ${dailyName}`} onClick={() => onTrain(daily.id)}>
            Tren
          </Button>
        )}
      </div>
      <div className="train-row">
        <span className="drill-level-badge" aria-hidden>
          {finished ? CLIMB_MAX : level}
        </span>
        <span className="min-w-0 flex-1">
          <small className="drill-kicker">{finished ? "STIGEN ER FULLFØRT" : `NIVÅ ${level} AV ${CLIMB_MAX}`}</small>
          {!finished && (
            <span className="train-line">
              <b>Minst {climbTarget(level)}p</b> <em>på tre piler</em>
            </span>
          )}
        </span>
        {!finished && <span className="train-badge">+${CLIMB_REWARD}</span>}
        {!finished && (
          <Button label={`Stigen, nivå ${level}`} disabled={!open} onClick={() => onTrain("stige")}>
            Tren
          </Button>
        )}
      </div>
    </div>
  );
}
