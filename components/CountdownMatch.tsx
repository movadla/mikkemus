"use client";

import { useMemo, useState } from "react";
import type { TurnAggregate } from "@/lib/game";
import type { BotLevel, TeamMember } from "@/lib/botLevels";
import { dartsOf, newGame, roundsOf, winnerOf, type CountdownStart } from "@/lib/countdown";
import { medOfLevel } from "@/lib/opponentStats";
import { useRoster } from "@/lib/storage";
import { CountdownGameScreen } from "./CountdownApp";

const stat = (darts: number): TurnAggregate => ({ hits: 0, misses: 0, darts, hitsByStep: {}, missesByStep: {} });

/**
 * One match of a cup played as 501 or 301: a single leg to nothing between the two of them. When it is over, the winner and the darts each used go
 * back to the cup, which moves them on like any other match.
 */
export function CountdownMatch({ players, botLevels, teamRosters, start, doubleOut, humanStart, onDone, onAbort }: { players: string[]; botLevels: Record<string, BotLevel | number>; /** The members of the sides that are teams: one score for each team, and its members throw in turn. */ teamRosters?: Record<string, TeamMember[]>; start: CountdownStart; doubleOut: boolean; humanStart?: number; onDone: (result: { winner: string; placements: string[]; stats: Record<string, TurnAggregate> }) => void; onAbort: () => void }) {
  const roster = useRoster();
  const photos = useMemo(() => new Map(roster.map((r) => [r.name, r.photo])), [roster]);
  const [game, setGame] = useState(() =>
    newGame(
      start,
      doubleOut,
      players,
      humanStart ? Object.fromEntries(players.filter((p) => botLevels[p] === undefined && !teamRosters?.[p]).map((p) => [p, humanStart])) : undefined,
      // A member's level is a step of the level scale ("4"); the game throws by a MED in mm, so it is turned into one (a bare 4 would be a 4 mm thrower, who finishes 501 in nine darts).
      Object.fromEntries(players.filter((p) => teamRosters?.[p]).map((p) => [p, teamRosters![p].map((x) => ({ name: x.name, isBot: x.isBot, ...(x.isBot ? { botLevel: medOfLevel(Number(x.botLevel ?? 4)) } : {}) }))])),
    ),
  );
  return (
    <CountdownGameScreen
      game={game}
      setGame={setGame}
      botLevels={botLevels}
      photos={photos}
      onHome={onAbort}
      onNew={() => undefined}
      career={{
        onDone: () => {
          const winner = winnerOf(game);
          if (!winner) return;
          const placements = [winner, ...players.filter((p) => p !== winner)];
          const last = game.turns[game.turns.length - 1];
          onDone({ winner, placements, stats: Object.fromEntries(players.map((p) => [p, { ...stat(dartsOf(game, p)), rounds: roundsOf(game, p), ...(p === winner && last ? { checkout: last.scored } : {}) }])) });
        },
      }}
    />
  );
}
