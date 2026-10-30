"use client";

import { useMemo, useState } from "react";
import { callOut } from "@/lib/announcer";
import { generateConfettiRain } from "@/lib/confetti";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { killerResult } from "@/lib/gameResults";
import { useGameVenue } from "@/lib/gameVenue";
import { useRecordResult } from "@/lib/gameResultsStorage";
import { killerNight } from "@/lib/nightGames";
import { useRecordNight } from "@/lib/nightScoreStorage";
import { haptics } from "@/lib/haptics";
import { MISS, type LavaDart } from "@/lib/lava";
import {
  DEFAULT_LIVES,
  HITS_TO_KILLER,
  MAX_LIVES,
  MIN_LIVES,
  hitLabel,
  isOut,
  livesLeft,
  newGame,
  playDart,
  stateOf,
  sunkSections,
  undoDart,
  type KillerDart,
  type KillerGame,
} from "@/lib/killer";
import { splitPeople, type PickedTeam, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary, teamSetupProblem } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { rostersOf } from "@/lib/teamGame";
import { uiSound } from "@/lib/uiSound";
import { ConfirmDialog } from "./ConfirmDialog";
import { GameVenue, VenueSection } from "./GameVenue";
import { GameWho, type GameMode } from "./GameWho";
import { Hearts } from "./Hearts";
import { MinusIcon, PlusIcon, UndoIcon } from "./icons";
import { LavaBoard } from "./LavaBoard";
import { ScreenTop } from "./ScreenTop";
import { commitPeople, commitTeams } from "./SetupScreen";
import { SideAvatar } from "./SideAvatar";
import { StickyAction } from "./StickyAction";
import { VoiceToggle } from "./VoiceSwitch";
import { Button } from "./ui/Button";
import { CountUp } from "./ui/CountUp";
import { FOCUS_RING } from "./ui/focus";
import { SwitchRow } from "./ui/Switch";

/** What a dart did, in words: said under the board, and read out by the screen reader. */
function describe(d: KillerDart): string {
  const who = d.by ?? d.player;
  switch (d.effect) {
    case "claim":
      return `${who} fikk ${d.number}`;
    case "taken":
      return `${d.number} er tatt. ${who} kaster på nytt`;
    case "again":
      return `${who} kaster på nytt`;
    case "progress":
      return `${who}: treff på eget tall`;
    case "killer":
      return `${who} er killer!`;
    case "self":
      return `${who} traff sitt eget tall og mistet et liv`;
    case "heal":
      return `${who} fikk tilbake liv`;
    case "selfout":
      return `${who} traff sitt eget tall og er ute`;
    case "hit":
      return `${who} traff ${d.victim}: ${d.livesLost === 1 ? "ett liv" : `${d.livesLost} liv`} tapt`;
    case "kill":
      return `${d.victim} er ute!`;
    case "nothing":
      return `${who}: ${hitLabel(d.section)}, ingen effekt`;
    default:
      return `${who}: bom`;
  }
}

/** The dart as the board draws it: a hit that took a life is lava, one that got a number or a hit on the own number a fire, the rest nothing. */
function asLavaDart(d: KillerDart): LavaDart {
  const outcome = d.effect === "hit" || d.effect === "kill" || d.effect === "self" || d.effect === "selfout" ? "lava" : d.effect === "claim" || d.effect === "progress" || d.effect === "killer" || d.effect === "heal" ? "burn" : "miss";
  return { player: d.player, section: d.number === 0 ? MISS : d.section, outcome, knockedOut: d.effect === "kill" || d.effect === "selfout", nth: d.nth };
}

/**
 * Killer: a dart each for a number of your own, three hits on it to become a killer, and then the killers take lives from the others by hitting their
 * numbers. The last one with a life wins. The board is the keypad (single, double and treble each their own part), as in Lava; alone or as teams.
 */
export function KillerApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [mode, setMode] = useState<GameMode>("individual");
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [lives, setLives] = useState(DEFAULT_LIVES);
  const [game, setGame] = useState<KillerGame | null>(null);
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  const [venue, setVenue] = useGameVenue("killer");

  if (!game) {
    const problem = (mode === "team" ? teamSetupProblem(teams, false, 2) : individualSetupProblem(people.map((p) => p.name), false, 2)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Killer" onBack={onExitToHome} />
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Alle kaster en pil og får et tall. Tre treff på ditt eget gjør deg til killer, og en killer tar liv fra de andre ved å treffe tallene deres.
          </p>
          <GameWho mode={mode} onMode={setMode} people={people} onPeople={setPeople} teams={teams} onTeams={setTeams} botsAllowed={false} />
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
                commitTeams(teams);
                setGame(newGame(lives, teams.map((t) => t.name), rostersOf(teams)));
                return;
              }
              commitPeople(people);
              setGame(newGame(lives, splitPeople(people).players));
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
      <KillerGameScreen game={game} setGame={setGame} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />
    </GameVenue>
  );
}

export function KillerGameScreen({ game, setGame, photos, onHome, onNew }: { game: KillerGame; setGame: (g: KillerGame) => void; photos: Map<string, string | null | undefined>; onHome: () => void; onNew: () => void }) {
  const [confirmExit, setConfirmExit] = useState(false);
  /** The dart just thrown, while its effect plays: set when a dart goes in, cleared when one is taken back. */
  const [fresh, setFresh] = useState<{ n: number; dart: KillerDart } | null>(null);
  const fx = fxFlags(useFxLevel());
  const state = useMemo(() => stateOf(game), [game]);
  const { winner, up, member, phase } = state;
  const who = member?.name ?? up;
  const sunk = useMemo(() => new Map([...sunkSections(state, game)].map((s) => [s, ""])), [state, game]);
  useRecordNight(winner, game.darts.length === 0, (id) => (winner ? killerNight(game, winner, id) : null));
  useRecordResult(game.rosters ? null : winner, game.darts.length === 0, (id, at) => killerResult(game, id, at));
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  function pick(section: number) {
    const next = playDart(game, section);
    if (next === game) return;
    const dart = stateOf(next).log.at(-1)!;
    if (dart.effect === "kill" || dart.effect === "selfout") {
      haptics.undo();
      uiSound("undo");
      callOut(`${dart.effect === "kill" ? dart.victim : dart.player} er ute`);
    } else if (dart.effect === "hit" || dart.effect === "self") {
      haptics.undo();
      uiSound("undo");
    } else if (dart.effect === "killer") {
      haptics.confirm();
      uiSound("confirm");
      callOut(`${dart.by ?? dart.player} er killer`);
    } else if (dart.effect === "claim" || dart.effect === "progress") {
      haptics.confirm();
      uiSound("confirm");
    } else {
      uiSound("click");
    }
    setFresh({ n: next.darts.length, dart });
    setGame(next);
  }

  function undo() {
    haptics.undo();
    setFresh(null);
    setGame(undoDart(game));
  }

  if (winner) {
    const order = [...game.players].sort((a, b) => Number(b === winner) - Number(a === winner) || state.lives[b] - state.lives[a] || state.kills[b] - state.kills[a]);
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
              Vinner · Killer
            </p>
            <h1 className="font-display" style={{ color: "var(--color-bg)", fontSize: "clamp(2.2rem, 11vw, 3rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p className="mt-1">
              <Hearts total={game.lives} left={livesLeft(state, winner)} fresh={false} />
            </p>
            <dl className="winner-figures grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "DREPTE", value: state.kills[winner] },
                { label: "LIV IGJEN", value: livesLeft(state, winner) },
                { label: "RUNDER", value: state.rounds[winner] },
              ].map((f) => (
                <div key={f.label} className="winner-figure rounded-xl py-1.5">
                  <dd className="font-display" style={{ color: "var(--color-bg)", fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    <CountUp value={f.value} format={(n) => String(n)} ms={1000} />
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
                    {state.kills[p]}
                  </span>
                  drepte
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.lives, game.players, game.rosters))}>
              Spill igjen
            </Button>
            <Button block onClick={undo}>
              Angre siste pil
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

  const message = fresh ? describe(fresh.dart) : phase === "claim" ? `${who} kaster én pil for å få et tall` : `${who} kaster`;
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
        <ScreenTop
          title="Killer"
          onBack={() => setConfirmExit(true)}
          backLabel="Avslutt kampen"
          right={
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                aria-label="Angre siste pil"
                onClick={undo}
                disabled={game.darts.length === 0}
                className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`}
                style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: game.darts.length === 0 ? 0.4 : 1 }}
              >
                <UndoIcon className="w-5 h-5" />
              </button>
              <VoiceToggle />
            </span>
          }
        />
        <ul className="kl-grid mb-3" aria-label="Stilling">
          {game.players.map((p) => {
            const active = p === up;
            const out = isOut(state, p);
            const number = state.numbers[p];
            const isKiller = state.killer[p];
            const hurt = fresh && (fresh.dart.victim === p || (fresh.dart.player === p && (fresh.dart.effect === "self" || fresh.dart.effect === "selfout")));
            return (
              <li key={p} aria-current={active ? "true" : undefined} className={`kl-card ${active && !out ? "kl-card--up turn-lift" : ""} ${out ? "kl-card--out" : ""} ${hurt ? "hs-hit" : ""}`}>
                <div className="kl-top">
                  <SideAvatar name={p} roster={game.rosters?.[p]} photo={photos.get(p)} px={40} state={active ? "active" : "idle"} />
                  <p className="font-display truncate" style={{ fontSize: "var(--text-body)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                </div>
                <span className={`kl-num ${isKiller && !out ? "kl-num--killer" : ""}`} aria-label={number === null ? "Ikke fått tall" : `Tall ${number}`}>
                  {number ?? "?"}
                </span>
                <p className="kl-status">
                  {out ? "UTE" : phase === "claim" ? (number === null ? "venter" : "har tall") : isKiller ? "KILLER" : state.regain[p] || livesLeft(state, p) < game.lives ? "treff deg selv for liv" : `${state.hits[p]} av ${HITS_TO_KILLER} til killer`}
                </p>
                {!out && phase === "play" && <Hearts total={game.lives} left={livesLeft(state, p)} fresh={false} size="w-4 h-4" />}
                {game.rosters?.[p] && active && !out && <p className="cd-recent"><span>Nå: {who}</span></p>}
              </li>
            );
          })}
        </ul>

        <LavaBoard burned={sunk} effect={fresh ? asLavaDart(fresh.dart) : null} effectKey={fresh?.n ?? 0} darts={state.round.map(asLavaDart)} onPick={pick} big={fx.heat} rings />

        <div role="status" aria-live="polite" className="text-center mt-3 mb-2" style={{ minHeight: "1.5rem", fontSize: "var(--text-body)", fontWeight: 600, color: fresh && (fresh.dart.effect === "kill" || fresh.dart.effect === "hit" || fresh.dart.effect === "self" || fresh.dart.effect === "selfout") ? "var(--color-red)" : "var(--color-cream)" }}>
          {message}
        </div>
        <Button block size="lg" onClick={() => pick(MISS)}>
          Bom
        </Button>
      </div>
    </div>
  );
}
