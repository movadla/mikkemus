"use client";

import { useEffect, useMemo, useState } from "react";
import { cupColor } from "@/lib/botCup";
import { TIERS, closeChallenge, declineChallenge, dollars, settleChallenge, type ActiveEvent, type Career, type Challenge } from "@/lib/career";
import { rankOf } from "@/lib/careerGoals";
import { winnerOf as countdownWinner, newGame as newCountdown } from "@/lib/countdown";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { haptics } from "@/lib/haptics";
import { winnerOf as highstrikerWinner, newGame as newHighstriker } from "@/lib/highstriker";
import { DEFAULT_LIVES, newGame as newLava, stateOf as lavaState } from "@/lib/lava";
import { teamKitsOf, useRoster } from "@/lib/storage";
import { DRILL_ROUNDS, sessionFrom, trainCareer } from "@/lib/training";
import { careerSound } from "@/lib/uiSound";
import { levelLabel, oneDecimal } from "./careerFormat";
import { CoinBurst } from "./CoinBurst";
import { CountdownGameScreen } from "./CountdownApp";
import { HighstrikerGameScreen } from "./HighstrikerApp";
import { ArrowLeftIcon, CoinIcon } from "./icons";
import { LavaGameScreen } from "./LavaApp";
import { PlayButton } from "./PlayButton";
import { ScoreKeypad } from "./ScoreKeypad";
import { TeamKit } from "./TeamKit";
import { Trophy } from "./Trophy";
import { Avatar } from "./ui/Avatar";
import { CountUp } from "./ui/CountUp";
import { FOCUS_RING } from "./ui/focus";

/** A round back arrow, the same on every screen of the career. */
function BackArrow({ onClick, label = "Tilbake" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`tactile inline-flex items-center justify-center shrink-0 ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
      <ArrowLeftIcon className="w-5 h-5" />
    </button>
  );
}

/** The amount in gold, in a pill with a coin. */
function Amount({ value, big = false }: { value: number; big?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 tabular" style={{ padding: big ? "0.5rem 1.2rem" : "0.35rem 0.9rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 800, fontSize: big ? "var(--text-num)" : "var(--text-title)" }}>
      <CoinIcon className={big ? "w-7 h-7" : "w-5 h-5"} />
      {dollars(value)}
    </span>
  );
}

/** A challenge: the two of them and the stake, then the game itself, then what it came to. */
export function ChallengePlay({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const c = career.challenge!;
  const roster = useRoster();
  const photos = useMemo(() => new Map(roster.map((r) => [r.name, r.photo])), [roster]);
  const [playing, setPlaying] = useState(false);
  const players = [career.player, c.opponent.name];
  const botLevels = { [c.opponent.name]: c.opponent.skill };
  const [cd, setCd] = useState(() => newCountdown(501, true, players));
  const [lava, setLava] = useState(() => newLava(DEFAULT_LIVES, players));
  const [hs, setHs] = useState(() => newHighstriker(DEFAULT_LIVES, players));
  const settle = (winner: string | null) => commit(settleChallenge(career, winner === career.player, new Date().toISOString()));
  const giveUp = () => {
    commit(declineChallenge(career));
    onHub();
  };
  if (c.won !== null) {
    return (
      <ChallengeResult
        career={career}
        c={c}
        onDone={() => {
          commit(closeChallenge(career));
          onHub();
        }}
      />
    );
  }
  if (!playing) {
    return (
      <div className="animate-screen-enter screen career-skin">
        <div className="screen-inner flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
          <div className="flex items-center gap-3">
            <BackArrow onClick={giveUp} label="Si nei" />
            <h1 className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1 }}>
              {c.game === "501" ? "501" : c.game === "lava" ? "Lava" : "Highstriker"}
            </h1>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="flex items-start justify-center gap-3 w-full text-center">
              <div className="final-left" style={{ flex: "1 1 0", minWidth: 0 }}>
                <Avatar name={career.player} photo={photos.get(career.player)} size="xl" state="active" />
                <p className="font-display truncate mt-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                  {career.player}
                </p>
              </div>
              <span className="final-vs font-display" style={{ color: "var(--color-gold)", fontSize: "var(--text-title)", paddingTop: "2.2rem" }} aria-hidden>
                VS
              </span>
              <div className="final-right" style={{ flex: "1 1 0", minWidth: 0 }}>
                <Avatar name={c.opponent.name} size="xl" bot />
                <p className="font-display truncate mt-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                  {c.opponent.name}
                </p>
              </div>
            </div>
            <Amount value={c.stake} big />
          </div>
          <PlayButton label="SPILL" onClick={() => setPlaying(true)} />
        </div>
      </div>
    );
  }
  if (c.game === "501") {
    return <CountdownGameScreen game={cd} setGame={setCd} botLevels={botLevels} photos={photos} onHome={giveUp} onNew={() => undefined} career={{ onDone: () => settle(countdownWinner(cd)), giveUp: true }} />;
  }
  if (c.game === "lava") {
    return <LavaGameScreen game={lava} setGame={setLava} botLevels={botLevels} photos={photos} onHome={giveUp} onNew={() => undefined} career={{ onDone: () => settle(lavaState(lava).winner) }} />;
  }
  return <HighstrikerGameScreen game={hs} setGame={setHs} botLevels={botLevels} photos={photos} onHome={giveUp} onNew={() => undefined} career={{ onDone: () => settle(highstrikerWinner(hs)) }} />;
}

function ChallengeResult({ career, c, onDone }: { career: Career; c: Challenge; onDone: () => void }) {
  const won = c.won === true;
  const roster = useRoster();
  useEffect(() => {
    if (won) haptics.win();
  }, [won]);
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={won ? ({ "--cup": "var(--color-gold)" } as React.CSSProperties) : undefined}>
      <div className="screen-inner relative z-10 flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
          <Avatar name={career.player} photo={roster.find((x) => x.name === career.player)?.photo} size="xl" state={won ? "winner" : "idle"} />
          {won ? (
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-gold)", lineHeight: 1 }}>
              <CountUp value={c.stake} format={(n) => `+${dollars(n)}`} />
            </p>
          ) : (
            <p className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-text-2)" }}>
              Tapt
            </p>
          )}
        </div>
        {won && <CoinBurst />}
        <PlayButton label={won ? "HENT" : "OK"} tone={won ? "gold" : "teal"} onClick={onDone} />
      </div>
    </div>
  );
}

/** The banner that comes up when a result opens the next step of the road, or gives a new level. */
function UnlockBanner({ label, name, colour }: { label: string; name: string; colour: string }) {
  useEffect(() => {
    const t = setTimeout(() => careerSound("unlock"), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" className="unlock-banner text-center" style={{ borderColor: colour, color: colour }}>
      <span className="section-label block" style={{ color: colour }}>
        {label}
      </span>
      <span className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
        {name}
      </span>
    </div>
  );
}

/**
 * What a tournament came to: for a title the ceremony (the trophy rises over the player in their own shirt), for anything else the player and
 * the amount. One number and one button; the rest of the accounts are in the profile.
 */
export function Result({ career, a, onDone }: { career: Career; a: ActiveEvent; onDone: () => void }) {
  const r = a.result!;
  const tier = TIERS[a.tier];
  const won = r.place === "winner";
  const roster = useRoster();
  const record = roster.find((x) => x.name === career.player);
  const opened = tier.opens && tier.opens.places.includes(r.place) ? TIERS[tier.opens.tier] : null;
  // The title the points have just given, when it is a new one.
  const before = rankOf({ ...career, points: career.points - r.points, worldTitles: career.worldTitles - (won && tier.id === "vm" ? 1 : 0) });
  const newRank = rankOf(career) !== before ? rankOf(career) : null;
  const fx = fxFlags(useFxLevel());
  // The sounds of the moment: a win is a fanfare and a cheer, whatever place it is a pay-out for is a touch.
  useEffect(() => {
    if (won) {
      if (fx.confetti) playFanfare();
      careerSound("cheer");
      haptics.win();
    } else haptics.confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the result comes up
  }, []);
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": won ? "var(--color-gold)" : cupColor(tier.kind) } as React.CSSProperties}>
      <div className="screen-inner relative z-10 flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1rem" }}>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          {won ? (
            <>
              <div className="trophy-soft w-full">
                <Trophy cannons={fx.confetti} />
              </div>
              <div className="final-fade flex items-center gap-3 -mt-2" style={{ "--d": "0.9s" } as React.CSSProperties}>
                <Avatar name={career.player} photo={record?.photo} px={112} state="winner" />
                {record && <TeamKit kit={teamKitsOf(record).home} size={64} title="Skjorten din" />}
              </div>
              <p className="font-display intro-slam" style={{ "--d": "1.4s", color: "var(--color-gold)", fontSize: "clamp(2.2rem, 12vw, 3.4rem)", lineHeight: 1.05 } as React.CSSProperties}>
                {career.player}
              </p>
            </>
          ) : (
            <Avatar name={career.player} photo={record?.photo} size="xl" state="idle" />
          )}
          {r.prize > 0 ? (
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-gold)", lineHeight: 1 }}>
              <CountUp value={r.prize} format={(n) => `+${dollars(n)}`} />
            </p>
          ) : (
            <p className="font-display tabular" style={{ fontSize: "var(--text-num)", color: "var(--color-text-2)" }}>
              +{r.points} poeng
            </p>
          )}
        </div>
        {opened && <UnlockBanner label="NY TURNERING" name={opened.short} colour={cupColor(opened.kind)} />}
        {newRank && <UnlockBanner label="NYTT NIVÅ" name={newRank} colour="var(--color-gold)" />}
        {r.prize > 0 && <CoinBurst />}
        <PlayButton label={r.prize > 0 ? "HENT" : "OK"} tone={r.prize > 0 ? "gold" : "teal"} onClick={onDone} />
      </div>
    </div>
  );
}

/** A training session: fifteen rounds at the treble 20 written in, and then the level, before and after. */
export function TrainingPlay({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const [rounds, setRounds] = useState<number[]>([]);
  const [done, setDone] = useState<ReturnType<typeof sessionFrom> | null>(null);
  const submit = (score: number) => {
    const next = [...rounds, score];
    if (next.length >= DRILL_ROUNDS) {
      const now = new Date().toISOString();
      setDone(sessionFrom(career, next, now));
      commit(trainCareer(career, next, now));
    }
    setRounds(next);
  };
  if (done) {
    return (
      <div className="animate-screen-enter screen career-skin">
        <div className="screen-inner flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p className="section-label">SNITT</p>
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-cream)", lineHeight: 1 }}>
              {oneDecimal(done.average)}
            </p>
            <p className="tabular" style={{ fontSize: "var(--text-title)", color: done.after < done.before ? "var(--color-green)" : done.after > done.before ? "var(--color-text-2)" : "var(--color-muted)", fontWeight: 700 }}>
              {oneDecimal(done.before)} → {oneDecimal(done.after)} mm
            </p>
            <p style={{ color: "var(--color-muted)" }}>{levelLabel(done.after)}</p>
          </div>
          <PlayButton label="OK" onClick={onHub} />
        </div>
      </div>
    );
  }
  return (
    <div className="animate-screen-push screen career-skin">
      <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
        <div className="flex items-center gap-3">
          <BackArrow onClick={onHub} />
          <h1 className="font-display flex-1" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1 }}>
            T20
          </h1>
          <span className="tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-text-2)", fontWeight: 700 }}>
            {Math.min(rounds.length + 1, DRILL_ROUNDS)}/{DRILL_ROUNDS}
          </span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={DRILL_ROUNDS} aria-valuenow={rounds.length} aria-label="Runder kastet" style={{ height: "0.5rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)" }}>
          <div style={{ width: `${(rounds.length / DRILL_ROUNDS) * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: "var(--color-teal)", transition: "width var(--pull)" }} />
        </div>
        <div className="mt-auto">
          <ScoreKeypad onSubmit={submit} onUndo={() => setRounds((r) => r.slice(0, -1))} canUndo={rounds.length > 0} line={() => <span style={{ color: "var(--color-text-2)" }}>Summen av tre piler</span>} />
        </div>
      </div>
    </div>
  );
}
