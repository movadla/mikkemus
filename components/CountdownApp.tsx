"use client";

import { useEffect, useMemo, useState } from "react";
import { callOut } from "@/lib/announcer";
import type { BotLevel } from "@/lib/botLevels";
import { botCountdownRound, type BotRound } from "@/lib/botDarts";
import { botDelayMs } from "@/lib/botSpeed";
import { medOfLevel } from "@/lib/opponentStats";
import { undoThroughBots } from "@/lib/botTurns";
import { checkoutsOf } from "@/lib/checkout";
import { generateConfettiRain } from "@/lib/confetti";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { countdownResult } from "@/lib/gameResults";
import { useRecordResult } from "@/lib/gameResultsStorage";
import { countdownNight } from "@/lib/nightGames";
import { useRecordNight } from "@/lib/nightScoreStorage";
import { tierOf } from "@/lib/roundTier";
import {
  DARTS_PER_ROUND,
  averageOf,
  bestRoundOf,
  dartsOf,
  judge,
  leaderOf,
  finishesOfOthers,
  memberUp,
  newGame,
  nextUp,
  playRound,
  playerUp,
  remainingOf,
  roundsOf,
  startOf,
  tonsOf,
  winnerOf,
  type CountdownGame,
  type CountdownStart,
} from "@/lib/countdown";
import { haptics } from "@/lib/haptics";
import { splitPeople, type PickedTeam, type Person } from "@/lib/people";
import { standing, type SeriesWiring } from "@/lib/series";
import { NO_BONUS, countdownBonuses, type BonusSettings, type NightBonus } from "@/lib/bonus";
import { rostersOf } from "@/lib/teamGame";
import { WhoLine } from "./WhoLine";
import { useGameVenue } from "@/lib/gameVenue";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { CheckoutChips } from "./CheckoutChips";
import { useBotTurn } from "./useBotTurn";
import { ConfirmDialog } from "./ConfirmDialog";
import { RollingNumber } from "./RollingNumber";
import { ScoreKeypad } from "./ScoreKeypad";
import { GameVenue, VenueSection } from "./GameVenue";
import { GameWho, type GameMode } from "./GameWho";
import { SideAvatar } from "./SideAvatar";
import { needsStart } from "@/lib/startChoice";
import { countdownFigures, type FigureSet } from "@/lib/nightFigures";
import { startWakeLock } from "@/lib/wakeLock";
import { StartChoice } from "./StartChoice";
import { SeriesPicker, SeriesSummary, seriesLine } from "./SeriesPicker";
import { ScreenTop } from "./ScreenTop";
import { commitPeople, commitTeams } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { VoiceToggle } from "./VoiceSwitch";
import { CountUp } from "./ui/CountUp";
import { UndoIcon } from "./icons";
import { Button } from "./ui/Button";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";
import { SwitchRow } from "./ui/Switch";
import { FOCUS_RING } from "./ui/focus";

const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * 301 and 501 as they are played over a pint: who is playing, the number to count down from, and then only what each round made. The
 * round is written in on a keypad, and one that can only be what it says (19 and up) goes in by itself, with nothing to confirm. When a
 * round takes someone to nothing they say how many darts the last round took, so the average of three darts is right.
 */
export function CountdownApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [mode, setMode] = useState<GameMode>("individual");
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [start, setStart] = useState<CountdownStart>(501);
  const [advanced, setAdvanced] = useState(false);
  /** Best av x: 1 is one game. */
  const [bestOf, setBestOf] = useState(1);
  /** The winners of the games of the series so far. */
  const [history, setHistory] = useState<string[]>([]);
  /** Extra points for feats (180, three bulls, a checkout of 100 or more), and the feats of the games of the series so far. */
  const [bonus, setBonus] = useState<BonusSettings>(NO_BONUS);
  const [bonusHistory, setBonusHistory] = useState<NightBonus[]>([]);
  const [figuresHistory, setFiguresHistory] = useState<FigureSet[]>([]);
  const [doubleOut, setDoubleOut] = useState(true);
  const [game, setGame] = useState<CountdownGame | null>(null);
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  const [venue, setVenue] = useGameVenue("countdown");

  if (!game) {
    const problem = (mode === "team" ? teamSetupProblem(teams, true, 2) : people.length > 0 && people.every((p) => p.isBot) ? "Velg minst én spiller" : individualSetupProblem(people.map((p) => p.name), false)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="301 / 501" onBack={onExitToHome} />
          <p className="section-label mb-2">START FRA</p>
          <div className="mb-4">
            <Segmented value={String(start) as "301" | "501"} onChange={(v) => setStart(Number(v) as CountdownStart)} label="Start fra" options={[{ value: "501", label: "501" }, { value: "301", label: "301" }]} />
          </div>
          <GameWho mode={mode} onMode={setMode} people={people} onPeople={setPeople} teams={teams} onTeams={setTeams} />
          <div className="mt-4">
            <SwitchRow label="Dobbel ut" hint="Står det 1 igjen, er runden over streken" checked={doubleOut} onChange={setDoubleOut} />
          </div>
          <div className="mt-3 space-y-2">
            <SwitchRow
              label="Avanserte innstillinger"
              hint="Best av"
              checked={advanced}
              onChange={(on) => {
                setAdvanced(on);
                if (!on) {
                  setBestOf(1);
                  setBonus(NO_BONUS);
                }
              }}
            />
            {advanced && <SeriesPicker value={bestOf} onChange={setBestOf} />}
            {advanced && (
              <div className="space-y-2" role="group" aria-label="Ekstrapoeng">
                <p className="section-label mt-1">EKSTRAPOENG I KVELDSSCORE</p>
                <SwitchRow label="180" hint="Et poeng til den som kaster 180" checked={bonus.s180} onChange={(v) => setBonus({ ...bonus, s180: v })} />
                <SwitchRow label="Tre i bull" hint="Et poeng når en runde på 150 var tre bull (du blir spurt)" checked={bonus.bull3} onChange={(v) => setBonus({ ...bonus, bull3: v })} />
                <SwitchRow label="Utsjekk på 100 eller mer" hint="Et poeng til vinneren" checked={bonus.co100} onChange={(v) => setBonus({ ...bonus, co100: v })} />
              </div>
            )}
          </div>
          <VenueSection value={venue} onChange={setVenue} />
          <StickyAction
            onClick={() => {
              if (mode === "team") {
                // A team has one score, and its members throw a round each, in turn: a bot among them throws its own round.
                commitTeams(teams);
                setBotLevels({});
                setGame(newGame(start, doubleOut, teams.map((t) => t.name), undefined, rostersOf(teams)));
                return;
              }
              commitPeople(people);
              const split = splitPeople(people);
              setBotLevels(split.botLevels);
              setGame(newGame(start, doubleOut, split.players));
            }}
            ready={!problem}
            summary={setupSummary([mode === "team" ? `${teams.length} lag` : `${people.length} ${people.length === 1 ? "spiller" : "spillere"}`, String(start)])}
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
      <CountdownGameScreen game={game} setGame={setGame} botLevels={botLevels} photos={photos} onHome={onExitToHome} onSetup={() => setGame(null)} onNew={() => {
          setGame(null);
          setHistory([]);
          setBonusHistory([]);
          setFiguresHistory([]);
        }} bonus={bonus} series={bestOf > 1 ? { bestOf, history, bonus: bonusHistory, figures: figuresHistory, onWin: (w, b, f) => {
          setHistory((h) => [...h, w]);
          setBonusHistory((x) => [...x, ...(b ?? [])]);
          if (f) setFiguresHistory((x) => [...x, f]);
        }, onReset: () => {
          setHistory([]);
          setBonusHistory([]);
          setFiguresHistory([]);
        } } : undefined} />
    </GameVenue>
  );
}

/**
 * The board of a leg. In the career (`career`) it is one leg of a tournament: the result is not kept with the other games' statistics, the
 * winner screen only goes on (`onDone`), and leaving is a pause, since the career keeps the leg as it stands.
 */
export function CountdownGameScreen({
  game,
  setGame,
  botLevels,
  photos,
  onHome,
  onNew,
  onSetup,
  career,
  series,
  bonus,
}: {
  game: CountdownGame;
  setGame: (g: CountdownGame) => void;
  botLevels: Record<string, BotLevel | number>;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
  /** Back to the setup, everything as chosen: the setup of a game is kept by the screen that started it. */
  onSetup?: () => void;
  career?: { onDone: () => void; /** A challenge, not a leg of a cup: leaving gives it up. */ giveUp?: boolean };
  /** A series (best of x) the game is one of. */
  series?: SeriesWiring;
  /** The feats that give an extra point (set under Avanserte innstillinger). */
  bonus?: BonusSettings;
}) {
  const [finishing, setFinishing] = useState<number | null>(null);
  /** A round of 150 with the extra point for three bulls on: the thrower is asked, as 150 can be made in other ways. */
  const [askBull, setAskBull] = useState<number | null>(null);
  /** The answer, for a round that finishes the game and still has to say how many darts it took. */
  const [finishBull, setFinishBull] = useState(false);
  const [notice, setNotice] = useState("");
  /** The darts of the bot that threw last, for the line under the board: told as it is, not as a warning. */
  const [botNote, setBotNote] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  /** The round that just went in, while what it did plays: set when one goes in, cleared when one is taken back. */
  const [fresh, setFresh] = useState<{ n: number; player: string; scored: number; bust: boolean } | null>(null);
  const [slam, setSlam] = useState<number | null>(null);
  const fx = fxFlags(useFxLevel());
  const winner = winnerOf(game);
  const up = playerUp(game);
  const left = remainingOf(game, up);
  const way = checkoutsOf(left, game.doubleOut, 1)[0] ?? null;
  // The others who have a finish too: it is shown while the other side throws, so they can see what they have.
  const waysOfOthers = useMemo(() => (winner ? [] : finishesOfOthers(game, up)), [game, up, winner]);
  const leader = leaderOf(game);
  const isBot = (p: string) => botLevels[p] !== undefined;
  // A team throws one member at a time: it is the member who is a bot or not, and the member who is named.
  const member = memberUp(game);
  const who = member?.name ?? up;
  const next = game.rosters && !winner ? nextUp(game) : null;
  const botUp = !winner && (member ? member.isBot : isBot(up));
  const isBotThrower = (n: string) => isBot(n) || Object.values(game.rosters ?? {}).some((r) => r.some((m) => m.name === n && m.isBot));
  const std = series ? standing(series, game.players, winner) : null;
  const nightWinner = series ? (std?.decided ?? null) : winner;
  useRecordNight(nightWinner, game.turns.length === 0, (id) => (career || !nightWinner ? null : countdownNight(game, nightWinner, Object.keys(botLevels), id, series && std ? { bestOf: series.bestOf, wins: std.wins } : undefined, [...(series?.bonus ?? []), ...countdownBonuses(game, bonus)], series?.figures)));
  useRecordResult(career || game.rosters ? null : winner, game.turns.length === 0, (id, at) => countdownResult(game, Object.keys(botLevels), id, at));
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  useEffect(() => {
  }, [winner, fx.confetti]);

  // The 180 is on the screen for a moment and goes by itself.
  useEffect(() => {
    if (slam === null) return;
    const t = setTimeout(() => setSlam(null), 1800);
    return () => clearTimeout(t);
  }, [slam]);

  /** The round is written in: over the line it counts for nothing, a finish asks how many darts it took, anything else goes on. */
  function submit(scored: number, asked: false | "yes" | "no" = false) {
    const verdict = judge(left, scored, game.doubleOut);
    if (!asked && bonus?.bull3 && scored === 150 && verdict !== "bust") {
      setAskBull(scored);
      return;
    }
    // The number is said at once, so the round can be heard to have gone in right; over the line it is said as such.
    callOut(verdict === "bust" ? "Over" : String(scored));
    if (verdict === "finish") {
      setFinishBull(asked === "yes");
      setFinishing(scored);
      return;
    }
    haptics.confirm();
    setBotNote("");
    setNotice(verdict === "bust" ? `${who}: over streken, runden teller ikke` : "");
    setFresh({ n: game.turns.length + 1, player: up, scored, bust: verdict === "bust" });
    if (verdict === "counts" && tierOf(scored) === "max" && fx.heat) {
      setSlam(game.turns.length + 1);
      if (fx.ringSlam) playFanfare();
    }
    setGame(playRound(game, scored, undefined, asked === "yes"));
  }

  /** A bot's round: its darts are shown, the number is said as for anyone else, and it goes in with the darts it took. */
  function playBot(r: BotRound) {
    const darts = r.labels.join(" · ");
    callOut(r.bust ? "Over" : String(r.scored));
    haptics.confirm();
    setNotice("");
    setBotNote(r.bust ? `${who}: ${darts}, over streken` : r.finished ? `${who}: ${darts}, tar ut!` : `${who}: ${darts} = ${r.scored}`);
    setFresh({ n: game.turns.length + 1, player: up, scored: r.scored, bust: r.bust });
    if (!r.bust && tierOf(r.scored) === "max" && fx.heat) {
      setSlam(game.turns.length + 1);
      if (fx.ringSlam) playFanfare();
    }
    setGame(playRound(game, r.scored, r.darts));
  }

  // A bot throws its round after a pause that follows the bot speed in Innstillinger.
  // A member's level is a MED in mm; one without is given the middle of the scale (39 mm, level 4), never a bare 4, which would be 4 mm.
  // The screen stays on while the game is up: a phone that locks between rounds loses the sound and the board.
  useEffect(() => startWakeLock(), []);
  // The first thing in a game: who starts. Asked once, before anything is thrown.
  const asking = !career && needsStart(game, game.turns.length);
  useBotTurn(botUp && !asking && finishing === null, game.turns.length, () => botDelayMs() * 2 + 300, () => playBot(botCountdownRound(left, game.doubleOut, member ? member.botLevel ?? medOfLevel(4) : botLevels[up])));

  function undo() {
    haptics.undo();
    setNotice("");
    setBotNote("");
    setFresh(null);
    setSlam(null);
    setGame(undoThroughBots(game, isBotThrower));
  }

  const key = `tactile flex items-center justify-center font-display ${FOCUS_RING}`;
  const keyStyle = { minHeight: "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-num)", boxShadow: "var(--elevation-1)" } as const;

  if (winner) {
    const darts = dartsOf(game, winner);
    const finalTurn = game.turns[game.turns.length - 1];
    const rounds = roundsOf(game, winner);
    const points = rounds.map((n, i) => `${rounds.length === 1 ? 100 : (i / (rounds.length - 1)) * 200},${36 - (n / 180) * 32}`).join(" ");
    return (
      <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": "var(--color-gold)" } as React.CSSProperties}>
        <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
          {rain.map((c, i) => (
            <span key={i} className="confetti-rain" style={{ left: c.left, width: c.width, height: c.height, background: c.color, animationDelay: c.delay, animationDuration: c.duration, "--r": c.rotate, "--fall": c.fall } as React.CSSProperties} />
          ))}
        </div>
        <div className="screen-inner relative z-10">
          <div className="card-gold shadow-panel rounded-2xl text-center mb-4 mt-8 relative" style={{ padding: "3.4rem 1.25rem 1.1rem" }}>
            <span className="absolute" style={{ top: "-2.9rem", left: "50%", transform: "translateX(-50%)" }}>
              <SideAvatar name={winner} roster={game.rosters?.[winner]} photo={photos.get(winner)} px={104} state="winner" />
            </span>
            <p className="font-display" style={{ color: "var(--color-bg)", fontStyle: "italic", fontSize: "var(--text-body)", letterSpacing: "0.04em" }}>
              Vinner · {game.start}
            </p>
            <h1 className="font-display" style={{ color: "var(--color-bg)", fontSize: "clamp(2.2rem, 11vw, 3rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p className="mt-1" style={{ color: "var(--color-bg)", opacity: 0.8, fontSize: "var(--text-small)", fontWeight: 700, letterSpacing: "0.1em" }}>
              UT PÅ {finalTurn.scored} · {finalTurn.darts} {finalTurn.darts === 1 ? "PIL" : "PILER"}
            </p>
            <p style={{ color: "var(--color-bg)", opacity: 0.7, fontSize: "var(--text-small)" }}>{darts} piler totalt</p>
            <dl className="winner-figures grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "SNITT", value: Math.round((averageOf(game, winner) ?? 0) * 10), fmt: (n: number) => oneDecimal(n / 10) },
                { label: "HØYESTE", value: bestRoundOf(game, winner), fmt: (n: number) => String(n) },
                { label: "100+", value: tonsOf(game, winner), fmt: (n: number) => String(n) },
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
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full mb-4" style={{ height: "2.5rem" }} role="img" aria-label={`Rundene til ${winner}: ${rounds.join(", ")}`}>
            <polyline points={points} fill="none" stroke="var(--color-teal)" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul className="space-y-2 mb-6" aria-label="Resultat">
            {game.players.map((p) => (
              <li key={p} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}>
                <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={44} state={p === winner ? "winner" : "idle"} />
                <span className="flex-1 min-w-0 truncate font-semibold">{p}</span>
                <span className="text-right" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  <span className="num block" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                    {oneDecimal(averageOf(game, p) ?? 0)}
                  </span>
                  snitt · {remainingOf(game, p) === 0 ? "ferdig" : `${remainingOf(game, p)} igjen`}
                </span>
              </li>
            ))}
          </ul>
          {series && winner && <SeriesSummary series={series} sides={game.players} current={winner} />}
          <div className="space-y-2">
            {career ? (
              <Button block variant="primary" size="lg" onClick={career.onDone}>
                Fortsett
              </Button>
            ) : (
              <Button
                block
                variant="primary"
                size="lg"
                onClick={() => {
                  if (series && winner) (std?.decided ? series.onReset : () => series.onWin(winner, countdownBonuses(game, bonus), countdownFigures(game, winner)))();
                  setGame(newGame(game.start, game.doubleOut, game.players, game.starts, game.rosters));
                }}
              >
                {series ? (std?.decided ? "Ny serie" : "Neste kamp") : "Spill igjen"}
              </Button>
            )}
            <Button block onClick={undo}>
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
      {asking && <StartChoice game={game} setGame={setGame} photos={photos} isBot={isBot} />}
      {slam !== null && (
        <div key={slam} className="round-slam" aria-hidden>
          <div className="rays" />
          <span className="num">180</span>
          <span className="cap">ONE HUNDRED AND EIGHTY</span>
        </div>
      )}
      {confirmExit && (
        <ConfirmDialog
          message={career?.giveUp ? "Gi opp utfordringen?" : career ? "Ta en pause? Kampen er lagret." : "Avslutte kampen?"}
          buttons={[
            { label: "Fortsett spill", onClick: () => setConfirmExit(false), background: "var(--color-green)" },
            ...(onSetup ? [{ label: "Til oppsettet", onClick: onSetup, background: "var(--color-teal)" }] : []),
            { label: career?.giveUp ? "Gi opp" : career ? "Pause" : "Avslutt kamp", onClick: onHome, background: career && !career.giveUp ? "var(--color-teal)" : "var(--color-red)" },
          ]}
        />
      )}
      {askBull !== null && (
        <Sheet
          title="Tre i bull?"
          onClose={() => {
            const s = askBull;
            setAskBull(null);
            submit(s, "no");
          }}
        >
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            {who} kastet 150. Var det tre bull? Det gir et ekstra poeng i Kveldsscore.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="primary"
              onClick={() => {
                const s = askBull;
                setAskBull(null);
                submit(s, "yes");
              }}
            >
              Ja, tre bull
            </Button>
            <Button
              size="lg"
              onClick={() => {
                const s = askBull;
                setAskBull(null);
                submit(s, "no");
              }}
            >
              Nei
            </Button>
          </div>
        </Sheet>
      )}
      {finishing !== null && (
        <Sheet title="Hvor mange piler tok siste runde?" onClose={() => setFinishing(null)}>
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            {up} gikk ut på {finishing}. Det gir riktig snitt.
          </p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Antall piler">
            {Array.from({ length: DARTS_PER_ROUND }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={n === 1 ? "1 pil" : `${n} piler`}
                onClick={() => {
                  haptics.win();
                  setFinishing(null);
                  setGame(playRound(game, finishing, n, finishBull));
                }}
                className={key}
                style={keyStyle}
              >
                {n}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      <div className="screen-inner cd-fill">
        <ScreenTop
          title={String(game.start)}
          sub={series ? seriesLine(series, game.players, null) : undefined}
          onBack={() => (onSetup && game.turns.length === 0 ? onSetup() : setConfirmExit(true))}
          backLabel={career?.giveUp ? "Gi opp" : career ? "Pause" : "Tilbake"}
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
        {/* A team has a member up: who it is is said over the score. A lone player is the lit card. */}
        {member && (
          <p key={`${up}-${game.turns.length}`} className="turn-banner" aria-hidden>
            {who} kaster for {up}
          </p>
        )}
        <ul
          className={`cd-board ${game.players.length === 2 ? "cd-board--duel" : game.players.length === 3 ? "cd-board--list" : "cd-board--grid"}`}
          aria-label="Stilling"
          style={
            game.players.length === 2
              ? { gridTemplateColumns: game.players.map((p) => (p === up ? "1.3fr" : "1fr")).join(" ") }
              : game.players.length === 3
                ? { gridTemplateRows: game.players.map((p) => (p === up ? "1.7fr" : "1fr")).join(" ") }
                : (() => {
                    // Four and more: two across, and the one who is up takes the larger share of the column and the row it is in.
                    const at = Math.max(0, game.players.indexOf(up));
                    const rows = Math.ceil(game.players.length / 2);
                    return { gridTemplateColumns: at % 2 === 0 ? "1.25fr 1fr" : "1fr 1.25fr", gridTemplateRows: Array.from({ length: rows }, (_, r) => (r === Math.floor(at / 2) ? "1.35fr" : "1fr")).join(" ") };
                  })()
          }
        >
          {game.players.map((p) => {
            const active = p === up;
            const mine = fresh?.player === p ? fresh : null;
            const togo = remainingOf(game, p);
            const pct = Math.max(0, Math.min(100, (togo / startOf(game, p)) * 100));
            const ready = active && way !== null;
            // The three rounds before: what the form is right now.
            const recent = game.turns.filter((t) => t.player === p).slice(-3);
            const big = game.players.length <= 3;
            return (
              <li
                key={p}
                aria-current={active ? "true" : undefined}
                className={`cd-card ${active ? "cd-card--up turn-lift" : ""} ${ready ? "cd-ready" : ""} ${mine?.bust ? "cd-bust" : ""}`}
              >
                {leader === p && <span className="lead-mark">LEDER</span>}
                {mine && !mine.bust && (
                  <span key={mine.n} className="delta-chip">
                    −{mine.scored}
                  </span>
                )}
                {mine?.bust && (
                  <span key={mine.n} className="stamp">
                    OVER
                  </span>
                )}
                {mine && !mine.bust && tierOf(mine.scored) === "big" && (
                  <span className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: "inherit" }} aria-hidden>
                    <span key={mine.n} className="glint" />
                  </span>
                )}
                <div className="cd-who">
                  <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={big ? (active ? 68 : 44) : active ? 46 : 32} state={active ? "active" : "idle"} bot={isBot(p)} />
                  <div className="min-w-0">
                    <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                      {p}
                    </p>
                    {game.rosters && active && !winner ? (
                      <WhoLine now={game.rosters[p] ? who : undefined} next={next} />
                    ) : (
                      recent.length > 0 && (
                      <p className="cd-recent" aria-label={`Siste runder: ${recent.map((t) => (t.bust ? "over" : t.scored)).join(", ")}`}>
                        {recent.map((t, i) => (
                          <span key={`${game.turns.length}-${i}`} className={t.bust ? "cd-recent--bust" : undefined}>
                            {t.bust ? "over" : t.scored}
                          </span>
                        ))}
                      </p>
                      )
                    )}
                  </div>
                </div>
                {mine?.bust ? (
                  <span key={mine.n} className="num bust-shake cd-num">
                    {togo}
                  </span>
                ) : (
                  <RollingNumber value={togo} className="num cd-num" style={{ color: ready ? "var(--color-gold-strong)" : active ? "var(--color-cream)" : "var(--color-text-2)" }} />
                )}
                <div className={`drain-bar ${togo < 170 ? "drain-bar--warm" : ""}`} aria-hidden>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="cd-right">
          {/* The way out, over the keypad, as large as the keys: only when there is one. */}
          {way && (
            <div className="cd-way-bar">
              <span className="cd-way-label">{game.players.length > 2 || waysOfOthers.length > 0 ? `${up} UT` : "UT"}</span>
              <CheckoutChips way={way} />
            </div>
          )}
          {waysOfOthers.map((o) => (
            <div key={o.p} className="cd-way-bar cd-way-bar--other" aria-label={`Utsjekk for ${o.p}`}>
              <span className="cd-way-label">{o.p} UT</span>
              <CheckoutChips way={o.way} />
            </div>
          ))}
          <div className="cd-pad" inert={botUp} style={{ opacity: botUp ? 0.45 : 1, transition: "opacity var(--pull)" }}>
            <ScoreKeypad
              fill
              finishLabel="Ut!"
              onSubmit={submit}
              onUndo={undo}
              canUndo={game.turns.length > 0}
              tone={(typed) => {
                if (typed === "") return undefined;
                const verdict = judge(left, Number(typed), game.doubleOut);
                return verdict === "bust" ? "bust" : verdict === "finish" ? "finish" : undefined;
              }}
              line={(typed) => {
                if (botUp) return <span className="cd-note">{who} kaster …</span>;
                if (typed === "" && botNote && !notice) return <span className="cd-note">{botNote}</span>;
                if (typed === "") return notice ? <span className="cd-note" style={{ color: "var(--color-red)" }}>{notice}</span> : null;
                const n = Number(typed);
                const verdict = judge(left, n, game.doubleOut);
                // What the number does is shown by its colour; the words are for a screen reader.
                return (
                  <span className="sr-only">
                    {verdict === "bust" ? `${n} er over streken` : verdict === "finish" ? `${n} tar ut!` : `${up} har ${left - n} igjen etter ${n}`}
                  </span>
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
