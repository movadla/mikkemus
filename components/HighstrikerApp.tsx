"use client";

import { useEffect, useMemo, useState } from "react";
import { generateConfettiRain } from "@/lib/confetti";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { haptics } from "@/lib/haptics";
import {
  DEFAULT_LIVES,
  MAX_LIVES,
  MIN_LIVES,
  averageOf,
  bestOf,
  isOut,
  leastToKeep,
  livesLeft,
  newGame,
  playRound,
  playerUp,
  targetOf,
  undoRound,
  winnerOf,
  type HighstrikerGame,
} from "@/lib/highstriker";
import { splitPeople, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { uiSound } from "@/lib/uiSound";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hearts } from "./Hearts";
import { MinusIcon, PlusIcon } from "./icons";
import { PlayerPicker } from "./PlayerPicker";
import { ScoreKeypad } from "./ScoreKeypad";
import { ScreenTop } from "./ScreenTop";
import { commitPeople } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { SwitchRow } from "./ui/Switch";

const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * Highstriker: three lives each, and every round has to be more than the round before. Written in the same way as 301 and 501, and it
 * says in big numbers what the round has to be. A life that goes breaks in front of everyone; the last one standing wins.
 */
export function HighstrikerApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [lives, setLives] = useState(DEFAULT_LIVES);
  const [game, setGame] = useState<HighstrikerGame | null>(null);
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));

  if (!game) {
    const problem = individualSetupProblem(people.map((p) => p.name), false, 2);
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Highstriker" onBack={onExitToHome} />
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Hver runde må være mer enn runden før. Gjør du ikke det, mister du et liv.
          </p>
          <PlayerPicker people={people} onChange={setPeople} botsAllowed={false} guests />
          <div className="mt-4 space-y-2">
            <SwitchRow
              label="Avanserte innstillinger"
              hint="Antall liv"
              checked={advanced}
              onChange={(on) => {
                setAdvanced(on);
                if (!on) setLives(DEFAULT_LIVES);
              }}
            />
            {advanced && (
              <div className="flex items-center justify-between gap-4 px-4" style={{ minHeight: "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <span style={{ color: "var(--color-cream)", fontWeight: 600 }}>Liv hver</span>
                <span className="inline-flex items-center gap-3">
                  <Button label="Ett liv mindre" icon={<MinusIcon className="w-5 h-5" />} onClick={() => setLives((n) => Math.max(MIN_LIVES, n - 1))} disabled={lives <= MIN_LIVES} />
                  <span className="num tabular text-center" style={{ fontSize: "var(--text-num)", minWidth: "2ch" }} aria-live="polite">
                    {lives}
                  </span>
                  <Button label="Ett liv mer" icon={<PlusIcon className="w-5 h-5" />} onClick={() => setLives((n) => Math.min(MAX_LIVES, n + 1))} disabled={lives >= MAX_LIVES} />
                </span>
              </div>
            )}
          </div>
          <StickyAction
            onClick={() => {
              commitPeople(people);
              setGame(newGame(lives, splitPeople(people).players));
            }}
            ready={!problem}
            summary={setupSummary([`${people.length} spillere`, `${lives} liv`])}
            reason={problem}
          >
            Start kampen
          </StickyAction>
        </div>
      </div>
    );
  }

  return <HighstrikerGameScreen game={game} setGame={setGame} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />;
}

function HighstrikerGameScreen({
  game,
  setGame,
  photos,
  onHome,
  onNew,
}: {
  game: HighstrikerGame;
  setGame: (g: HighstrikerGame) => void;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  const fx = fxFlags(useFxLevel());
  const winner = winnerOf(game);
  const up = playerUp(game);
  const target = targetOf(game);
  const least = leastToKeep(game);
  const last = game.turns[game.turns.length - 1];
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  // The win is announced with the fanfare, where the level allows it.
  useEffect(() => {
    if (winner && fx.confetti) playFanfare();
  }, [winner, fx.confetti]);

  function submit(scored: number) {
    const next = playRound(game, scored);
    const turn = next.turns[next.turns.length - 1];
    if (turn.lostLife) {
      haptics.undo();
      uiSound("undo");
    } else {
      haptics.confirm();
      uiSound("confirm");
    }
    setGame(next);
  }

  if (winner) {
    return (
      <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": "var(--color-gold)" } as React.CSSProperties}>
        <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
          {rain.map((c, i) => (
            <span key={i} className="confetti-rain" style={{ left: c.left, width: c.width, height: c.height, background: c.color, animationDelay: c.delay, animationDuration: c.duration, "--r": c.rotate, "--fall": c.fall } as React.CSSProperties} />
          ))}
        </div>
        <div className="screen-inner relative z-10">
          <div className="flex flex-col items-center text-center mb-6 mt-6">
            <Avatar name={winner} photo={photos.get(winner)} px={112} state="winner" />
            <p className="section-label mt-4">HIGHSTRIKER · SISTE I LIVE</p>
            <h1 className="font-display" style={{ color: "var(--color-gold)", fontSize: "clamp(2.2rem, 11vw, 3.2rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p className="mt-1">
              <Hearts total={game.lives} left={livesLeft(game, winner)} fresh={false} />
            </p>
          </div>
          <ul className="space-y-2 mb-6" aria-label="Resultat">
            {game.players.map((p) => (
              <li key={p} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}>
                <Avatar name={p} photo={photos.get(p)} size="m" state={p === winner ? "winner" : "idle"} />
                <span className="flex-1 min-w-0 truncate font-semibold">{p}</span>
                <span className="text-right" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  <span className="num block" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                    {bestOf(game, p) ?? "–"}
                  </span>
                  beste · snitt {oneDecimal(averageOf(game, p) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.lives, game.players))}>
              Spill igjen
            </Button>
            <Button block onClick={() => setGame(undoRound(game))}>
              Angre siste runde
            </Button>
            <Button block onClick={onNew}>
              Ny kamp
            </Button>
            <Button block variant="ghost" onClick={onHome}>
              Til forsiden
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-screen-enter screen">
      {confirmExit && (
        <ConfirmDialog
          message="Avslutte kampen?"
          buttons={[
            { label: "Fortsett spill", onClick: () => setConfirmExit(false), background: "var(--color-green)" },
            { label: "Avslutt kamp", onClick: onHome, background: "var(--color-red)" },
          ]}
        />
      )}
      <div className="screen-inner">
        <ScreenTop title="Highstriker" onBack={() => setConfirmExit(true)} backLabel="Avslutt kampen" />
        <ul className="space-y-2 mb-4" aria-label="Stilling">
          {game.players.map((p) => {
            const active = p === up;
            const out = isOut(game, p);
            const left = livesLeft(game, p);
            const hit = last?.player === p && last.lostLife;
            const mine = [...game.turns].reverse().find((t) => t.player === p);
            return (
              <li
                key={p}
                aria-current={active ? "true" : undefined}
                className={`hs-card relative flex items-center gap-3 overflow-hidden ${out ? "hs-out" : ""} ${hit ? "hs-hit" : ""}`}
                style={{
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--radius-m)",
                  background: active ? "color-mix(in srgb, var(--color-teal) 12%, var(--color-surface))" : "var(--color-surface)",
                  border: active ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
                  boxShadow: "var(--elevation-1)",
                }}
              >
                {hit && <span key={game.turns.length} aria-hidden className="hs-flash" />}
                <Avatar name={p} photo={photos.get(p)} size="m" state={active ? "active" : "idle"} />
                <div className="flex-1 min-w-0">
                  <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                  <Hearts total={game.lives} left={left} fresh={hit} />
                </div>
                <div className="text-right" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  {out ? (
                    <span style={{ color: "var(--color-red)", fontWeight: 700, letterSpacing: "0.1em" }}>UTE</span>
                  ) : (
                    <>
                      <span className="num block" style={{ fontSize: "2rem", color: "var(--color-cream)" }}>
                        {mine ? mine.scored : "–"}
                      </span>
                      siste
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="text-center mb-3 hs-target" style={{ borderRadius: "var(--radius-m)", padding: "0.75rem", background: "var(--teal-soft)", border: "1px solid var(--teal-ring)" }}>
          {least === null ? (
            <>
              <p className="section-label">FØRSTE RUNDE</p>
              <p className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                {up} setter ribben, ingenting å slå
              </p>
            </>
          ) : (
            <>
              <p className="section-label">{up.toUpperCase()} MÅ HA MINST</p>
              <p key={game.turns.length} className="num hs-target-number" style={{ fontSize: "3.5rem", color: "var(--color-cream)" }}>
                {least}
              </p>
              <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                for å beholde livet · {last?.player} fikk {target}
              </p>
            </>
          )}
        </div>

        <ScoreKeypad
          onSubmit={submit}
          onUndo={() => setGame(undoRound(game))}
          canUndo={game.turns.length > 0}
          line={(typed) => {
            if (typed === "" || least === null) return <span style={{ color: "var(--color-muted)" }}>{up} kaster · skriv hva runden ble</span>;
            const n = Number(typed);
            return n >= least ? (
              <span style={{ color: "var(--color-green)", fontWeight: 600 }}>{typed} holder · over {target}</span>
            ) : (
              <span style={{ color: "var(--color-red)", fontWeight: 600 }}>
                {typed} er for lite · må ha {least}
              </span>
            );
          }}
        />
      </div>
    </div>
  );
}
