"use client";

import { useEffect, useMemo, useState } from "react";
import { callOut } from "@/lib/announcer";
import type { BotLevel } from "@/lib/botLevels";
import { botHighstrikerRound } from "@/lib/botDarts";
import { botDelayMs } from "@/lib/botSpeed";
import { undoThroughBots } from "@/lib/botTurns";
import { generateConfettiRain } from "@/lib/confetti";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { highstrikerResult } from "@/lib/gameResults";
import { useRecordResult } from "@/lib/gameResultsStorage";
import { haptics } from "@/lib/haptics";
import { towerScale, towerShare } from "@/lib/roundTier";
import {
  DEFAULT_LIVES,
  MAX_LIVES,
  MIN_LIVES,
  memberUp,
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
import { splitPeople, type PickedTeam, type Person } from "@/lib/people";
import { rostersOf } from "@/lib/teamGame";
import { medOfLevel } from "@/lib/opponentStats";
import { useGameVenue } from "@/lib/gameVenue";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { uiSound } from "@/lib/uiSound";
import { Bell } from "./Bell";
import { useBotTurn } from "./useBotTurn";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hearts } from "./Hearts";
import { MinusIcon, PlusIcon, UndoIcon } from "./icons";
import { ScoreKeypad } from "./ScoreKeypad";
import { GameVenue, VenueSection } from "./GameVenue";
import { GameWho, type GameMode } from "./GameWho";
import { SideAvatar } from "./SideAvatar";
import { ScreenTop } from "./ScreenTop";
import { commitPeople, commitTeams } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { VoiceToggle } from "./VoiceSwitch";
import { CountUp } from "./ui/CountUp";
import { FOCUS_RING } from "./ui/focus";
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
  const [mode, setMode] = useState<GameMode>("individual");
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [lives, setLives] = useState(DEFAULT_LIVES);
  const [game, setGame] = useState<HighstrikerGame | null>(null);
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  const [venue, setVenue] = useGameVenue("highstriker");

  if (!game) {
    const problem = (mode === "team" ? teamSetupProblem(teams, true, 2) : people.length > 0 && people.every((p) => p.isBot) ? "Velg minst én spiller" : individualSetupProblem(people.map((p) => p.name), false, 2)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Highstriker" onBack={onExitToHome} />
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Hver runde må være mer enn runden før. Gjør du ikke det, mister du et liv.
          </p>
          <GameWho mode={mode} onMode={setMode} people={people} onPeople={setPeople} teams={teams} onTeams={setTeams} />
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
          <VenueSection value={venue} onChange={setVenue} />
          <StickyAction
            onClick={() => {
              if (mode === "team") {
                // A team has its lives together, and its members throw a round each, in turn.
                commitTeams(teams);
                setBotLevels({});
                setGame(newGame(lives, teams.map((t) => t.name), rostersOf(teams)));
                return;
              }
              commitPeople(people);
              const split = splitPeople(people);
              setBotLevels(split.botLevels);
              setGame(newGame(lives, split.players));
            }}
            ready={!problem}
            summary={setupSummary([mode === "team" ? `${teams.length} lag` : `${people.length} spillere`, `${lives} liv`])}
            reason={problem}
          >
            Start kampen
          </StickyAction>
        </div>
      </div>
    );
  }

  return (
    <GameVenue venue={venue}>
      <HighstrikerGameScreen game={game} setGame={setGame} botLevels={botLevels} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />
    </GameVenue>
  );
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
  // A team throws one member at a time: it is the member who is a bot or not, and the member who is named.
  const member = memberUp(game);
  const who = member?.name ?? up;
  const botUp = !winner && (member ? member.isBot : isBot(up));
  const isBotThrower = (n: string) => isBot(n) || Object.values(game.rosters ?? {}).some((r) => r.some((m) => m.name === n && m.isBot));
  useRecordResult(career || game.rosters ? null : winner, game.turns.length === 0, (id, at) => highstrikerResult(game, Object.keys(botLevels), id, at));

  // A player on the last life is told so, once, when the turn comes to them.
  useEffect(() => {
    if (lastLife) callOut("Siste liv");
  }, [lastLife, up, game.turns.length]);
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  // The win is announced with the fanfare, where the level allows it.
  useEffect(() => {
  }, [winner, fx.confetti]);

  function submit(scored: number, darts?: string) {
    setBotNote(darts ? `${who}: ${darts} = ${scored}` : "");
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
    const r = botHighstrikerRound(least, member ? member.botLevel ?? medOfLevel(4) : botLevels[up]);
    submit(r.scored, r.labels.join(" · "));
  });

  function undo() {
    setBotNote("");
    setGame(undoThroughBots(game, isBotThrower));
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
          <div className="card-gold shadow-panel rounded-2xl text-center mb-4 mt-12 relative" style={{ padding: "3.4rem 1.25rem 1.1rem" }}>
            <span className="absolute flex flex-col items-center" style={{ top: "-4.6rem", left: "50%", transform: "translateX(-50%)" }}>
              <Bell ring size={30} />
              <SideAvatar name={winner} roster={game.rosters?.[winner]} photo={photos.get(winner)} px={104} state="winner" />
            </span>
            <p className="font-display" style={{ color: "var(--color-bg)", fontStyle: "italic", fontSize: "var(--text-body)", letterSpacing: "0.04em" }}>
              Vinner
            </p>
            <h1 className="font-display" style={{ color: "var(--color-bg)", fontSize: "clamp(2.2rem, 11vw, 3rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p style={{ color: "var(--color-bg)", opacity: 0.8, fontSize: "var(--text-small)", fontWeight: 700, letterSpacing: "0.1em" }}>HIGHSTRIKER · SISTE I LIVE</p>
            <p className="mt-1">
              <Hearts total={game.lives} left={livesLeft(game, winner)} fresh={false} />
            </p>
            <dl className="winner-figures grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "HØYESTE", value: bestOf(game, winner) ?? 0, fmt: (n: number) => String(n) },
                { label: "RUNDER", value: game.turns.filter((t) => t.player === winner).length, fmt: (n: number) => String(n) },
                { label: "LIV IGJEN", value: livesLeft(game, winner), fmt: (n: number) => String(n) },
              ].map((f) => (
                <div key={f.label} className="winner-figure rounded-xl py-1.5">
                  <dd className="font-display" style={{ color: "var(--color-bg)", fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    <CountUp value={f.value} format={f.fmt} ms={1000} />
                  </dd>
                  <dt style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "var(--text-micro)", fontWeight: 700, letterSpacing: "0.12em" }}>{f.label}</dt>
                </div>
              ))}
            </dl>
          </div>
          <div className="mb-5">
            <Stairs game={{ ...game, turns: game.turns.filter((t) => t.player === winner) }} height="5rem" count={8} />
          </div>
          <ul className="space-y-2 mb-6" aria-label="Resultat">
            {game.players.map((p) => (
              <li key={p} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}>
                <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={44} state={p === winner ? "winner" : "idle"} />
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
              <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.lives, game.players, game.rosters))}>
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

  const order = [...game.players].sort((a, b) => Number(isOut(game, a)) - Number(isOut(game, b)));
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
      <div className="screen-inner hs-fill">
        <ScreenTop
          title="Highstriker"
          onBack={() => setConfirmExit(true)}
          backLabel={career ? "Gi opp" : "Avslutt kampen"}
          right={
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                aria-label="Angre siste runde"
                onClick={undo}
                disabled={game.turns.length === 0}
                className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`}
                style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: game.turns.length === 0 ? 0.4 : 1 }}
              >
                <UndoIcon className="w-5 h-5" />
              </button>
              <VoiceToggle />
            </span>
          }
        />
        <ul className="hs-board" aria-label="Stilling" style={{ gridTemplateRows: order.map((p) => (p === up ? "1.6fr" : "1fr")).join(" ") }}>
          {order.map((p) => {
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
                className={`hs-card hs-row relative flex items-center gap-3 overflow-hidden ${active && !out ? "hs-row--up" : ""} ${out ? "hs-out" : ""} ${hit ? "hs-hit" : ""} ${active && !out ? "turn-lift" : ""} ${isLast ? "hs-last" : ""}`}
              >
                {hit && <span key={game.turns.length} aria-hidden className="hs-flash" />}
                {out && outTurn && (
                  <span key={outAt} className="hs-stamp" aria-hidden>
                    UTE
                  </span>
                )}
                <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={active && !out ? 64 : 40} state={active ? "active" : "idle"} bot={isBot(p)} />
                <div className="flex-1 min-w-0">
                  <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                  <Hearts total={game.lives} left={left} fresh={hit} beat={isLast} size={active && !out ? "w-7 h-7" : "w-4 h-4"} />
                  {isLast && <p className="last-label">SISTE LIV</p>}
                  {game.rosters?.[p] && active && !out && (
                    <p className="cd-recent">
                      <span>Nå: {who}</span>
                    </p>
                  )}
                  {out && outTurn && (
                    <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                      Ute i runde {Math.floor(outAt / game.players.length) + 1} med {outTurn.scored}
                    </p>
                  )}
                </div>
                {out ? (
                  <span className="sr-only">UTE</span>
                ) : (
                  <span className="num hs-last-score" aria-label={mine ? `Siste runde: ${mine.scored}` : undefined}>
                    {mine ? mine.scored : "–"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="hs-target flex items-center gap-4" style={{ borderRadius: "var(--radius-m)", padding: "0.6rem 0.875rem", background: "var(--teal-soft)", border: "1px solid var(--teal-ring)" }}>
          <div className="hs-tower" aria-hidden>
            <div className="hs-bell-spot">
              <Bell key={passes ? "ring" : "idle"} ring={passes} size={26} />
            </div>
            <div className="hs-tower-clip">
              <div className={`hs-tower-fill ${least !== null && !passes && typed !== "" ? "hs-tower-fill--short" : ""} ${passes ? "hs-tower-fill--pass" : ""}`} style={{ height: `${towerShare(written, scale) * 100}%` }} />
              {least !== null && <div className="hs-tower-mark" style={{ bottom: `${towerShare(least, scale) * 100}%` }} />}
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {least === null ? (
              <p className="font-display" style={{ fontSize: "clamp(1.6rem, 8vw, 2.2rem)", color: "var(--color-cream)", lineHeight: 1.1 }}>
                Sett standarden
              </p>
            ) : (
              <>
                <p className="section-label">{up.toUpperCase()} MÅ HA MINST</p>
                <p key={game.turns.length} className="num hs-target-number" style={{ color: "var(--color-cream)" }}>
                  {least}
                </p>
              </>
            )}
            <div className="mt-1">
              <Stairs game={game} height="2.2rem" count={6} />
            </div>
          </div>
        </div>

        <div className="hs-right">
          <div className="hs-pad" inert={botUp} style={{ opacity: botUp ? 0.45 : 1, transition: "opacity var(--pull)" }}>
            <ScoreKeypad
              fill
              onTyped={setTyped}
              onSubmit={submit}
              onUndo={undo}
              canUndo={game.turns.length > 0}
              tone={(typed) => {
                if (typed === "" || least === null) return undefined;
                return Number(typed) >= least ? "finish" : "bust";
              }}
              line={(typed) => {
                if (botUp) return <span className="cd-note">{who} kaster …</span>;
                if (typed === "" && botNote) return <span className="cd-note">{botNote}</span>;
                if (typed === "" || least === null) return null;
                const n = Number(typed);
                // The colour of the number says it; the words are for a screen reader.
                return <span className="sr-only">{n >= least ? `${typed} holder · over ${target}` : `${typed} er for lite · må ha ${least}`}</span>;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
