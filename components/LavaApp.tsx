"use client";

import { useEffect, useMemo, useState } from "react";
import { generateConfettiRain } from "@/lib/confetti";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { lavaResult } from "@/lib/gameResults";
import { useRecordResult } from "@/lib/gameResultsStorage";
import { lavaNight } from "@/lib/nightGames";
import { useRecordNight } from "@/lib/nightScoreStorage";
import { haptics } from "@/lib/haptics";
import {
  DARTS_PER_ROUND,
  DEFAULT_LIVES,
  MAX_LIVES,
  MIN_LIVES,
  MISS,
  burnedBy,
  isOut,
  livesLeft,
  newGame,
  playDart,
  safeLeft,
  sectionLabel,
  stateOf,
  undoDart,
  type LavaDart,
  type LavaGame,
} from "@/lib/lava";
import { splitPeople, type PickedTeam, type Person } from "@/lib/people";
import { standing, type SeriesWiring } from "@/lib/series";
import { rostersOf } from "@/lib/teamGame";
import { medOfLevel } from "@/lib/opponentStats";
import { fieldOfLabel } from "@/lib/lava";
import { useGameVenue } from "@/lib/gameVenue";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { uiSound } from "@/lib/uiSound";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hearts } from "./Hearts";
import { MinusIcon, PlusIcon } from "./icons";
import { LavaBoard } from "./LavaBoard";
import { GameVenue, VenueSection } from "./GameVenue";
import { GameWho, type GameMode } from "./GameWho";
import { SideAvatar } from "./SideAvatar";
import { needsStart } from "@/lib/startChoice";
import { StartChoice } from "./StartChoice";
import { SeriesPicker, SeriesSummary, seriesLine } from "./SeriesPicker";
import { ScreenTop } from "./ScreenTop";
import { commitPeople, commitTeams } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { Button } from "./ui/Button";
import { SwitchRow } from "./ui/Switch";
import { useBotTurn } from "./useBotTurn";
import type { BotLevel } from "@/lib/botLevels";
import { botLavaDart } from "@/lib/botDarts";
import { botDelayMs } from "@/lib/botSpeed";

/** What the last dart did, in words: said under the board, and read out by the screen reader. */
function describe(d: LavaDart): string {
  const who = d.by ?? d.player;
  if (d.section === MISS) return `${who}: bom`;
  if (d.outcome === "burn") return `${who}: ${sectionLabel(d.section)} er brent${d.opened !== undefined ? `. ${sectionLabel(d.opened)} er trygg igjen` : ""}`;
  return d.knockedOut ? `${who}: ${sectionLabel(d.section)} er lava, og det var siste liv` : `${who}: ${sectionLabel(d.section)} er lava, mister et liv`;
}

/**
 * Lava: one board, and every section is safe until someone hits it. Then all of it is lava (double, treble and both singles) and a dart
 * in it costs a life. Three darts a round, the sections are touched on the board as the darts land, and the last one with a life wins.
 */
export function LavaApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [mode, setMode] = useState<GameMode>("individual");
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [lives, setLives] = useState(DEFAULT_LIVES);
  /** Best av x: 1 is one game. */
  const [bestOf, setBestOf] = useState(1);
  /** The winners of the games of the series so far. */
  const [history, setHistory] = useState<string[]>([]);
  /** Doubles and trebles as sections of their own (under Avanserte innstillinger). */
  const [rings, setRings] = useState(false);
  const [game, setGame] = useState<LavaGame | null>(null);
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  const [venue, setVenue] = useGameVenue("lava");

  if (!game) {
    const problem = (mode === "team" ? teamSetupProblem(teams, true, 2) : people.length > 0 && people.every((p) => p.isBot) ? "Velg minst én spiller" : individualSetupProblem(people.map((p) => p.name), false, 2)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Lava" onBack={onExitToHome} />
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Treffer du et felt, blir det lava for alle: dobbel, trippel og begge enkeltfeltene. Treffer noen lava, mister de et liv.
          </p>
          <GameWho mode={mode} onMode={setMode} people={people} onPeople={setPeople} teams={teams} onTeams={setTeams} />
          <div className="mt-4 space-y-2">
            <SwitchRow
              label="Avanserte innstillinger"
              hint="Antall liv"
              checked={advanced}
              onChange={(on) => {
                setAdvanced(on);
                if (!on) {
                  setLives(DEFAULT_LIVES);
                  setRings(false);
                  setBestOf(1);
                }
              }}
            />
            {advanced && <SwitchRow label="Doble og trippel" hint="Hver dobbel og trippel er et felt for seg" checked={rings} onChange={setRings} />}
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
          {advanced && (
            <div className="mt-2">
              <SeriesPicker value={bestOf} onChange={setBestOf} />
            </div>
          )}
          <VenueSection value={venue} onChange={setVenue} />
          <StickyAction
            onClick={() => {
              if (mode === "team") {
                // A team has its lives together, and its members throw a round of three darts each, in turn.
                commitTeams(teams);
                setBotLevels({});
                setGame(newGame(lives, teams.map((t) => t.name), rings ? "all" : "numbers", rostersOf(teams)));
                return;
              }
              commitPeople(people);
              const split = splitPeople(people);
              setBotLevels(split.botLevels);
              setGame(newGame(lives, split.players, rings ? "all" : "numbers"));
            }}
            ready={!problem}
            summary={setupSummary([mode === "team" ? `${teams.length} lag` : `${people.length} spillere`, `${lives} liv`, ...(rings ? ["doble og trippel"] : [])])}
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
      <LavaGameScreen game={game} setGame={setGame} botLevels={botLevels} photos={photos} onHome={onExitToHome} onNew={() => {
          setGame(null);
          setHistory([]);
        }} series={bestOf > 1 ? { bestOf, history, onWin: (w) => setHistory((h) => [...h, w]), onReset: () => setHistory([]) } : undefined} />
    </GameVenue>
  );
}

export function LavaGameScreen({
  game,
  setGame,
  botLevels,
  photos,
  onHome,
  onNew,
  career,
  series,
}: {
  game: LavaGame;
  setGame: (g: LavaGame) => void;
  botLevels: Record<string, BotLevel | number>;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
  /** A challenge of the career: the result is not kept with the statistics, the winner screen goes on, and leaving gives it up. */
  career?: { onDone: () => void };
  /** A series (best of x) the game is one of. */
  series?: SeriesWiring;
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  /** The dart just thrown, while its effect plays: set when a dart goes in, cleared when one is taken back. */
  const [fresh, setFresh] = useState<{ n: number; dart: LavaDart } | null>(null);
  const fx = fxFlags(useFxLevel());
  const state = useMemo(() => stateOf(game), [game]);
  const { winner, up } = state;
  const big = fx.heat;
  const isBot = (p: string) => botLevels[p] !== undefined;
  // A team throws one member at a time (a round of three darts each): it is the member who is a bot or not, and the member who is named.
  const member = state.member;
  const who = member?.name ?? up;
  const botUp = !winner && (member ? member.isBot : isBot(up));
  const isBotThrower = (n: string) => isBot(n) || Object.values(game.rosters ?? {}).some((r) => r.some((m) => m.name === n && m.isBot));
  const std = series ? standing(series, game.players, winner) : null;
  const nightWinner = series ? (std?.decided ?? null) : winner;
  useRecordNight(nightWinner, game.darts.length === 0, (id) => (career || !nightWinner ? null : lavaNight(game, nightWinner, Object.keys(botLevels), id, series && std ? { bestOf: series.bestOf, wins: std.wins } : undefined)));
  useRecordResult(career || game.rosters ? null : winner, game.darts.length === 0, (id, at) => lavaResult(game, Object.keys(botLevels), id, at));
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  useEffect(() => {
  }, [winner, fx.confetti]);

  function pick(section: number) {
    const next = playDart(game, section);
    if (next === game) return;
    const dart = stateOf(next).log.at(-1)!;
    if (dart.outcome === "lava") {
      haptics.undo();
      uiSound("undo");
    } else if (dart.outcome === "burn") {
      haptics.confirm();
      uiSound("confirm");
    } else {
      uiSound("click");
    }
    setFresh({ n: next.darts.length, dart });
    setGame(next);
  }

  // A bot throws a dart at a time, with a pause that follows the bot speed in Innstillinger.
  // The first thing in a game: who starts. Asked once, before anything is thrown.
  const asking = needsStart(game, game.darts.length);
  useBotTurn(botUp && !asking, game.darts.length, () => botDelayMs() + 250, () => {
    const d = botLavaDart(new Set(state.burned.keys()), member ? member.botLevel ?? medOfLevel(4) : botLevels[up], undefined, game.fields);
    pick(fieldOfLabel(d.label, d.section, game.fields));
  });

  function undo() {
    haptics.undo();
    setFresh(null);
    // Taking a dart back also takes back the bots' darts after it, or the bot would throw it again at once.
    let g = game;
    while (g.darts.length > 0 && isBotThrower(stateOf(g).log.at(-1)!.by ?? stateOf(g).log.at(-1)!.player)) g = undoDart(g);
    setGame(undoDart(g));
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
            <SideAvatar name={winner} roster={game.rosters?.[winner]} photo={photos.get(winner)} px={112} state="winner" />
            <p className="section-label mt-4">LAVA · SISTE I LIVE</p>
            <h1 className="font-display" style={{ color: "var(--color-gold)", fontSize: "clamp(2.2rem, 11vw, 3.2rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p className="mt-1">
              <Hearts total={game.lives} left={livesLeft(state, winner)} fresh={false} />
            </p>
          </div>
          <ul className="space-y-2 mb-6" aria-label="Resultat">
            {game.players.map((p) => (
              <li key={p} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}>
                <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={44} state={p === winner ? "winner" : "idle"} />
                <span className="flex-1 min-w-0 truncate font-semibold">{p}</span>
                <span className="text-right" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  <span className="num block" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                    {burnedBy(state, p)}
                  </span>
                  felt brent
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
                  if (series && winner) (std?.decided ? series.onReset : () => series.onWin(winner))();
                  setGame(newGame(game.lives, game.players, game.fields, game.rosters));
                }}
              >
                {series ? (std?.decided ? "Ny serie" : "Neste kamp") : "Spill igjen"}
              </Button>
            )}
            <Button block onClick={undo}>
              Angre siste pil
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

  const last = state.log.at(-1);
  const lostNow = fresh?.dart.outcome === "lava" ? fresh.dart.player : null;
  const message = fresh ? describe(fresh.dart) : `${who} kaster`;
  const roundDarts = [...state.round];

  return (
    <div className="animate-screen-enter screen">
      {asking && <StartChoice game={game} setGame={setGame} photos={photos} isBot={isBot} />}
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
        <ScreenTop title="Lava" onBack={() => setConfirmExit(true)} backLabel={career ? "Gi opp" : "Avslutt kampen"} sub={series ? seriesLine(series, game.players, null) : undefined} />
        <ul className="grid grid-cols-2 gap-2 mb-3" aria-label="Stilling">
          {game.players.map((p) => {
            const active = p === up;
            const out = isOut(state, p);
            const hit = lostNow === p;
            return (
              <li
                key={p}
                aria-current={active ? "true" : undefined}
                className={`hs-card relative flex items-center gap-2 overflow-hidden min-w-0 ${out ? "hs-out" : ""} ${hit ? "hs-hit" : ""} ${active && !out ? "lava-turn" : ""}`}
                style={{
                  padding: "0.5rem 0.625rem",
                  borderRadius: "var(--radius-m)",
                  background: active ? "color-mix(in srgb, var(--color-red) 14%, var(--color-surface))" : "var(--color-surface)",
                  border: active ? "2px solid var(--color-red)" : "1px solid var(--color-border)",
                  boxShadow: "var(--elevation-1)",
                }}
              >
                {hit && <span key={fresh?.n} aria-hidden className="hs-flash" />}
                <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={44} state={active ? "active" : "idle"} bot={isBot(p)} />
                <div className="flex-1 min-w-0">
                  <p className="font-display truncate" style={{ fontSize: "var(--text-body)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                  {out ? (
                    <span style={{ color: "var(--color-red)", fontWeight: 700, letterSpacing: "0.1em", fontSize: "var(--text-small)" }}>UTE</span>
                  ) : (
                    <Hearts total={game.lives} left={livesLeft(state, p)} fresh={hit} size="w-4 h-4" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <LavaBoard burned={state.burned} effect={fresh?.dart ?? null} effectKey={fresh?.n ?? 0} darts={roundDarts} onPick={pick} disabled={botUp} big={big} rings={game.fields === "all"} />

        <div role="status" aria-live="polite" className="text-center mt-3 mb-2" style={{ minHeight: "1.5rem", fontSize: "var(--text-body)", fontWeight: 600, color: fresh?.dart.outcome === "lava" ? "var(--color-red)" : "var(--color-cream)" }}>
          {message}
        </div>
        <p className="text-center mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
          {who}{who !== up ? ` for ${up}` : ""} · pil {Math.min(state.thrown + 1, DARTS_PER_ROUND)} av {DARTS_PER_ROUND} · {safeLeft(state, game.fields)} felt er trygge
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button block size="lg" onClick={() => pick(MISS)} disabled={botUp}>
            Bom
          </Button>
          <Button block size="lg" onClick={undo} disabled={!last || botUp}>
            Angre
          </Button>
        </div>
      </div>
    </div>
  );
}
