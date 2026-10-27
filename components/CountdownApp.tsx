"use client";

import { useEffect, useMemo, useState } from "react";
import { callOut } from "@/lib/announcer";
import type { BotLevel } from "@/lib/botLevels";
import { botCountdownRound, type BotRound } from "@/lib/botDarts";
import { botDelayMs } from "@/lib/botSpeed";
import { undoThroughBots } from "@/lib/botTurns";
import { checkoutsOf } from "@/lib/checkout";
import { generateConfettiRain } from "@/lib/confetti";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { countdownResult } from "@/lib/gameResults";
import { useRecordResult } from "@/lib/gameResultsStorage";
import { TIER_LABEL, tierOf } from "@/lib/roundTier";
import {
  DARTS_PER_ROUND,
  averageOf,
  bestRoundOf,
  dartsOf,
  judge,
  lastRoundOf,
  leaderOf,
  newGame,
  playRound,
  playerUp,
  remainingOf,
  roundsOf,
  tonsOf,
  winnerOf,
  type CountdownGame,
  type CountdownStart,
} from "@/lib/countdown";
import { haptics } from "@/lib/haptics";
import { splitPeople, type Person } from "@/lib/people";
import { individualSetupProblem, setupSummary } from "@/lib/setupProblem";
import { useRoster } from "@/lib/storage";
import { CheckoutChips, checkoutLabel } from "./CheckoutChips";
import { useBotTurn } from "./useBotTurn";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlayerPicker } from "./PlayerPicker";
import { RollingNumber } from "./RollingNumber";
import { ScoreKeypad } from "./ScoreKeypad";
import { ScreenTop } from "./ScreenTop";
import { commitPeople } from "./SetupScreen";
import { StickyAction } from "./StickyAction";
import { VoiceSwitch } from "./VoiceSwitch";
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
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));

  if (!game) {
    const problem = (people.length > 0 && people.every((p) => p.isBot) ? "Velg minst én spiller" : individualSetupProblem(people.map((p) => p.name), false)) || null;
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="301 / 501" onBack={onExitToHome} />
          <p className="section-label mb-2">START FRA</p>
          <div className="mb-4">
            <Segmented value={String(start) as "301" | "501"} onChange={(v) => setStart(Number(v) as CountdownStart)} label="Start fra" options={[{ value: "501", label: "501" }, { value: "301", label: "301" }]} />
          </div>
          <PlayerPicker people={people} onChange={setPeople} guests />
          <div className="mt-4">
            <SwitchRow label="Dobbel ut" hint="Står det 1 igjen, er runden over streken" checked={doubleOut} onChange={setDoubleOut} />
          </div>
          <StickyAction
            onClick={() => {
              commitPeople(people);
              const split = splitPeople(people);
              setBotLevels(split.botLevels);
              setGame(newGame(start, doubleOut, split.players));
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

  return <CountdownGameScreen game={game} setGame={setGame} botLevels={botLevels} photos={photos} onHome={onExitToHome} onNew={() => setGame(null)} />;
}

function CountdownGameScreen({
  game,
  setGame,
  botLevels,
  photos,
  onHome,
  onNew,
}: {
  game: CountdownGame;
  setGame: (g: CountdownGame) => void;
  botLevels: Record<string, BotLevel>;
  photos: Map<string, string | null | undefined>;
  onHome: () => void;
  onNew: () => void;
}) {
  const [finishing, setFinishing] = useState<number | null>(null);
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
  const leader = leaderOf(game);
  const isBot = (p: string) => botLevels[p] !== undefined;
  const botUp = !winner && isBot(up);
  useRecordResult(winner, game.turns.length === 0, (id, at) => countdownResult(game, Object.keys(botLevels), id, at));
  const rain = useMemo(() => (winner && fx.confetti ? generateConfettiRain(fx.bigConfetti ? 60 : 36) : []), [winner, fx.confetti, fx.bigConfetti]);

  useEffect(() => {
    if (winner && fx.confetti) playFanfare();
  }, [winner, fx.confetti]);

  // The 180 is on the screen for a moment and goes by itself.
  useEffect(() => {
    if (slam === null) return;
    const t = setTimeout(() => setSlam(null), 1800);
    return () => clearTimeout(t);
  }, [slam]);

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
    setBotNote("");
    setNotice(verdict === "bust" ? `${up}: over streken, runden teller ikke` : "");
    setFresh({ n: game.turns.length + 1, player: up, scored, bust: verdict === "bust" });
    if (verdict === "counts" && tierOf(scored) === "max" && fx.heat) {
      setSlam(game.turns.length + 1);
      if (fx.ringSlam) playFanfare();
    }
    setGame(playRound(game, scored));
  }

  /** A bot's round: its darts are shown, the number is said as for anyone else, and it goes in with the darts it took. */
  function playBot(r: BotRound) {
    const darts = r.labels.join(" · ");
    callOut(r.bust ? "Over" : String(r.scored));
    haptics.confirm();
    setNotice("");
    setBotNote(r.bust ? `${up}: ${darts}, over streken` : r.finished ? `${up}: ${darts}, tar ut!` : `${up}: ${darts} = ${r.scored}`);
    setFresh({ n: game.turns.length + 1, player: up, scored: r.scored, bust: r.bust });
    if (!r.bust && tierOf(r.scored) === "max" && fx.heat) {
      setSlam(game.turns.length + 1);
      if (fx.ringSlam) playFanfare();
    }
    setGame(playRound(game, r.scored, r.darts));
  }

  // A bot throws its round after a pause that follows the bot speed in Innstillinger.
  useBotTurn(botUp && finishing === null, game.turns.length, () => botDelayMs() * 2 + 300, () => playBot(botCountdownRound(left, game.doubleOut, botLevels[up])));

  function undo() {
    haptics.undo();
    setNotice("");
    setBotNote("");
    setFresh(null);
    setSlam(null);
    setGame(undoThroughBots(game, isBot));
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
          <div className="flex flex-col items-center text-center mb-4 mt-6">
            <Avatar name={winner} photo={photos.get(winner)} px={112} state="winner" />
            <p className="section-label mt-4">{game.start} · VINNER</p>
            <h1 className="font-display" style={{ color: "var(--color-gold)", fontSize: "clamp(2.2rem, 11vw, 3.2rem)", lineHeight: 1.05 }}>
              {winner}
            </h1>
            <p className="mt-1 inline-block rounded-full px-3 py-1 font-bold" style={{ background: "var(--gold-soft)", color: "var(--color-gold-strong)", fontSize: "var(--text-small)", letterSpacing: "0.1em" }}>
              UT PÅ {finalTurn.scored} · {finalTurn.darts} {finalTurn.darts === 1 ? "PIL" : "PILER"}
            </p>
            <p className="mt-2" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
              {darts} piler totalt · snitt {oneDecimal(averageOf(game, winner) ?? 0)}
            </p>
          </div>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full mb-3" style={{ height: "2.5rem" }} role="img" aria-label={`Rundene til ${winner}: ${rounds.join(", ")}`}>
            <polyline points={points} fill="none" stroke="var(--color-teal)" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="grid grid-cols-3 gap-2 mb-5 text-center">
            {[
              [oneDecimal(averageOf(game, winner) ?? 0), "Snitt"],
              [String(bestRoundOf(game, winner)), "Høyeste"],
              [String(tonsOf(game, winner)), "100+"],
            ].map(([v, l]) => (
              <div key={l} style={{ padding: "0.5rem 0.25rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <span className="num block" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                  {v}
                </span>
                <span style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>{l}</span>
              </div>
            ))}
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
      {slam !== null && (
        <div key={slam} className="round-slam" aria-hidden>
          <div className="rays" />
          <span className="num">180</span>
          <span className="cap">ONE HUNDRED AND EIGHTY</span>
        </div>
      )}
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
        <p key={`${up}-${game.turns.length}`} className="turn-banner" aria-hidden>
          {up} kaster
        </p>
        <ul className="space-y-3 mb-4" aria-label="Stilling">
          {game.players.map((p) => {
            const active = p === up;
            const avg = averageOf(game, p);
            const last = lastRoundOf(game, p);
            const mine = fresh?.player === p ? fresh : null;
            const tier = last && !last.bust ? tierOf(last.scored) : "none";
            const togo = remainingOf(game, p);
            const pct = Math.max(0, Math.min(100, (togo / game.start) * 100));
            const hot = active && way !== null;
            return (
              <li
                key={p}
                aria-current={active ? "true" : undefined}
                className={`relative flex items-center gap-3 ${active ? "turn-lift" : ""} ${hot ? "cd-hot" : ""}`}
                style={{
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--radius-m)",
                  background: active ? "color-mix(in srgb, var(--color-teal) 12%, var(--color-surface))" : "var(--color-surface)",
                  border: active ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
                  boxShadow: "var(--elevation-1)",
                  "--heat": way ? 4 - way.length : 0,
                } as React.CSSProperties}
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
                <Avatar name={p} photo={photos.get(p)} size="m" state={active ? "active" : "idle"} bot={isBot(p)} />
                <div className="flex-1 min-w-0">
                  <p className="font-display truncate" style={{ fontSize: "var(--text-title)", lineHeight: 1.1 }}>
                    {p}
                  </p>
                  {hot && way && (
                    <div className="my-0.5">
                      <p className="out-label">{checkoutLabel(way.length)}</p>
                      <CheckoutChips way={way} />
                    </div>
                  )}
                  <p className="truncate" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                    {avg !== null ? `Snitt ${oneDecimal(avg)}` : "Ikke kastet"}
                    {last ? ` · siste ${last.bust ? "over" : last.scored}` : ""}
                    {tier !== "none" && <span className={`tier-chip tier-chip--${tier}`}>{TIER_LABEL[tier]}</span>}
                  </p>
                  <div className={`drain-bar ${togo < 170 ? "drain-bar--warm" : ""}`} aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {mine?.bust ? (
                  <span key={mine.n} className="num bust-shake" style={{ fontSize: "2.5rem" }}>
                    {togo}
                  </span>
                ) : (
                  <RollingNumber value={togo} className="num" style={{ fontSize: "2.5rem", color: active ? "var(--color-cream)" : "var(--color-text-2)" }} />
                )}
              </li>
            );
          })}
        </ul>

        <div inert={botUp} style={{ opacity: botUp ? 0.45 : 1, transition: "opacity var(--pull)" }}>
        <ScoreKeypad
          onSubmit={submit}
          onUndo={undo}
          canUndo={game.turns.length > 0}
          line={(typed) => {
            if (botUp) return <span style={{ color: "var(--color-muted)" }}>{up} kaster …</span>;
            if (typed === "" && botNote && !notice) return <span style={{ color: "var(--color-text-2)" }}>{botNote}</span>;
            if (typed === "") return <span style={{ color: notice ? "var(--color-red)" : "var(--color-muted)" }}>{notice || `${up} kaster · skriv hva runden ble`}</span>;
            const n = Number(typed);
            const verdict = judge(left, n, game.doubleOut);
            if (verdict === "bust") return <span style={{ color: "var(--color-red)", fontWeight: 600 }}>{n} er over streken</span>;
            if (verdict === "finish") return <span style={{ color: "var(--color-green)", fontWeight: 600 }}>{n} tar ut!</span>;
            return (
              <span style={{ color: "var(--color-teal-strong)", fontWeight: 600 }}>
                {up} har {left - n} igjen etter {n}
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
