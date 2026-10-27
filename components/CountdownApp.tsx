"use client";

import { useState } from "react";
import { callOut, isCallerEnabled, setCallerEnabled } from "@/lib/announcer";
import { checkoutLine } from "@/lib/checkout";
import {
  DARTS_PER_ROUND,
  averageOf,
  dartsOf,
  judge,
  lastRoundOf,
  newGame,
  playRound,
  playerUp,
  remainingOf,
  undoRound,
  winnerOf,
  type CountdownGame,
  type CountdownStart,
} from "@/lib/countdown";
import { haptics } from "@/lib/haptics";
import { splitPeople, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlayerPicker } from "./PlayerPicker";
import { ScoreKeypad } from "./ScoreKeypad";
import { ScreenTop } from "./ScreenTop";
import { commitPeople } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { Avatar } from "./ui/Avatar";
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
  const [start, setStart] = useState<CountdownStart>(501);
  const [doubleOut, setDoubleOut] = useState(true);
  const [game, setGame] = useState<CountdownGame | null>(null);
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));

  if (!game) {
    const problem = individualSetupProblem(people.map((p) => p.name), false);
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="301 / 501" onBack={onExitToHome} />
          <p className="section-label mb-2">START FRA</p>
          <div className="mb-4">
            <Segmented value={String(start) as "301" | "501"} onChange={(v) => setStart(Number(v) as CountdownStart)} label="Start fra" options={[{ value: "501", label: "501" }, { value: "301", label: "301" }]} />
          </div>
          <PlayerPicker people={people} onChange={setPeople} botsAllowed={false} guests />
          <div className="mt-4">
            <SwitchRow label="Dobbel ut" hint="Står det 1 igjen, er runden over streken" checked={doubleOut} onChange={setDoubleOut} />
          </div>
          <StickyAction
            onClick={() => {
              commitPeople(people);
              setGame(newGame(start, doubleOut, splitPeople(people).players));
            }}
            ready={!problem}
            summary={setupSummary([`${people.length} ${people.length === 1 ? "spiller" : "spillere"}`, String(start)])}
            reason={problem}
          >
            Start kampen
          </StickyAction>
        </div>
      </div>
    );
  }

  return <CountdownGameScreen game={game} setGame={setGame} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />;
}

function CountdownGameScreen({
  game,
  setGame,
  photos,
  onHome,
  onNew,
}: {
  game: CountdownGame;
  setGame: (g: CountdownGame) => void;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
}) {
  const [finishing, setFinishing] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const winner = winnerOf(game);
  const up = playerUp(game);
  const left = remainingOf(game, up);
  const way = checkoutLine(left, game.doubleOut);
  const [voice, setVoice] = useState(isCallerEnabled);

  /** The round is written in: over the line it counts for nothing, a finish asks how many darts it took, anything else goes on. */
  function submit(scored: number) {
    const verdict = judge(left, scored, game.doubleOut);
    // The number is said at once, so the round can be heard to have gone in right; over the line it is said as such.
    callOut(verdict === "bust" ? "Over" : String(scored));
    if (verdict === "finish") {
      setFinishing(scored);
      return;
    }
    haptics.confirm();
    setNotice(verdict === "bust" ? `${up}: over streken, runden teller ikke` : "");
    setGame(playRound(game, scored));
  }

  function undo() {
    haptics.undo();
    setNotice("");
    setGame(undoRound(game));
  }

  const key = `tactile flex items-center justify-center font-display ${FOCUS_RING}`;
  const keyStyle = { minHeight: "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-num)", boxShadow: "var(--elevation-1)" } as const;

  if (winner) {
    const darts = dartsOf(game, winner);
    return (
      <div className="animate-screen-enter screen cup-lamp" style={{ "--cup": "var(--color-gold)" } as React.CSSProperties}>
        <div className="screen-inner">
          <div className="flex flex-col items-center text-center mb-6 mt-6">
            <Avatar name={winner} photo={photos.get(winner)} px={112} state="winner" />
            <p className="section-label mt-4">{game.start} · VINNER</p>
            <h1 className="font-display" style={{ color: "var(--color-gold)", fontSize: "clamp(2.2rem, 11vw, 3.2rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
              på {darts} piler · snitt {oneDecimal(averageOf(game, winner) ?? 0)}
            </p>
          </div>
          <ul className="space-y-2 mb-6" aria-label="Resultat">
            {game.players.map((p) => (
              <li key={p} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}>
                <Avatar name={p} photo={photos.get(p)} size="m" state={p === winner ? "winner" : "idle"} />
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
          <div className="space-y-2">
            <Button block variant="primary" size="lg" onClick={() => setGame(newGame(game.start, game.doubleOut, game.players))}>
              Spill igjen
            </Button>
            <Button block onClick={undo}>
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
                  setGame(playRound(game, finishing, n));
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
      <div className="screen-inner">
        <ScreenTop title={String(game.start)} onBack={() => setConfirmExit(true)} backLabel="Avslutt kampen" />
        <ul className="space-y-2 mb-4" aria-label="Stilling">
          {game.players.map((p) => {
            const active = p === up;
            const avg = averageOf(game, p);
            const last = lastRoundOf(game, p);
            return (
              <li
                key={p}
                aria-current={active ? "true" : undefined}
                className="flex items-center gap-3"
                style={{
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--radius-m)",
                  background: active ? "color-mix(in srgb, var(--color-teal) 12%, var(--color-surface))" : "var(--color-surface)",
                  border: active ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
                  boxShadow: "var(--elevation-1)",
                }}
              >
                <Avatar name={p} photo={photos.get(p)} size="m" state={active ? "active" : "idle"} />
                <div className="flex-1 min-w-0">
                  <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                  {active && way && (
                    <p className="truncate font-semibold" style={{ color: "var(--color-teal)", fontSize: "var(--text-small)" }}>
                      Ut: {way}
                    </p>
                  )}
                  <p className="truncate" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                    {avg !== null ? `Snitt ${oneDecimal(avg)}` : "Ikke kastet"}
                    {last ? ` · siste ${last.bust ? "over" : last.scored}` : ""}
                  </p>
                </div>
                <span className="num" style={{ fontSize: "2.5rem", color: active ? "var(--color-cream)" : "var(--color-text-2)" }}>
                  {remainingOf(game, p)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mb-3">
          <SwitchRow
            label="Stemme"
            hint="Sier tallet høyt etter hver runde"
            checked={voice}
            onChange={(on) => {
              setVoice(on);
              setCallerEnabled(on);
            }}
          />
        </div>
        <ScoreKeypad
          onSubmit={submit}
          onUndo={undo}
          canUndo={game.turns.length > 0}
          line={() => (
            <span style={{ color: notice ? "var(--color-red)" : "var(--color-muted)" }}>{notice || `${up} kaster · skriv hva runden ble`}</span>
          )}
        />
      </div>
    </div>
  );
}
