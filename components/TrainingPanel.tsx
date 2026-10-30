"use client";

import { dollars, type Career } from "@/lib/career";
import { CLIMB_MAX, DRILLS, climbLevel, climbOpen, climbReward, climbTarget, dailyOf, dailyReward, goalLine, drillLevel, type DrillId } from "@/lib/drills";
import { GEAR, gearNow, nextGear, whyNotBuyGear, type GearId } from "@/lib/gear";
import { CheckIcon, FlameIcon } from "./icons";
import { Button } from "./ui/Button";

/** What a press of Tren starts: a drill of the day, or the ladder. */
export type TrainTarget = DrillId | "stige";

/**
 * What the training room holds, and nothing else: the button for a better room on top, then the drill of the day (one line, with what it pays as a
 * badge) and the ladder (a hundred levels, each passed by making enough with three darts, each paying once), each with a Tren button. Under them
 * what else the money buys (lib/gear.ts): the darts, a coach and the travel, each a row with what the player has, what the next step does and its price.
 */
export function TrainingPanel({ career, onTrain, onUpgrade, onBuyGear, today }: { career: Career; onTrain: (t: TrainTarget) => void; onUpgrade: () => void; onBuyGear?: (id: GearId) => void; /** The day, as a date (the drill of the day changes with it). */ today: string }) {
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
        <span className="train-badge">{daily.done ? "ferdig" : `+$${dailyReward(career)}`}</span>
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
        {!finished && <span className="train-badge">+${climbReward(career)}</span>}
        {!finished && (
          <Button label={`Stigen, nivå ${level}`} disabled={!open} onClick={() => onTrain("stige")}>
            Tren
          </Button>
        )}
      </div>
      {onBuyGear && (
        <ul className="gear" aria-label="Utstyr">
          {GEAR.map((g) => {
            const now = gearNow(career, g.id);
            const next = nextGear(career, g.id);
            const why = whyNotBuyGear(career, g.id);
            return (
              <li key={g.id} className="gear-row">
                <span className="min-w-0 flex-1">
                  <small className="drill-kicker">
                    {g.name.toUpperCase()} · {now.name}
                  </small>
                  <span className="train-line">{next ? <><b>{next.name}</b> <em>{next.about}</em></> : <em>{now.about}</em>}</span>
                </span>
                {next && (
                  <Button label={`Kjøp ${next.name}, ${dollars(next.price)}`} disabled={!!why} onClick={() => onBuyGear(g.id)}>
                    {dollars(next.price)}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
