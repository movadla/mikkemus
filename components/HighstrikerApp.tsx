"use client";

import { useEffect, useMemo, useState } from "react";
import { callOut } from "@/lib/announcer";
import type { BotLevel } from "@/lib/botLevels";
import { botHighstrikerRound } from "@/lib/botDarts";
import { botDelayMs } from "@/lib/botSpeed";
import { undoThroughBots } from "@/lib/botTurns";
import { generateConfettiRain } from "@/lib/confetti";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { highstrikerResult } from "@/lib/gameResults";
import { useRecordResult } from "@/lib/gameResultsStorage";
import { haptics } from "@/lib/haptics";
import { towerScale, towerShare } from "@/lib/roundTier";
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
import { Bell } from "./Bell";
import { useBotTurn } from "./useBotTurn";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hearts } from "./Hearts";
import { MinusIcon, PlusIcon } from "./icons";
import { PlayerPicker } from "./PlayerPicker";
import { ScoreKeypad } from "./ScoreKeypad";
import { ScreenTop } from "./ScreenTop";
import { commitPeople } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { VoiceSwitch } from "./VoiceSwitch";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { SwitchRow } from "./ui/Switch";

const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");

/** The rounds that have gone up, as steps that grow: one that did not beat the one before is hatched red, and the best one is gold. */
function Stairs({ game, height = "4rem", count = 6 }: { game: HighstrikerGame; height?: string; count?: number }) {
  const turns = game.turns.slice(-count);
  if (turns.length === 0) return null;
  const top = Math.max(60, ...turns.map((t) => t.scored)) * 1.05;
  const best = Math.max(...turns.map((t) => t.scored));
  return (
    <div className="hs-stairs" style={{ height }} role="img" aria-label={`Rundene: ${turns.map((t) => t.scored).join(", ")}`}>
      {turns.map((t, i) => (
        <span key={`${game.turns.length - turns.length + i}`} className={`hs-step ${t.lostLife ? "hs-step--bad" : t.scored === best ? "hs-step--best" : ""}`} style={{ height: `${Math.max(14, (t.scored / top) * 100)}%`, animationDelay: `${i * 40}ms` }} aria-hidden>
          {t.scored}
        </span>
      ))}
    </div>
  );
}

/**
 * Highstriker: three lives each, and every round has to be more than the round before. Written in the same way as 301 and 501, and it
 * says in big numbers what the round has to be. A life that goes breaks in front of everyone; the last one standing wins.
 */
export function HighstrikerApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [lives, setLives] = useState(DEFAULT_LIVES);
  const [game, setGame] = useState<HighstrikerGame | null>(null);
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));

  if (!game) {
    const problem = (people.length > 0 && people.every((p) => p.isBot) ? "Velg minst én spiller" : individualSetupProblem(people.map((p) => p.name), false, 2)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Highstriker" onBack={onExitToHome} />
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Hver runde må være mer enn runden før. Gjør du ikke det, mister du et liv.
          </p>
          <PlayerPicker people={people} onChange={setPeople} guests />
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
              const split = splitPeople(people);
              setBotLevels(split.botLevels);
              setGame(newGame(lives, split.players));
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

  return <HighstrikerGameScreen game={game} setGame={setGame} botLevels={botLevels} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />;
}

export function HighstrikerGameScreen({
  game,
  setGame,
  botLevels,
  photos,
  onHome,
  onNew,
  career,
}: {
  game: HighstrikerGame;
  setGame: (g: HighstrikerGame) => void;
  botLevels: Record<string, BotLevel | number>;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
  /** A challenge of the career: the result is not kept with the statistics, the winner screen goes on, and leaving gives it up. */
  career?: { onDone: () => void };
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  /** What is written on the keypad, so the tower can rise with it. */
  const [typed, setTyped] = useState("");
  /** The darts of the bot that threw last, for the line under the tower. */
  const [botNote, setBotNote] = useState("");
  const fx = fxFlags(useFxLevel());
  const winner = winnerOf(game);
  const up = playerUp(game);
  const target = targetOf(game);
  const least = leastToKeep(game);
  const last = game.turns[game.turns.length - 1];
  const upLives = livesLeft(game, up);
  const scale = towerScale(least);
  const written = typed === "" ? 0 : Number(typed);
  const passes = least !== null && typed !== "" && written >= least;
  const lastLife = !winner && game.turns.length > 0 && upLives === 1;
  const isBot = (p: string) => botLevels[p] !== undefined;
  const botUp = !winner && isBot(up);
  useRecordResult(career ? null : winner, game.turns.length === 0, (id, at) => highstrikerResult(game, Object.keys(botLevels), id, at));

  // A player on the last life is told so, once, when the turn comes to them.
  useEffect(() => {
    if (lastLife) callOut("Siste liv");
  }, [lastLife, up, game.turns.length]);
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  // The win is announced with the fanfare, where the level allows it.
  useEffect(() => {
    if (winner && fx.confetti) playFanfare();
  }, [winner, fx.confetti]);

  function submit(scored: number, darts?: string) {
    setBotNote(darts ? `${up}: ${darts} = ${scored}` : "");
    const next = playRound(game, scored);
    const turn = next.turns[next.turns.length - 1];
    const nextUp = playerUp(next);
    const need = leastToKeep(next);
    if (!winnerOf(next) && need !== null) callOut(`${scored}${turn.lostLife ? ", for lite" : ""}. ${nextUp}, du må ha ${need}`);
    if (turn.lostLife) {
      haptics.undo();
      uiSound("undo");
    } else {
      haptics.confirm();
      uiSound("confirm");
    }
    setGame(next);
  }

  // A bot throws its round after a pause that follows the bot speed in Innstillinger.
  useBotTurn(botUp, game.turns.length, () => botDelayMs() * 2 + 300, () => {
    const r = botHighstrikerRound(least, botLevels[up]);
    submit(r.scored, r.labels.join(" · "));
  });

  function undo() {
    setBotNote("");
    setGame(undoThroughBots(game, isBot));
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
          <div className="flex flex-col items-center text-center mb-4 mt-6">
            <Bell ring size={30} />
            <Avatar name={winner} photo={photos.get(winner)} px={112} state="winner" />
            <p className="section-label mt-4">HIGHSTRIKER · SISTE I LIVE</p>
            <h1 className="font-display" style={{ color: "var(--color-gold)", fontSize: "clamp(2.2rem, 11vw, 3.2rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p className="mt-1">
              <Hearts total={game.lives} left={livesLeft(game, winner)} fresh={false} />
            </p>
            <p className="mt-2 inline-block rounded-full px-3 py-1 font-bold" style={{ background: "var(--gold-soft)", color: "var(--color-gold-strong)", fontSize: "var(--text-small)", letterSpacing: "0.1em" }}>
              BESTE RUNDE {bestOf(game, winner) ?? "–"}
            </p>
          </div>
          <div className="mb-5">
            <Stairs game={{ ...game, turns: game.turns.filter((t) => t.player === winner) }} height="5rem" count={8} />
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
            {career ? (
              <Button block variant="primary" size="lg" onClick={career.onDone}>
                Fortsett
              </Button>
            ) : (
              <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.lives, game.players))}>
                Spill igjen
              </Button>
            )}
            <Button block onClick={() => setGame(undoRound(game))}>
              Angre siste runde
            </Button>
            {!career && (
              <>
                <Button block onClick={onNew}>
                  Ny kamp
                </Button>
                <Button block variant="ghost" onClick={onHome}>
                  Til forsiden
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-screen-enter screen">
      {lastLife && fx.heat && <div className="hs-vignette" aria-hidden />}
      {confirmExit && (
        <ConfirmDialog
          message={career ? "Gi opp utfordringen?" : "Avslutte kampen?"}
          buttons={[
            { label: "Fortsett spill", onClick: () => setConfirmExit(false), background: "var(--color-green)" },
            { label: career ? "Gi opp" : "Avslutt kamp", onClick: onHome, background: "var(--color-red)" },
          ]}
        />
      )}
      <div className="screen-inner">
        <ScreenTop title="Highstriker" onBack={() => setConfirmExit(true)} backLabel={career ? "Gi opp" : "Avslutt kampen"} />
        <p key={`${up}-${game.turns.length}`} className="turn-banner" aria-hidden>
          {up} kaster
        </p>
        <ul className="space-y-2 mb-4" aria-label="Stilling">
          {[...game.players].sort((a, b) => Number(isOut(game, a)) - Number(isOut(game, b))).map((p) => {
            const active = p === up;
            const out = isOut(game, p);
            const left = livesLeft(game, p);
            const hit = last?.player === p && last.lostLife;
            const mine = [...game.turns].reverse().find((t) => t.player === p);
            const outAt = out ? game.turns.findIndex((t, i) => t.player === p && livesLeft({ ...game, turns: game.turns.slice(0, i + 1) }, p) <= 0) : -1;
            const outTurn = outAt >= 0 ? game.turns[outAt] : null;
            const isLast = active && left === 1;
            return (
              <li
                key={p}
                aria-current={active ? "true" : undefined}
                className={`hs-card relative flex items-center gap-3 overflow-hidden ${out ? "hs-out" : ""} ${hit ? "hs-hit" : ""} ${active && !out ? "turn-lift" : ""} ${isLast ? "hs-last" : ""}`}
                style={{
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--radius-m)",
                  background: active ? "color-mix(in srgb, var(--color-teal) 12%, var(--color-surface))" : "var(--color-surface)",
                  border: active ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
                  boxShadow: "var(--elevation-1)",
                }}
              >
                {hit && <span key={game.turns.length} aria-hidden className="hs-flash" />}
                {out && outTurn && (
                  <span key={outAt} className="hs-stamp" aria-hidden>
                    UTE
                  </span>
                )}
                <Avatar name={p} photo={photos.get(p)} size="m" state={active ? "active" : "idle"} bot={isBot(p)} />
                <div className="flex-1 min-w-0">
                  <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                  <Hearts total={game.lives} left={left} fresh={hit} beat={isLast} />
                  {isLast && <p className="last-label">SISTE LIV</p>}
                  {out && outTurn && (
                    <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                      Ute i runde {Math.floor(outAt / game.players.length) + 1} med {outTurn.scored}
                    </p>
                  )}
                </div>
                <div className="text-right" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  {out ? (
                    <span className="sr-only">UTE</span>
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

        <div className="hs-target flex items-stretch gap-4 mb-3" style={{ borderRadius: "var(--radius-m)", padding: "0.75rem 0.875rem", background: "var(--teal-soft)", border: "1px solid var(--teal-ring)" }}>
          <div className="hs-tower" aria-hidden>
            <div className="hs-bell-spot">
              <Bell key={passes ? "ring" : "idle"} ring={passes} size={26} />
            </div>
            <div className="hs-tower-clip">
              <div className={`hs-tower-fill ${least !== null && !passes && typed !== "" ? "hs-tower-fill--short" : ""}`} style={{ height: `${towerShare(written, scale) * 100}%` }} />
              {least !== null && <div className="hs-tower-mark" style={{ bottom: `${towerShare(least, scale) * 100}%` }} />}
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
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
                <p key={game.turns.length} className="num hs-target-number" style={{ fontSize: "3.5rem", color: "var(--color-cream)", lineHeight: 1 }}>
                  {least}
                </p>
                <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  for å beholde livet · {last?.player} fikk {target}
                </p>
              </>
            )}
            <div className="mt-2">
              <Stairs game={game} />
            </div>
          </div>
        </div>

        <div inert={botUp} style={{ opacity: botUp ? 0.45 : 1, transition: "opacity var(--pull)" }}>
        <ScoreKeypad
          onTyped={setTyped}
          onSubmit={submit}
          onUndo={undo}
          canUndo={game.turns.length > 0}
          line={(typed) => {
            if (botUp) return <span style={{ color: "var(--color-muted)" }}>{up} kaster …</span>;
            if (typed === "" && botNote) return <span style={{ color: "var(--color-muted)" }}>{botNote}</span>;
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
        <div className="mt-3">
          <VoiceSwitch />
        </div>
      </div>
    </div>
  );
}
