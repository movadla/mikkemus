"use client";

import { useMemo, useState } from "react";
import type { TurnAggregate } from "@/lib/game";
import type { BotLevel } from "@/lib/botLevels";
import { dartsOf, newGame, winnerOf, type CountdownStart } from "@/lib/countdown";
import { useRoster } from "@/lib/storage";
import { CountdownGameScreen } from "./CountdownApp";

const stat = (darts: number): TurnAggregate => ({ hits: 0, misses: 0, darts, hitsByStep: {}, missesByStep: {} });

/**
 * One match of a cup played as 501 or 301: a single leg to nothing between the two of them. When it is over, the winner and the darts each used go
 * back to the cup, which moves them on like any other match.
 */
export function CountdownMatch({ players, botLevels, start, doubleOut, humanStart, onDone, onAbort }: { players: string[]; botLevels: Record<string, BotLevel | number>; start: CountdownStart; doubleOut: boolean; humanStart?: number; onDone: (result: { winner: string; placements: string[]; stats: Record<string, TurnAggregate> }) => void; onAbort: () => void }) {
  const roster = useRoster();
  const photos = useMemo(() => new Map(roster.map((r) => [r.name, r.photo])), [roster]);
  const [game, setGame] = useState(() => newGame(start, doubleOut, players, humanStart ? Object.fromEntries(players.filter((p) => botLevels[p] === undefined).map((p) => [p, humanStart])) : undefined));
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
          onDone({ winner, placements, stats: Object.fromEntries(players.map((p) => [p, stat(dartsOf(game, p))])) });
        },
      }}
    />
  );
}
