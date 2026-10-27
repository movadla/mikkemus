"use client";

import { useEffect, useMemo, useState } from "react";
import { generateConfettiRain } from "@/lib/confetti";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
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
import { splitPeople, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { uiSound } from "@/lib/uiSound";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hearts } from "./Hearts";
import { MinusIcon, PlusIcon } from "./icons";
import { LavaBoard } from "./LavaBoard";
import { PlayerPicker } from "./PlayerPicker";
import { ScreenTop } from "./ScreenTop";
import { commitPeople } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { SwitchRow } from "./ui/Switch";

/** What the last dart did, in words: said under the board, and read out by the screen reader. */
function describe(d: LavaDart): string {
  if (d.section === MISS) return `${d.player}: bom`;
  if (d.outcome === "burn") return `${d.player}: ${sectionLabel(d.section)} er brent`;
  return d.knockedOut ? `${d.player}: ${sectionLabel(d.section)} er lava, og det var siste liv` : `${d.player}: ${sectionLabel(d.section)} er lava, mister et liv`;
}

/**
 * Lava: one board, and every section is safe until someone hits it. Then all of it is lava (double, treble and both singles) and a dart
 * in it costs a life. Three darts a round, the sections are touched on the board as the darts land, and the last one with a life wins.
 */
export function LavaApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [lives, setLives] = useState(DEFAULT_LIVES);
  const [game, setGame] = useState<LavaGame | null>(null);
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));

  if (!game) {
    const problem = individualSetupProblem(people.map((p) => p.name), false, 2);
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Lava" onBack={onExitToHome} />
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            Treffer du et felt, blir det lava for alle: dobbel, trippel og begge enkeltfeltene. Treffer noen lava, mister de et liv.
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

  return <LavaGameScreen game={game} setGame={setGame} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />;
}

function LavaGameScreen({
  game,
  setGame,
  photos,
  onHome,
  onNew,
}: {
  game: LavaGame;
  setGame: (g: LavaGame) => void;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  /** The dart just thrown, while its effect plays: set when a dart goes in, cleared when one is taken back. */
  const [fresh, setFresh] = useState<{ n: number; dart: LavaDart } | null>(null);
  const fx = fxFlags(useFxLevel());
  const state = useMemo(() => stateOf(game), [game]);
  const { winner, up } = state;
  const big = fx.heat;
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  useEffect(() => {
    if (winner && fx.confetti) playFanfare();
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

  function undo() {
    haptics.undo();
    setFresh(null);
    setGame(undoDart(game));
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
                <Avatar name={p} photo={photos.get(p)} size="m" state={p === winner ? "winner" : "idle"} />
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
          <div className="space-y-2">
            <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.lives, game.players))}>
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

  const last = state.log.at(-1);
  const lostNow = fresh?.dart.outcome === "lava" ? fresh.dart.player : null;
  const message = fresh ? describe(fresh.dart) : `${up} kaster`;
  const roundDarts = [...state.round];

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
        <ScreenTop title="Lava" onBack={() => setConfirmExit(true)} backLabel="Avslutt kampen" />
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
                <Avatar name={p} photo={photos.get(p)} size="m" state={active ? "active" : "idle"} />
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

        <LavaBoard burned={state.burned} effect={fresh?.dart ?? null} effectKey={fresh?.n ?? 0} darts={roundDarts} onPick={pick} big={big} />

        <div role="status" aria-live="polite" className="text-center mt-3 mb-2" style={{ minHeight: "1.5rem", fontSize: "var(--text-body)", fontWeight: 600, color: fresh?.dart.outcome === "lava" ? "var(--color-red)" : "var(--color-cream)" }}>
          {message}
        </div>
        <p className="text-center mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
          {up} · pil {Math.min(state.thrown + 1, DARTS_PER_ROUND)} av {DARTS_PER_ROUND} · {safeLeft(state)} felt er trygge
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button block size="lg" onClick={() => pick(MISS)}>
            Bom
          </Button>
          <Button block size="lg" onClick={undo} disabled={!last}>
            Angre
          </Button>
        </div>
      </div>
    </div>
  );
}
