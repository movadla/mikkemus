"use client";

import { useMemo, useState } from "react";
import { callOut } from "@/lib/announcer";
import { generateConfettiRain } from "@/lib/confetti";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { halvitResult } from "@/lib/gameResults";
import { useGameVenue } from "@/lib/gameVenue";
import { useRecordResult } from "@/lib/gameResultsStorage";
import {
  BULL_VALUES,
  ROUNDS,
  ROUNDS_IN_ALL,
  bestRoundOf,
  entryForSum,
  halvingsOf,
  newGame,
  playEntry,
  possibleSum,
  stateOf,
  undoEntry,
  type HalvItEntry,
  type HalvItGame,
} from "@/lib/halvit";
import { haptics } from "@/lib/haptics";
import { splitPeople, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { rostersOf } from "@/lib/teamGame";
import { uiSound } from "@/lib/uiSound";
import { ConfirmDialog } from "./ConfirmDialog";
import { GameVenue, VenueSection } from "./GameVenue";
import { GameWho, type GameMode } from "./GameWho";
import { UndoIcon } from "./icons";
import { RollingNumber } from "./RollingNumber";
import { ScoreKeypad } from "./ScoreKeypad";
import { ScreenTop } from "./ScreenTop";
import { commitPeople, commitTeams } from "./SetupScreen";
import { SideAvatar } from "./SideAvatar";
import { StickyAction } from "./StickyAction";
import { VoiceToggle } from "./VoiceSwitch";
import { Button } from "./ui/Button";
import { CountUp } from "./ui/CountUp";
import { FOCUS_RING } from "./ui/focus";

/**
 * Halv It: ten rounds with a target each. Hit it and the points go on the score; miss it and the whole score is halved. Written in the way of the other
 * games for the rounds that have a sum, with a large Bom; the rounds that are a yes or a no are two large buttons. Alone, against each other, or as teams.
 */
export function HalvItApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [mode, setMode] = useState<GameMode>("individual");
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [game, setGame] = useState<HalvItGame | null>(null);
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  const [venue, setVenue] = useGameVenue("halvit");

  if (!game) {
    const problem = (mode === "team" ? teamSetupProblem(teams, false, 1) : individualSetupProblem(people.map((p) => p.name), false, 1)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Halv It" onBack={onExitToHome} />
          <GameWho mode={mode} onMode={setMode} people={people} onPeople={setPeople} teams={teams} onTeams={setTeams} botsAllowed={false} />
          <VenueSection value={venue} onChange={setVenue} />
          <StickyAction
            onClick={() => {
              if (mode === "team") {
                commitTeams(teams);
                setGame(newGame(teams.map((t) => t.name), rostersOf(teams)));
                return;
              }
              commitPeople(people);
              setGame(newGame(splitPeople(people).players));
            }}
            ready={!problem}
            summary={setupSummary([mode === "team" ? `${teams.length} lag` : `${people.length} ${people.length === 1 ? "spiller" : "spillere"}`, "10 runder"])}
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
      <HalvItGameScreen game={game} setGame={setGame} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />
    </GameVenue>
  );
}


export function HalvItGameScreen({ game, setGame, photos, onHome, onNew }: { game: HalvItGame; setGame: (g: HalvItGame) => void; photos: Map<string, string | null | undefined>; onHome: () => void; onNew: () => void }) {
  const [confirmExit, setConfirmExit] = useState(false);
  /** The throw just taken in, while what it did plays: set when one goes in, cleared when one is taken back. */
  const [fresh, setFresh] = useState<{ n: number; player: string; points: number; bom: boolean } | null>(null);
  const fx = fxFlags(useFxLevel());
  const state = useMemo(() => stateOf(game), [game]);
  const { winner, up, member, round, tieBreak } = state;
  const who = member?.name ?? up;
  const target = ROUNDS[Math.min(round, ROUNDS_IN_ALL) - 1];
  useRecordResult(game.rosters ? null : winner, game.entries.length === 0, (id, at) => halvitResult(game, id, at));
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  function commit(entry: HalvItEntry) {
    callOut(entry.bom ? "Bom" : String(entry.points));
    if (entry.bom) {
      haptics.undo();
      uiSound("undo");
    } else {
      haptics.confirm();
      uiSound("confirm");
    }
    setFresh({ n: game.entries.length + 1, player: up, points: entry.points, bom: entry.bom });
    setGame(playEntry(game, entry));
  }

  function undo() {
    haptics.undo();
    setFresh(null);
    setGame(undoEntry(game));
  }

  if (winner) {
    const order = [...game.players].sort((a, b) => state.scores[b] - state.scores[a]);
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
              Vinner · Halv It
            </p>
            <h1 className="font-display" style={{ color: "var(--color-bg)", fontSize: "clamp(2.2rem, 11vw, 3rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            {state.log.some((t) => t.round > ROUNDS_IN_ALL) && (
              <p style={{ color: "var(--color-bg)", opacity: 0.8, fontSize: "var(--text-small)", fontWeight: 700, letterSpacing: "0.1em" }}>AVGJORT I BULL</p>
            )}
            <dl className="winner-figures grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "POENG", value: state.scores[winner], fmt: (n: number) => String(n) },
                { label: "HALVERT", value: halvingsOf(state, winner), fmt: (n: number) => String(n) },
                { label: "BESTE RUNDE", value: bestRoundOf(state, winner), fmt: (n: number) => String(n) },
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
          <ul className="space-y-2 mb-6" aria-label="Resultat">
            {order.map((p) => (
              <li key={p} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}>
                <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={44} state={p === winner ? "winner" : "idle"} />
                <span className="flex-1 min-w-0 truncate font-semibold">{p}</span>
                <span className="text-right" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  <span className="num block" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                    {state.scores[p]}
                  </span>
                  halvert {halvingsOf(state, p)} {halvingsOf(state, p) === 1 ? "gang" : "ganger"}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.players, game.rosters))}>
              Spill igjen
            </Button>
            <Button block onClick={undo}>
              Angre siste kast
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

  const count = game.players.length;
  const lastThree = (p: string) => state.log.filter((t) => t.player === p && t.round <= ROUNDS_IN_ALL).slice(-3);
  const gridAt = Math.max(0, game.players.indexOf(up));
  const boardStyle: React.CSSProperties =
    count === 1
      ? { gridTemplateColumns: "1fr" }
      : count === 2
        ? { gridTemplateColumns: game.players.map((p) => (p === up ? "1.3fr" : "1fr")).join(" ") }
        : count === 3
          ? { gridTemplateRows: game.players.map((p) => (p === up ? "1.7fr" : "1fr")).join(" ") }
          : { gridTemplateColumns: gridAt % 2 === 0 ? "1.25fr 1fr" : "1fr 1.25fr", gridTemplateRows: Array.from({ length: Math.ceil(count / 2) }, (_, r) => (r === Math.floor(gridAt / 2) ? "1.35fr" : "1fr")).join(" ") };

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
      <div className="screen-inner cd-fill">
        <ScreenTop
          title="Halv It"
          onBack={() => setConfirmExit(true)}
          backLabel="Avslutt kampen"
          right={
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                aria-label="Angre siste kast"
                onClick={undo}
                disabled={game.entries.length === 0}
                className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`}
                style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: game.entries.length === 0 ? 0.4 : 1 }}
              >
                <UndoIcon className="w-5 h-5" />
              </button>
              <VoiceToggle />
            </span>
          }
        />
        <div className="hi-strip">
          <div className="hi-pips" aria-hidden>
            {ROUNDS.map((r) => (
              <i key={r.n} className={r.n < round ? "hi-pip--done" : r.n === round ? "hi-pip--now" : undefined} />
            ))}
          </div>
          <p className="hi-round" role="status" aria-live="polite">
            <small>{tieBreak ? "AVGJØRELSE" : `RUNDE ${round} AV ${ROUNDS_IN_ALL}`}</small>
            <b>{tieBreak ? "En pil i bull" : target.name}</b>
          </p>
        </div>
        <ul className={`cd-board ${count <= 2 ? "cd-board--duel" : count === 3 ? "cd-board--list" : "cd-board--grid"}`} aria-label="Stilling" style={boardStyle}>
          {game.players.map((p) => {
            const active = p === up;
            const mine = fresh?.player === p ? fresh : null;
            const recent = lastThree(p);
            const out = tieBreak && !state.contenders.includes(p);
            return (
              <li key={p} aria-current={active ? "true" : undefined} className={`cd-card ${active ? "cd-card--up turn-lift" : ""} ${mine?.bom ? "cd-bust" : ""}`} style={out ? { opacity: 0.5 } : undefined}>
                {mine && !mine.bom && mine.points > 0 && (
                  <span key={mine.n} className="delta-chip" style={{ color: "var(--color-green)" }}>
                    +{mine.points}
                  </span>
                )}
                {mine?.bom && (
                  <span key={mine.n} className="stamp">
                    ÷2
                  </span>
                )}
                <div className="cd-who">
                  <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={count <= 3 ? (active ? 68 : 44) : active ? 46 : 32} state={active ? "active" : "idle"} />
                  <div className="min-w-0">
                    <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                      {p}
                    </p>
                    {game.rosters?.[p] && active ? (
                      <p className="cd-recent">
                        <span>Nå: {who}</span>
                      </p>
                    ) : (
                      recent.length > 0 && (
                        <p className="cd-recent" aria-label={`Siste runder: ${recent.map((t) => (t.entry.bom ? "halvert" : t.entry.points)).join(", ")}`}>
                          {recent.map((t, i) => (
                            <span key={`${game.entries.length}-${i}`} className={t.entry.bom ? "cd-recent--bust" : undefined}>
                              {t.entry.bom ? "÷2" : `+${t.entry.points}`}
                            </span>
                          ))}
                        </p>
                      )
                    )}
                  </div>
                </div>
                <RollingNumber value={state.scores[p]} className="num cd-num" style={{ color: active ? "var(--color-cream)" : "var(--color-text-2)" }} />
              </li>
            );
          })}
        </ul>

        <div className="cd-right">
          {tieBreak ? (
            <div className="hi-btns">
              <button type="button" className={`hi-btn hi-btn--yes tactile ${FOCUS_RING}`} onClick={() => commit({ points: 0, bom: false })}>
                Treff
                <small>{who} traff bull</small>
              </button>
              <button type="button" className={`hi-btn hi-btn--no tactile ${FOCUS_RING}`} onClick={() => commit({ points: 0, bom: true })}>
                Bom
              </button>
            </div>
          ) : target.input === "yesno" ? (
            <div className="hi-btns">
              <button type="button" className={`hi-btn hi-btn--yes tactile ${FOCUS_RING}`} onClick={() => commit({ points: target.worth ?? 0, bom: false })}>
                Klarte det
                <small>+{target.worth} poeng</small>
              </button>
              <button type="button" className={`hi-btn hi-btn--no tactile ${FOCUS_RING}`} onClick={() => commit({ points: 0, bom: true })}>
                Bom
                <small>poengene halveres</small>
              </button>
            </div>
          ) : target.input === "bull" ? (
            <div className="hi-btns hi-btns--bull">
              {BULL_VALUES.map((v) => (
                <button key={v} type="button" className={`hi-btn hi-btn--yes tactile ${FOCUS_RING}`} onClick={() => commit({ points: v, bom: false })}>
                  {v}
                  <small>{v === 50 ? "innerste" : "ytre"}</small>
                </button>
              ))}
              <button type="button" className={`hi-btn hi-btn--no tactile ${FOCUS_RING}`} style={{ gridColumn: "1 / -1" }} onClick={() => commit({ points: 0, bom: true })}>
                Bom
                <small>poengene halveres</small>
              </button>
            </div>
          ) : (
            <>
              <button type="button" className={`hi-bom tactile ${FOCUS_RING}`} onClick={() => commit({ points: 0, bom: true })}>
                BOM · halverer
              </button>
              <div className="cd-pad">
                <ScoreKeypad
                  key={`${round}-${game.entries.length}`}
                  fill
                  manual
                  onSubmit={(n) => commit(entryForSum(target, n))}
                  onUndo={undo}
                  canUndo={game.entries.length > 0}
                  invalid={(typed) => !possibleSum(target, Number(typed))}
                  tone={(typed) => {
                    if (typed === "") return undefined;
                    const n = Number(typed);
                    return !possibleSum(target, n) || (target.min !== undefined && n < target.min) ? "bust" : undefined;
                  }}
                  line={(typed) => {
                    if (typed === "") return null;
                    const n = Number(typed);
                    // The colour says it; the words are for a screen reader.
                    return <span className="sr-only">{!possibleSum(target, n) ? `${n} kan ikke stemme i denne runden` : target.min !== undefined && n < target.min ? `${n} er for lite, det er en bom` : `${n} poeng`}</span>;
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
