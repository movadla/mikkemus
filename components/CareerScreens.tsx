"use client";

import { useEffect, useMemo, useState } from "react";
import { cupColor } from "@/lib/botCup";
import { GAMES, PLACE_LABEL, REVENGE_BONUS, TIERS, challengeTier, closeChallenge, eventTier, declineChallenge, dollars, settleChallenge, type ActiveEvent, type Career, type Challenge } from "@/lib/career";
import { matchParticipants } from "@/lib/tournament";
import { sponsorOutcome } from "@/lib/careerWorld";
import { lifeOf } from "@/lib/careerLife";
import { nextRank, rankOf, rankProgress } from "@/lib/careerGoals";
import { winnerOf as countdownWinner, newGame as newCountdown } from "@/lib/countdown";
import { playFanfare } from "@/lib/fanfare";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { haptics } from "@/lib/haptics";
import { winnerOf as highstrikerWinner, newGame as newHighstriker } from "@/lib/highstriker";
import { DEFAULT_LIVES, newGame as newLava, stateOf as lavaState } from "@/lib/lava";
import { useRoster } from "@/lib/storage";
import { DRILL_ROUNDS, sessionFrom } from "@/lib/training";
import { CLIMB_MAX, CLIMB_REWARD, applyClimb, climbLevel, climbOpen, climbTarget, applyDrill, dailyOf, drillLevel, drillOf, goalLine, goalOf, levelCap, passed, type DrillId, type HitsDrill } from "@/lib/drills";
import { careerSound } from "@/lib/uiSound";
import { levelLabel, oneDecimal } from "./careerFormat";
import { CoinBurst } from "./CoinBurst";
import { CountdownGameScreen } from "./CountdownApp";
import { HighstrikerGameScreen } from "./HighstrikerApp";
import { ArrowLeftIcon, BoltIcon, CoinIcon, TrophyIcon } from "./icons";
import { LavaGameScreen } from "./LavaApp";
import { PlayButton } from "./PlayButton";
import { OverRoom } from "./RoomBackdrop";
import { ScoreKeypad } from "./ScoreKeypad";
import { Trophy } from "./Trophy";
import { RankBadge, TrophyArt } from "./CareerTrophy";
import { CharacterFace, CharacterFigure } from "./CharacterFigure";
import { OpponentPortrait } from "./OpponentCard";
import type { TrainTarget } from "./TrainingPanel";
import { EventIntro } from "./EventIntro";
import { picturesFor } from "./eventPictures";
import { CareerFaceContext } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { poseFor } from "@/lib/characters";
import { TIER_LOOK, foilVars } from "@/lib/materials";
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

/** A challenge: the two of them and the stake, then the game itself, then what it came to. */
export function ChallengePlay(props: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  // Played inside the place it is dressed as, like a tournament, and the player is their character.
  const inside = picturesFor(challengeTier(props.career.challenge!));
  const over = props.career.challenge!.won !== null;
  return (
    <CareerFaceContext.Provider value={{ name: props.career.player, character: props.career.profile.character }}>
      {over ? (
        // The result stands on its own, as the result of a tournament does.
        <ChallengeFlow {...props} />
      ) : inside ? (
        <OverRoom stage={props.career.room} src={inside.inside} focus={inside.insideFocus} clear>
          <ChallengeFlow {...props} />
        </OverRoom>
      ) : (
        <OverRoom stage={props.career.room} dim={60} blur={5}>
          <ChallengeFlow {...props} />
        </OverRoom>
      )}
    </CareerFaceContext.Provider>
  );
}

function ChallengeFlow({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const c = career.challenge!;
  const roster = useRoster();
  const photos = useMemo(() => new Map(roster.map((r) => [r.name, r.photo])), [roster]);
  // The same stages as a tournament: the opening, the match, and the result with its ceremony. A show of several legs has a break between them.
  const [stage, setStage] = useState<"intro" | "play" | "break">("intro");
  const [leg, setLeg] = useState(0);
  const [score, setScore] = useState({ you: 0, them: 0 });
  const tv = c.tv;
  const opponent = c.opponent.name;
  // Whoever throws first changes from one leg to the next.
  const order = (n: number) => (n % 2 === 0 ? [career.player, opponent] : [opponent, career.player]);
  const newLeg = (n: number) => newCountdown(tv?.theirStart === 301 ? 301 : 501, true, order(n), tv ? { [career.player]: tv.humanStart } : undefined);
  const botLevels = { [opponent]: c.opponent.skill };
  const [cd, setCd] = useState(() => newLeg(0));
  const [lava, setLava] = useState(() => newLava(DEFAULT_LIVES, [career.player, opponent]));
  const [hs, setHs] = useState(() => newHighstriker(DEFAULT_LIVES, [career.player, opponent]));
  const settle = (winner: string | null) => commit(settleChallenge(career, winner === career.player, new Date().toISOString()));
  const giveUp = () => {
    commit(declineChallenge(career));
    onHub();
  };
  // A leg is over: the match is decided when someone has the most of the legs, or the next one is played.
  const legDone = (winner: string | null) => {
    const next = { you: score.you + (winner === career.player ? 1 : 0), them: score.them + (winner === career.player ? 0 : 1) };
    const need = Math.floor((tv?.legs ?? 1) / 2) + 1;
    if (next.you >= need || next.them >= need) return settle(next.you >= need ? career.player : opponent);
    setScore(next);
    setStage("break");
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
  if (stage === "intro") {
    const detail = tv ? (tv.humanStart !== tv.theirStart ? `${career.player} starter på ${tv.humanStart}, ${opponent} på ${tv.theirStart}.` : `Best av ${tv.legs}.`) : c.risk ? `Taper du, mister du ${dollars(Math.min(career.money, c.risk))}.` : "Én runde.";
    return (
      <EventIntro
        tier={challengeTier(c)}
        player={career.player}
        character={career.profile.character}
        label="SPILL"
        extra={<FaceOff career={career} opponent={opponent} named={!tv} />}
        plates={tv ? [["Honorar", dollars(tv.honorarium)], ["Til vinneren", dollars(c.stake)]] : [["Spill", GAMES[c.game].name], ["Premie", dollars(c.stake)], ...(c.risk ? [["Du risikerer", dollars(Math.min(career.money, c.risk))] as [string, string]] : [])]}
        plain={!tv}
        line={
          <>
            <b>{career.player}</b> mot <b>{opponent}</b>.
            <br />
            {detail}
          </>
        }
        onBack={giveUp}
        onDone={() => setStage("play")}
      />
    );
  }
  if (stage === "break") {
    return (
      <div className="animate-screen-enter screen">
        <div className="screen-inner flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
          <div className="flex-1 flex flex-col items-center justify-center leg-break">
            <p className="section-label">LEGG {leg + 1} AV {tv?.legs}</p>
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-cream)", lineHeight: 1 }}>
              {score.you}–{score.them}
            </p>
            <p style={{ color: "var(--color-text-2)" }}>{score.you > score.them ? `${career.player} leder` : score.you < score.them ? `${opponent} leder` : "Likt"}</p>
          </div>
          <PlayButton
            label="NESTE LEGG"
            onClick={() => {
              setLeg(leg + 1);
              setCd(newLeg(leg + 1));
              setStage("play");
            }}
          />
        </div>
      </div>
    );
  }
  if (c.game === "501") {
    return <CountdownGameScreen key={leg} game={cd} setGame={setCd} botLevels={botLevels} photos={photos} onHome={giveUp} onNew={() => undefined} career={{ onDone: () => legDone(countdownWinner(cd)), giveUp: true }} />;
  }
  if (c.game === "lava") {
    return <LavaGameScreen game={lava} setGame={setLava} botLevels={botLevels} photos={photos} onHome={giveUp} onNew={() => undefined} career={{ onDone: () => settle(lavaState(lava).winner) }} />;
  }
  return <HighstrikerGameScreen game={hs} setGame={setHs} botLevels={botLevels} photos={photos} onHome={giveUp} onNew={() => undefined} career={{ onDone: () => settle(highstrikerWinner(hs)) }} />;
}

/** What a challenge came to: for a win the ceremony of a title (the match dressed as a tournament), for a loss the player and what it cost or paid. */
function ChallengeResult({ career, c, onDone }: { career: Career; c: Challenge; onDone: () => void }) {
  const won = c.won === true;
  const paid = (won ? c.stake : 0) + (c.tv?.honorarium ?? 0);
  const fx = fxFlags(useFxLevel());
  useEffect(() => {
    if (won) {
      if (fx.confetti) playFanfare();
      careerSound("cheer");
      haptics.win();
    } else haptics.confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the result comes up
  }, []);
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": won ? "var(--color-gold)" : cupColor(challengeTier(c).kind) } as React.CSSProperties}>
      <div className="screen-inner relative z-10 flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          {won ? (
            <Ceremony tier={challengeTier(c)} player={career.player} prize={paid} confetti={fx.confetti} character={career.profile.character} />
          ) : (
            <div className={`char-result ${paid > 0 ? "" : "char-result-low"}`}>
              <CharacterFigure id={career.profile.character} pose="skuffet" glow={paid > 0} />
            </div>
          )}
          {paid > 0 ? (
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-gold)", lineHeight: 1 }}>
              <CountUp value={paid} format={(n) => `+${dollars(n)}`} />
            </p>
          ) : (
            <p className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-text-2)" }}>
              Tapt{c.risk ? ` · −${dollars(c.risk)}` : ""}
            </p>
          )}
          {!won && paid > 0 && <p style={{ color: "var(--color-text-2)" }}>Tapt, men honoraret er ditt.</p>}
          <NextGoal career={career} />
        </div>
        {paid > 0 && <CoinBurst />}
        <PlayButton label={paid > 0 ? "HENT" : "OK"} tone={paid > 0 ? "gold" : "teal"} onClick={onDone} />
      </div>
    </div>
  );
}

/** The end of a season, once: where the player came, who won it, and what it paid. Like a result: the character, one number and one button. */
export function SeasonRecap({ career, onDone }: { career: Career; onDone: () => void }) {
  const s = lifeOf(career).seasons[0];
  const fx = fxFlags(useFxLevel());
  const best = s.rank === 1;
  useEffect(() => {
    if (best) {
      if (fx.confetti) playFanfare();
      careerSound("cheer");
      haptics.win();
    } else haptics.confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the recap comes up
  }, []);
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": best ? "var(--color-gold)" : "var(--color-teal)" } as React.CSSProperties}>
      <div className="screen-inner relative z-10 flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1rem" }}>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <p className="cer-kicker">SESONG {s.season} ER OVER</p>
          <div className={`char-result ${s.rank <= 3 ? "" : "char-result-low"}`}>
            <CharacterFigure id={career.profile.character} pose={s.rank <= 3 ? "jubel" : "noytral"} glow={s.rank <= 3} />
          </div>
          <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: best ? "var(--color-gold)" : "var(--color-cream)", lineHeight: 1 }}>
            Nr. {s.rank}
          </p>
          <p style={{ color: "var(--color-text-2)" }}>
            {best ? "Årets spiller" : `${s.winner} er årets spiller`} · {s.points} poeng
          </p>
          {s.prize > 0 && (
            <p className="font-display tabular" style={{ fontSize: "var(--text-num)", color: "var(--color-gold)" }}>
              <CountUp value={s.prize} format={(n) => `+${dollars(n)}`} />
            </p>
          )}
          {s.table && s.table.length > 0 && (
            <ol className="season-table" aria-label="Sesongtabellen">
              {s.table.map((r, i) => (
                <li key={r.name} className={r.name === career.player ? "me" : ""}>
                  <span>{i + 1}</span>
                  <b className="truncate">{r.name}</b>
                  <span className="tabular">{r.pts}</span>
                </li>
              ))}
              {s.rank > s.table.length && (
                <li className="me">
                  <span>{s.rank}</span>
                  <b className="truncate">{career.player}</b>
                  <span className="tabular">{s.points}</span>
                </li>
              )}
            </ol>
          )}
          {(() => {
            const before = lifeOf(career).seasons[1];
            if (!before || before.rank === s.rank) return null;
            const d = before.rank - s.rank;
            return <p style={{ color: d > 0 ? "var(--color-green)" : "var(--color-muted)", fontWeight: 700 }}>{d > 0 ? `Du gikk opp ${d} ${d === 1 ? "plass" : "plasser"} fra sesong ${before.season}` : `Du falt ${-d} ${-d === 1 ? "plass" : "plasser"} fra sesong ${before.season}`}</p>;
          })()}
        </div>
        {s.prize > 0 && <CoinBurst />}
        <PlayButton label="NY SESONG" tone={best ? "gold" : "teal"} onClick={onDone} />
      </div>
    </div>
  );
}

/** The two who play a show, face to face, under the plates of its opening. */
function FaceOff({ career, opponent, named = false }: { career: Career; opponent: string; /** The names under the faces: a duel has no other place that says who plays. */ named?: boolean }) {
  const px = named ? 84 : 60;
  return (
    <div className="ev-faceoff" aria-label={`${career.player} mot ${opponent}`}>
      <span className="ev-face">
        <CharacterFace id={career.profile.character} pose="kast" px={px} />
        {named && <small>{career.player}</small>}
      </span>
      <span className="font-display" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-num)" }}>
        VS
      </span>
      <span className="ev-face">
        <span style={{ width: px }}>
          <OpponentPortrait name={opponent} />
        </span>
        {named && <small>{opponent}</small>}
      </span>
    </div>
  );
}

/** A new rank, once: the badge large, the name, and how far the next one is. */
export function RankUp({ career, onDone }: { career: Career; onDone: () => void }) {
  const fx = fxFlags(useFxLevel());
  const rank = rankOf(career);
  const next = nextRank(career);
  useEffect(() => {
    if (fx.confetti) playFanfare();
    careerSound("cheer");
    haptics.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the screen comes up
  }, []);
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": "var(--color-gold)" } as React.CSSProperties}>
      <div className="screen-inner relative z-10 flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1rem" }}>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <p className="cer-kicker">NY RANG</p>
          <span className="rankup-badge">
            <RankBadge rank={rank} />
          </span>
          <p className="font-display" style={{ fontSize: "clamp(2rem, 11vw, 3rem)", color: "var(--color-gold)", lineHeight: 1.05 }}>
            {rank}
          </p>
          <p style={{ color: "var(--color-text-2)" }}>
            {career.points} poeng{next ? ` · ${next.name} ved ${next.min}` : ""}
          </p>
        </div>
        <PlayButton label="FORTSETT" tone="gold" onClick={onDone} />
      </div>
    </div>
  );
}

/** One quiet card for what a result gave besides the money (a revenge, a sponsor, a new tournament, a new rank), a row each, instead of a banner for each. */
type NewRow = { icon: React.ReactNode; tone: string; title: string; text?: string; sound?: boolean };
function NewCard({ rows }: { rows: NewRow[] }) {
  const sound = rows.some((r) => r.sound);
  useEffect(() => {
    if (!sound) return;
    const timer = setTimeout(() => careerSound("unlock"), 1500);
    return () => clearTimeout(timer);
  }, [sound]);
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  // Two rows are the night's news; the rest are one tap away.
  const shown = all ? rows : rows.slice(0, 2);
  return (
    <ul className="new-card" aria-label="Nytt">
      {shown.map((r) => (
        <li key={r.title} role="status" className="new-row">
          <span className="msg-kind" data-tone={r.tone} aria-hidden>
            {r.icon}
          </span>
          <span className="min-w-0">
            <b className="block">{r.title}</b>
            {r.text && <small className="block">{r.text}</small>}
          </span>
        </li>
      ))}
      {!all && rows.length > 2 && (
        <li className="new-more">
          <button type="button" className="tactile" onClick={() => setAll(true)}>
            + {rows.length - 2} til
          </button>
        </li>
      )}
    </ul>
  );
}

/** What is next, in one line, so a result is never the end: how far there is to the next rank. */
function NextGoal({ career }: { career: Career }) {
  const g = rankProgress(career);
  if (!g) return null;
  return (
    <p className="next-goal tabular">
      {g.need - g.points} poeng til {g.name}
    </p>
  );
}

/**
 * The ceremony of a title. The light comes on, the cup rises from its plinth in a flash, rays turn behind it, the player stands in front of it,
 * the name of the event is struck in foil and a plate is engraved with the name, the date and the prize. A tap takes it to the end.
 */
function Ceremony({ tier, player, prize, confetti, character }: { tier: (typeof TIERS)[keyof typeof TIERS]; player: string; prize: number; confetti: boolean; character?: string }) {
  const [skip, setSkip] = useState(false);
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <div className={`cer ${skip ? "cer-skip" : ""}`} style={{ "--tint": TIER_LOOK[tier.id].tint } as React.CSSProperties} onClick={() => setSkip(true)}>
      <div className="cer-stage" aria-hidden>
        <span className="cer-spot" />
        <span className="cer-rays" />
        <div className="cer-trophy">
          <TrophyArt kind={tier.id} tilt variant={(tier as { key?: string }).key} />
        </div>
      </div>
      <span className="cer-flash" aria-hidden />
      <Trophy plain cannons={confetti} />
      <div className="cer-hero" style={{ "--tint": TIER_LOOK[tier.id].tint } as React.CSSProperties}>
        <CharacterFigure id={character} pose="jubel" glow />
      </div>
      <p className="cer-kicker">VINNER</p>
      <h2 className="cer-title">
        <span className="foil" data-t={tier.name} style={foilVars(tier.id) as React.CSSProperties}>
          {tier.name}
        </span>
      </h2>
      <div className="cer-plate">
        <span className="cer-plate-1">
          {player} · {tier.short}
        </span>
        <span className="cer-plate-2">
          {date} · {dollars(prize)}
        </span>
      </div>
    </div>
  );
}

/**
 * What a tournament came to: for a title the ceremony (the trophy rises over the player in their own shirt), for anything else the player and
 * the amount. One number and one button; the rest of the accounts are in the profile.
 */
export function Result({ career, a, onDone }: { career: Career; a: ActiveEvent; onDone: () => void }) {
  const r = a.result!;
  const tier = eventTier(a);
  const won = r.place === "winner";
  const sponsor = sponsorOutcome(career);
  const opened = tier.opens && tier.opens.places.includes(r.place) ? TIERS[tier.opens.tier] : null;
  const fx = fxFlags(useFxLevel());
  // The one who knocked the player out, and how many times they have now: a rival has the better of them twice and more, and a win over them pays more.
  const team = a.invite?.team;
  const knockedOutBy = (() => {
    if (team) return null;
    const m = a.tournament?.matches.find((x) => !x.isBronzeMatch && x.winner && x.winner !== career.player && matchParticipants(x).includes(career.player));
    return m ? matchParticipants(m).find((n) => n !== career.player) ?? null : null;
  })();
  const rec = knockedOutBy ? career.rivals?.[knockedOutBy] : undefined;
  // The road of the night: whom the player beat, round by round (a team cup is not told this way).
  const beaten = team
    ? []
    : (a.tournament?.matches ?? [])
        .filter((x) => !x.isBronzeMatch && !x.isBye && x.winner === career.player && matchParticipants(x).includes(career.player))
        .sort((x, y) => (y.bracketRoundSize ?? 0) - (x.bracketRoundSize ?? 0))
        .map((x) => matchParticipants(x).find((n) => n !== career.player))
        .filter((n): n is string => !!n);
  const rivalLine = !won && knockedOutBy && rec && rec.l >= 2 && rec.l > rec.w ? `${knockedOutBy} har slått deg ${rec.l} ganger. En seier over ham neste gang gir ${dollars(REVENGE_BONUS)} ekstra.` : null;
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
          <p className="cer-kicker">
            {won ? "VINNER" : PLACE_LABEL[r.place].toUpperCase()} · {tier.name.toUpperCase()}
          </p>
          {won ? (
            <Ceremony tier={tier} player={team ? `${career.player} og ${team.mine.partner}` : career.player} prize={r.prize} confetti={fx.confetti} character={career.profile.character} />
          ) : (
            <div className={`char-result ${r.prize > 0 ? "" : "char-result-low"}`}>
              <CharacterFigure id={career.profile.character} pose={poseFor(r)} glow={r.prize > 0} />
            </div>
          )}
          {r.prize > 0 ? (
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-gold)", lineHeight: 1 }}>
              <CountUp value={r.prize} format={(n) => `+${dollars(n)}`} />
            </p>
          ) : (
            <p className="font-display tabular" style={{ fontSize: "var(--text-num)", color: "var(--color-text-2)" }}>
              +{r.points} rangpoeng
            </p>
          )}
          {beaten.length > 0 && (
            <ul className="road-chips" aria-label="Veien dit">
              {beaten.map((n, i) => (
                <li key={`${n}-${i}`}>Slo {n}</li>
              ))}
            </ul>
          )}
          <NextGoal career={career} />
        </div>
        <NewCard
          rows={[
            ...(r.revenge ? [{ icon: <BoltIcon className="w-5 h-5" />, tone: "gold", title: `Revansje: du slo ${r.revenge.names.join(" og ")}`, text: `+${dollars(r.revenge.bonus)}` }] : []),
            ...(rivalLine && knockedOutBy && rec ? [{ icon: <BoltIcon className="w-5 h-5" />, tone: "red", title: `${knockedOutBy} har slått deg ${rec.l} ganger`, text: `En seier neste gang gir ${dollars(REVENGE_BONUS)} ekstra` }] : []),
            ...(sponsor ? [{ icon: <CoinIcon className="w-5 h-5" />, tone: sponsor.met ? "gold" : "muted", title: sponsor.met ? `${sponsor.name} betaler ${dollars(sponsor.pay)}` : `${sponsor.name} betaler ikke denne gangen`, text: sponsor.met ? undefined : `Ville ha deg blant de ${sponsor.need === "quarter" ? "åtte" : "fire"} beste` }] : []),
            ...(opened ? [{ icon: <TrophyIcon className="w-5 h-5" />, tone: "teal", title: `Ny turnering: ${opened.short}`, sound: true }] : []),
          ]}
        />
        {r.prize > 0 && <CoinBurst />}
        <PlayButton label={r.prize > 0 ? "HENT" : "OK"} tone={r.prize > 0 ? "gold" : "teal"} onClick={onDone} />
      </div>
    </div>
  );
}

/** A training session: fifteen rounds at the treble 20 written in, and then the level, before and after. */
export function TrainingPlay(props: { career: Career; commit: (c: Career) => void; onHub: () => void; drill: TrainTarget }) {
  return (
    <OverRoom stage={props.career.room} dim={60} blur={5}>
      {props.drill === "stige" ? <ClimbFlow {...props} /> : drillOf(props.drill).kind === "hits" ? <HitsFlow {...props} drill={props.drill} /> : <TrainingFlow {...props} />}
    </OverRoom>
  );
}

/** What a drill that has been thrown says: passed or not, and the level it is at now, with a word when the room is what holds it back. */
function DrillDone({ career, before, after, ok, onHub, bonus = 0, streak = 0 }: { career: Career; before: number; after: number; ok: boolean; onHub: () => void; /** What the drill of the day paid, when it was this one. */ bonus?: number; streak?: number }) {
  const held = ok && after === before && before >= levelCap(career.room);
  return (
    <>
      <p className="font-display" style={{ fontSize: "var(--text-num)", color: ok ? "var(--color-green)" : "var(--color-cream)" }}>
        {ok ? "Bestått" : "Ikke denne gangen"}
      </p>
      <p className="tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-text-2)", fontWeight: 700 }}>
        Nivå {before === after ? after : `${before} → ${after}`}
      </p>
      {bonus > 0 && (
        <p className="tabular" style={{ color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-title)" }}>
          Dagens øvelse: +{dollars(bonus)} · {streak} {streak === 1 ? "dag" : "dager"} på rad
        </p>
      )}
      {held && <p style={{ color: "var(--color-muted)" }}>Rommet tillater nivå {levelCap(career.room)}. Bygg ut rommet for å komme videre.</p>}
      <PlayButton label="OK" onClick={onHub} />
    </>
  );
}

/** The ladder: one round of three darts at a time, written in as the total; it is passed when the total is enough for the level, and then the next level is on. */
function ClimbFlow({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const level = climbLevel(career);
  const target = climbTarget(level);
  const [last, setLast] = useState<number | null>(null);
  const [passedLevel, setPassedLevel] = useState<number | null>(null);
  const submit = (score: number) => {
    const next = applyClimb(career, score);
    if (next === career) {
      setLast(score);
      return;
    }
    commit(next);
    setPassedLevel(level);
    setLast(null);
  };
  if (passedLevel !== null) {
    const now = climbLevel(career);
    return (
      <div className="animate-screen-enter screen">
        <div className="screen-inner flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
          <p className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-green)" }}>
            Nivå {passedLevel} klart
          </p>
          <p className="tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-gold-strong)", fontWeight: 800 }}>
            +{dollars(CLIMB_REWARD)}
          </p>
          {now > CLIMB_MAX ? <p style={{ color: "var(--color-text-2)" }}>Alle {CLIMB_MAX} nivåene er klare.</p> : !climbOpen(career) && <p style={{ color: "var(--color-muted)" }}>Rommet tillater nivå {levelCap(career.room)}. Bygg ut rommet for å komme videre.</p>}
          {now <= CLIMB_MAX && climbOpen(career) && <PlayButton label="NESTE NIVÅ" onClick={() => setPassedLevel(null)} />}
          <Button variant="ghost" onClick={onHub}>
            Ferdig
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
        <div className="flex items-center gap-3">
          <BackArrow onClick={onHub} />
          <h1 className="font-display flex-1" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1 }}>
            Nivå {level}
          </h1>
          <span className="tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-gold-strong)", fontWeight: 800 }}>
            {target}
          </span>
        </div>
        <p style={{ color: "var(--color-text-2)" }}>Få minst {target} poeng på tre piler.</p>
        {last !== null && (
          <p role="status" className="tabular" style={{ color: "var(--color-red)", fontWeight: 700 }}>
            Du fikk {last}. Prøv igjen.
          </p>
        )}
        <div className="mt-auto">
          <ScoreKeypad onSubmit={submit} onUndo={() => setLast(null)} canUndo={last !== null} line={() => <span style={{ color: "var(--color-text-2)" }}>Summen av tre piler</span>} />
        </div>
      </div>
    </div>
  );
}

/** A drill of darts at one target: each attempt is written in as the number of darts that hit, and it is passed when one attempt has enough. */
function HitsFlow({ career, commit, onHub, drill }: { career: Career; commit: (c: Career) => void; onHub: () => void; drill: DrillId }) {
  const d = drillOf(drill) as HitsDrill;
  const level = drillLevel(career, drill);
  const g = goalOf(drill, level);
  const [tries, setTries] = useState<number[]>([]);
  const [done, setDone] = useState<{ before: number; after: number; ok: boolean; bonus: number; streak: number } | null>(null);
  if (g.kind !== "hits") return null;
  const pick = (hits: number) => {
    const next = [...tries, hits];
    setTries(next);
    if (hits >= g.need || next.length >= g.attempts) {
      const result = { id: drill, level, scores: next };
      const after = applyDrill(career, result, new Date().toISOString());
      commit(after);
      setDone({ before: level, after: drillLevel(after, drill), ok: passed(result), bonus: after.money - career.money, streak: dailyOf(after, new Date().toISOString().slice(0, 10)).streak });
    }
  };
  if (done) {
    return (
      <div className="animate-screen-enter screen">
        <div className="screen-inner flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
          <DrillDone career={career} {...done} onHub={onHub} />
        </div>
      </div>
    );
  }
  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
        <div className="flex items-center gap-3">
          <BackArrow onClick={onHub} />
          <h1 className="font-display flex-1" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1 }}>
            {d.name}
          </h1>
          <span className="tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-text-2)", fontWeight: 700 }}>
            Nivå {level}
          </span>
        </div>
        <p style={{ color: "var(--color-text-2)" }}>{goalLine(drill, level)}</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={g.attempts} aria-valuenow={tries.length} aria-label="Forsøk" style={{ height: "0.5rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)" }}>
          <div style={{ width: `${(tries.length / g.attempts) * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: "var(--color-teal)", transition: "width var(--pull)" }} />
        </div>
        <div className="mt-auto grid gap-2">
          <p className="section-label">FORSØK {tries.length + 1} AV {g.attempts} · HVOR MANGE TRAKK {d.target === "bull" ? "BULL" : d.target.toUpperCase()}?</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(5, g.darts + 1)}, 1fr)` }}>
            {Array.from({ length: g.darts + 1 }, (_, n) => (
              <Button key={n} label={`${n} treff`} onClick={() => pick(n)}>
                {n}
              </Button>
            ))}
          </div>
          <Button variant="ghost" disabled={tries.length === 0} onClick={() => setTries((x) => x.slice(0, -1))}>
            Angre
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrainingFlow({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const level = drillLevel(career, "t20");
  const [rounds, setRounds] = useState<number[]>([]);
  const [done, setDone] = useState<(ReturnType<typeof sessionFrom> & { ok: boolean; after20: number; bonus: number; streak: number }) | null>(null);
  const submit = (score: number) => {
    const next = [...rounds, score];
    if (next.length >= DRILL_ROUNDS) {
      const now = new Date().toISOString();
      const result = { id: "t20" as const, level, scores: next };
      const applied = applyDrill(career, result, now);
      setDone({ ...sessionFrom(career, next, now), ok: passed(result), after20: drillLevel(applied, "t20"), bonus: applied.money - career.money, streak: dailyOf(applied, now.slice(0, 10)).streak });
      commit(applied);
    }
    setRounds(next);
  };
  if (done) {
    return (
      <div className="animate-screen-enter screen">
        <div className="screen-inner flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p className="section-label">SNITT PER RUNDE</p>
            <p className="font-display tabular" style={{ fontSize: "clamp(2.6rem, 16vw, 4rem)", color: "var(--color-cream)", lineHeight: 1 }}>
              {oneDecimal(done.average)}
            </p>
            <p className="tabular" style={{ fontSize: "var(--text-title)", color: done.after < done.before ? "var(--color-green)" : done.after > done.before ? "var(--color-text-2)" : "var(--color-muted)", fontWeight: 700 }}>
              avvik {oneDecimal(done.before)} → {oneDecimal(done.after)} mm
            </p>
            <p style={{ color: "var(--color-muted)" }}>{levelLabel(done.after)}</p>
            <DrillDone career={career} before={level} after={done.after20} ok={done.ok} bonus={done.bonus} streak={done.streak} onHub={onHub} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
        <div className="flex items-center gap-3">
          <BackArrow onClick={onHub} />
          <h1 className="font-display flex-1" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1 }}>
            Trippel 20 · nivå {level}
          </h1>
          <span className="tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-text-2)", fontWeight: 700 }}>
            {Math.min(rounds.length + 1, DRILL_ROUNDS)}/{DRILL_ROUNDS}
          </span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={DRILL_ROUNDS} aria-valuenow={rounds.length} aria-label="Runder kastet" style={{ height: "0.5rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)" }}>
          <div style={{ width: `${(rounds.length / DRILL_ROUNDS) * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: "var(--color-teal)", transition: "width var(--pull)" }} />
        </div>
        <div className="mt-auto">
          <ScoreKeypad onSubmit={submit} onUndo={() => setRounds((r) => r.slice(0, -1))} canUndo={rounds.length > 0} line={() => <span style={{ color: "var(--color-text-2)" }}>Summen av tre piler · {goalLine("t20", level)}</span>} />
        </div>
      </div>
    </div>
  );
}
