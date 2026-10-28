"use client";

import { useEffect, useMemo, useState } from "react";
import { cupColor } from "@/lib/botCup";
import {
  DARTS,
  GAMES,
  HOMES,
  PLACE_LABEL,
  START_LEVELS,
  TIERS,
  abandonEvent,
  careerId,
  closeChallenge,
  closeEvent,
  declineChallenge,
  dollars,
  finishEvent,
  newCareer,
  setTournament,
  settleChallenge,
  type ActiveEvent,
  type Career,
  type Challenge,
  type DartsId,
  type HomeId,
} from "@/lib/career";
import { DRILL_ROUNDS, sessionFrom, trainCareer } from "@/lib/training";
import { newGame as newCountdown, winnerOf as countdownWinner } from "@/lib/countdown";
import { newGame as newHighstriker, winnerOf as highstrikerWinner } from "@/lib/highstriker";
import { newGame as newLava, stateOf as lavaState } from "@/lib/lava";
import { DEFAULT_LIVES } from "@/lib/lava";
import { deleteCareer, loadCareers, saveCareer } from "@/lib/careerStorage";
import { setKits, teamKitsOf, useRoster } from "@/lib/storage";
import { applyTheme } from "@/lib/theme";
import { rankOf } from "@/lib/careerGoals";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { haptics } from "@/lib/haptics";
import { playFanfare } from "@/lib/fanfare";
import { careerSound } from "@/lib/uiSound";
import { CoinBurst } from "./CoinBurst";
import { roadOf } from "@/lib/knockout";
import { levelOfMed } from "@/lib/botLevels";
import { roundName } from "./KnockoutOverview";
import { Hub } from "./CareerHub";
import { levelLabel, oneDecimal, signed } from "./careerFormat";
import { Trophy } from "./Trophy";
import { CountdownGameScreen } from "./CountdownApp";
import { EventIntro } from "./EventIntro";
import { ScoreKeypad } from "./ScoreKeypad";
import { HighstrikerGameScreen } from "./HighstrikerApp";
import { LavaGameScreen } from "./LavaApp";
import { KitEditor } from "./KitSettings";
import { ScreenTop } from "./ScreenTop";
import { TeamKit } from "./TeamKit";
import { TournamentApp } from "./TournamentApp";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CountUp } from "./ui/CountUp";
import { SkeletonRows } from "./ui/Skeleton";
import { FOCUS_RING } from "./ui/focus";


/**
 * Karriere: play events against bots for dollars and ranking points (CAREER_PLAN.md). One career per person. An event is the app's own
 * cup, played with the Mikke Mus game, so the draw, the bracket and the champion are the ones of the tournaments. The career is saved after
 * every result, so an event can be left and picked up again, on this phone or another.
 */
export function CareerApp({ onExitToHome }: { onExitToHome: () => void }) {
  // A game of evenings keeps to its night look whatever the rest of the app is set to, and gives the page back when it is left.
  useEffect(() => {
    applyTheme("dark");
    return () => applyTheme();
  }, []);
  const roster = useRoster();
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [screen, setScreen] = useState<"hub" | "play" | "challenge" | "training">("hub");
  const photos = useMemo(() => new Map(roster.map((r) => [r.name, r.photo])), [roster]);

  useEffect(() => {
    let live = true;
    void loadCareers().then((list) => live && setCareers(list));
    return () => {
      live = false;
    };
  }, []);

  const career = careers?.find((c) => c.id === id) ?? null;
  const commit = (next: Career) => {
    const saved = saveCareer(next);
    setCareers((list) => [saved, ...(list ?? []).filter((c) => c.id !== saved.id)]);
  };
  const remove = (c: Career) => {
    void deleteCareer(c.id);
    setCareers((list) => (list ?? []).filter((x) => x.id !== c.id));
    setId(null);
    setScreen("hub");
  };

  if (careers === null) {
    return (
      <div className="screen">
        <div className="screen-inner">
          <ScreenTop title="Karriere" onBack={onExitToHome} />
          <SkeletonRows count={3} />
        </div>
      </div>
    );
  }

  if (!career) {
    if (creating || careers.length === 0) {
      return (
        <NewCareer
          taken={careers.map((c) => c.id)}
          onBack={careers.length > 0 ? () => setCreating(false) : onExitToHome}
          onCreate={(player, level, profile) => {
            const c = newCareer(player, level, new Date().toISOString(), profile);
            commit(c);
            setId(c.id);
            setCreating(false);
            setScreen("hub");
          }}
        />
      );
    }
    return (
      <div className="animate-screen-push screen">
        <div className="screen-inner">
          <ScreenTop title="Karriere" onBack={onExitToHome} />
          <ul className="space-y-2 mb-4" aria-label="Karrierer">
            {careers.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setId(c.id)} className={`tactile w-full flex items-center gap-3 text-left ${FOCUS_RING}`} style={{ padding: "0.6rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", minHeight: "var(--control-lg)" }}>
                  <Avatar name={c.player} photo={photos.get(c.player)} size="m" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold">{c.player}</span>
                    <span className="block tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                      {dollars(c.money)} · {c.points} poeng
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button block onClick={() => setCreating(true)}>
            Ny karriere
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "play" && career.active) {
    return <Play career={career} commit={commit} onHub={() => setScreen("hub")} />;
  }
  if (screen === "training") {
    return <TrainingPlay career={career} commit={commit} onHub={() => setScreen("hub")} />;
  }
  if (screen === "challenge" && career.challenge) {
    return <ChallengePlay career={career} commit={commit} onHub={() => setScreen("hub")} />;
  }
  return <Hub career={career} onBack={() => setId(null)} onPlay={() => setScreen("play")} onChallenge={() => setScreen("challenge")} onTrain={() => setScreen("training")} commit={commit} onDelete={() => remove(career)} />;
}

/** A card to pick one of a few things: the name, and one line about it. */
function Choice({ selected, onPick, title, about }: { selected: boolean; onPick: () => void; title: string; about: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} className={`tactile w-full text-left ${FOCUS_RING}`} style={{ padding: "0.6rem 0.8rem", borderRadius: "var(--radius-m)", border: `1px solid ${selected ? "var(--color-teal)" : "var(--color-border)"}`, background: selected ? "var(--teal-soft)" : "var(--color-surface)", minHeight: "var(--control-lg)" }}>
      <span className="block font-semibold">{title}</span>
      <span className="block" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
        {about}
      </span>
    </button>
  );
}

/** The three steps of a start: who, what they look like, and the first tournament (which is the pub's, and free). */
function Steps({ step }: { step: 1 | 2 }) {
  const items = ["Hvem er du", "Utseende", "Første turnering"];
  return (
    <ol className="flex gap-2 mb-4" aria-label="Steg">
      {items.map((label, i) => (
        <li key={label} className="flex-1" aria-current={i + 1 === step ? "step" : undefined}>
          <span className="block" style={{ height: "0.3rem", borderRadius: "var(--radius-pill)", background: i + 1 <= step ? "var(--color-teal)" : "var(--color-cell)" }} />
          <span className="block mt-1" style={{ fontSize: "var(--text-micro)", color: i + 1 === step ? "var(--color-cream)" : "var(--color-muted)", fontWeight: i + 1 === step ? 700 : 500 }}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Two steps: who and how good, then the look and the start (the shirt, the darts, the place). */
function NewCareer({ taken, onBack, onCreate }: { taken: string[]; onBack: () => void; onCreate: (player: string, level: string, profile: { home: HomeId; darts: DartsId }) => void }) {
  const roster = useRoster();
  const people = roster.filter((r) => r.kind !== "team" && !taken.includes(careerId(r.name)));
  const [step, setStep] = useState<1 | 2>(1);
  const [player, setPlayer] = useState<string | null>(null);
  const [level, setLevel] = useState("dyktig");
  const [home, setHome] = useState<HomeId>("garage");
  const [darts, setDarts] = useState<DartsId>("middels");
  const record = roster.find((r) => r.name === player);

  if (step === 2 && record) {
    const kits = teamKitsOf(record);
    return (
      <div className="animate-screen-push screen has-sticky-action">
        <div className="screen-inner">
          <ScreenTop title="Utseende" onBack={() => setStep(1)} sub={<span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{record.name}</span>} />
          <Steps step={2} />
          <KitEditor label="SKJORTE" kit={kits.home} onChange={(kit) => setKits(record.name, { ...kits, home: kit })} name={record.name} />
          <p className="section-label mb-2">DARTPILER</p>
          <div className="space-y-2 mb-5" role="radiogroup" aria-label="Dartpiler">
            {DARTS.map((d) => (
              <Choice key={d.id} selected={darts === d.id} onPick={() => setDarts(d.id)} title={d.name} about={d.about} />
            ))}
          </div>
          <p className="section-label mb-2">HVOR DU STARTER</p>
          <div className="space-y-2 mb-6" role="radiogroup" aria-label="Hvor du starter">
            {HOMES.map((h) => (
              <Choice key={h.id} selected={home === h.id} onPick={() => setHome(h.id)} title={h.name} about={h.about} />
            ))}
          </div>
          <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
            Neste er din første turnering: Lü-cupen på puben. Den er gratis.
          </p>
          <Button block variant="primary" size="lg" onClick={() => onCreate(record.name, level, { home, darts })}>
            Start karrieren
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-screen-push screen has-sticky-action">
      <div className="screen-inner">
        <ScreenTop title="Ny karriere" onBack={onBack} />
        <Steps step={1} />
        <p className="section-label mb-2">HVEM SPILLER</p>
        {people.length === 0 ? (
          <p className="mb-4" style={{ color: "var(--color-muted)" }}>
            Legg til en spiller under Spillere først.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-5" role="radiogroup" aria-label="Spiller">
            {people.map((p) => (
              <button key={p.name} type="button" role="radio" aria-checked={player === p.name} onClick={() => setPlayer(p.name)} className={`tactile flex items-center gap-2 ${FOCUS_RING}`} style={{ padding: "0.35rem 0.75rem 0.35rem 0.4rem", borderRadius: "var(--radius-pill)", border: `1px solid ${player === p.name ? "var(--color-teal)" : "var(--color-border)"}`, background: player === p.name ? "var(--teal-soft)" : "var(--color-surface)", minHeight: "var(--control)" }}>
                <Avatar name={p.name} photo={p.photo} size="s" />
                {p.name}
              </button>
            ))}
          </div>
        )}
        <p className="section-label mb-2">HVOR GOD ER DU</p>
        <div className="space-y-2 mb-6" role="radiogroup" aria-label="Nivå">
          {START_LEVELS.map((l) => (
            <Choice key={l.key} selected={level === l.key} onPick={() => setLevel(l.key)} title={l.name} about={l.about} />
          ))}
        </div>
        <Button block variant="primary" size="lg" disabled={!player} onClick={() => setStep(2)}>
          Neste
        </Button>
      </div>
    </div>
  );
}

function Play({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const a = career.active!;
  // The scene before the draw is only for an event that has just been entered, not one that is picked up again.
  const [intro, setIntro] = useState(!a.tournament && !a.result);
  if (a.result) {
    return (
      <Result
        career={career}
        a={a}
        onDone={() => {
          commit(closeEvent(career));
          onHub();
        }}
      />
    );
  }
  if (intro) return <EventIntro tier={TIERS[a.tier]} onDone={() => setIntro(false)} />;
  return (
    <TournamentApp
      onExitToHome={onHub}
      career={{
        draw: a.tournament ? null : a.entrants,
        cup: a.cup,
        tournament: a.tournament,
        onChange: (t) => commit(setTournament(career, t)),
        onDone: () => commit(finishEvent(career, new Date().toISOString())),
        cost: a.cost,
        level: levelOfMed(career.skillMed),
        prizes: TIERS[a.tier].prizes,
        onAbandon: () => {
          commit(abandonEvent(career));
          onHub();
        },
      }}
    />
  );
}

/** A challenge: who it is, the game and the stake, then the game itself, then what it came to. */
function ChallengePlay({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
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
      <div className="animate-screen-enter screen">
        <div className="screen-inner">
          <ScreenTop title="Utfordring" onBack={giveUp} backLabel="Si nei" />
          <div className="flex flex-col items-center text-center my-6">
            <Avatar name={c.opponent.name} size="xl" bot />
            <p className="section-label mt-4">UTFORDRER DEG</p>
            <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "clamp(1.8rem, 9vw, 2.6rem)", lineHeight: 1.05 }}>
              {c.opponent.name}
            </h1>
            <p style={{ color: "var(--color-text-2)" }}>
              {GAMES[c.game].name} · {GAMES[c.game].about}
            </p>
          </div>
          <Card className="mb-4 text-center">
            <p className="section-label mb-1">INNSATS</p>
            <p className="num" style={{ fontSize: "var(--text-num)", color: "var(--color-gold-strong)" }}>
              {dollars(c.stake)}
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Vinn og pengene er dine. Taper du, koster det ingenting.</p>
          </Card>
          <Button block variant="primary" size="lg" onClick={() => setPlaying(true)}>
            Spill {GAMES[c.game].name} mot {c.opponent.name}
          </Button>
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
      <div className="screen-inner relative z-10">
        <div className="flex flex-col items-center text-center mb-5 mt-6">
          <Avatar name={career.player} photo={roster.find((x) => x.name === career.player)?.photo} size="xl" state={won ? "winner" : "idle"} />
          <p className="section-label mt-4">{GAMES[c.game].name.toUpperCase()} MOT {c.opponent.name.toUpperCase()}</p>
          <h1 className="font-display" style={{ color: won ? "var(--color-gold)" : "var(--color-cream)", fontSize: "clamp(2rem, 10vw, 3rem)", lineHeight: 1.05 }}>
            {won ? "Du vant" : "Du tapte"}
          </h1>
        </div>
        <ul className="space-y-2 mb-6" aria-label="Oppgjør">
          <li className="flex items-baseline justify-between" style={{ padding: "0.6rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <span style={{ color: "var(--color-text-2)" }}>Innsats</span>
            <span className="tabular font-bold">{won ? signed(c.stake) : dollars(0)}</span>
          </li>
          <li className="flex items-baseline justify-between" style={{ padding: "0.6rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)" }}>
            <span style={{ color: "var(--color-gold-strong)" }}>Saldo</span>
            <span className="num" style={{ fontSize: "var(--text-title)", color: "var(--color-gold-strong)" }}>
              <CountUp value={career.money} format={dollars} />
            </span>
          </li>
        </ul>
        <Button block variant="primary" size="lg" onClick={onDone}>
          Til rommet
        </Button>
      </div>
    </div>
  );
}

/** The banner that comes up when a result opens the next step of the road. */
function UnlockBanner({ label, name, colour }: { label: string; name: string; colour: string }) {
  useEffect(() => {
    const t = setTimeout(() => careerSound("unlock"), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" className="unlock-banner mb-4 text-center" style={{ borderColor: colour, color: colour }}>
      <span className="section-label block" style={{ color: colour }}>
        {label}
      </span>
      <span className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
        {name}
      </span>
    </div>
  );
}

function Result({ career, a, onDone }: { career: Career; a: ActiveEvent; onDone: () => void }) {
  const r = a.result!;
  const tier = TIERS[a.tier];
  const won = r.place === "winner";
  const roster = useRoster();
  const opened = tier.opens && tier.opens.places.includes(r.place) ? TIERS[tier.opens.tier] : null;
  const record = roster.find((x) => x.name === career.player);
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
      <div className="screen-inner relative z-10">
        {won ? (
          // The ceremony: the trophy rises over the player, the player in their own shirt, and then the name of the cup and what it paid.
          <div className="flex flex-col items-center text-center mb-5 mt-2">
            <div className="trophy-soft w-full">
              <Trophy cannons={fx.confetti} />
            </div>
            <div className="final-fade flex items-center gap-3 -mt-1" style={{ "--d": "0.9s" } as React.CSSProperties}>
              <Avatar name={career.player} photo={record?.photo} px={128} state="winner" />
              {record && <TeamKit kit={teamKitsOf(record).home} size={72} title="Skjorten din" />}
            </div>
            <p className="section-label mt-4 final-fade" style={{ "--d": "1.3s", color: "var(--color-gold)" } as React.CSSProperties}>
              {tier.name.toUpperCase()} · MESTER
            </p>
            <h1 className="font-display intro-slam" style={{ "--d": "1.5s", color: "var(--color-gold)", fontSize: "clamp(2.4rem, 13vw, 3.8rem)", lineHeight: 1.05 } as React.CSSProperties}>
              {career.player}
            </h1>
            <p className="final-fade" style={{ "--d": "1.9s", color: "var(--color-cream)" } as React.CSSProperties}>
              vinner {tier.trophy}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center mb-5 mt-6">
            <Avatar name={career.player} photo={record?.photo} size="xl" state="idle" />
            <p className="section-label mt-4">{tier.name.toUpperCase()}</p>
            <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "clamp(2rem, 10vw, 3rem)", lineHeight: 1.05 }}>
              {PLACE_LABEL[r.place]}
            </h1>
          </div>
        )}
        <ul className="space-y-2 mb-4" aria-label="Oppgjør">
          {[
            ["Inngang", signed(-r.cost)],
            ["Premie", signed(r.prize)],
            ["Rankingpoeng", `+${r.points}`],
          ].map(([label, value]) => (
            <li key={label} className="flex items-baseline justify-between" style={{ padding: "0.6rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <span style={{ color: "var(--color-text-2)" }}>{label}</span>
              <span className="tabular font-bold">{value}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between" style={{ padding: "0.6rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)" }}>
            <span style={{ color: "var(--color-gold-strong)" }}>Saldo</span>
            <span className="num" style={{ fontSize: "var(--text-title)", color: "var(--color-gold-strong)" }}>
              <CountUp value={career.money} format={dollars} />
            </span>
          </li>
        </ul>
        {won && a.tournament && (
          <section className="mb-4" aria-label="Veien til pokalen" style={{ padding: "0.75rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <p className="section-label mb-2">VEIEN</p>
            <ol className="space-y-1">
              {roadOf(a.tournament, career.player)
                .filter((x) => !x.match.isBye)
                .map((x) => (
                  <li key={x.match.id} className="flex justify-between gap-3" style={{ fontSize: "var(--text-small)" }}>
                    <span style={{ color: "var(--color-muted)" }}>{roundName(x.match)}</span>
                    <span style={{ color: "var(--color-cream)", fontWeight: 600 }}>slo {x.opponent}</span>
                  </li>
                ))}
            </ol>
          </section>
        )}
        {opened && <UnlockBanner label="NY TURNERING ÅPNET" name={opened.name} colour={cupColor(opened.kind)} />}
        {newRank && <UnlockBanner label="NY TITTEL" name={newRank} colour="var(--color-gold)" />}
        {r.prize > 0 && <CoinBurst />}
        <Button block variant="primary" size="lg" onClick={onDone}>
          Til rommet
        </Button>
      </div>
    </div>
  );
}

/** A training session: fifteen rounds at the treble 20 written in, and then what it says about the level. */
function TrainingPlay({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
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
    const move = done.after - done.before;
    return (
      <div className="animate-screen-enter screen">
        <div className="screen-inner">
          <ScreenTop title="Trening" onBack={onHub} backLabel="Hjem" />
          <Card className="mb-4 text-center">
            <p className="section-label mb-1">SNITT PER RUNDE</p>
            <p className="num" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
              {oneDecimal(done.average)}
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Det tilsvarer MED {oneDecimal(done.measured)} mm</p>
          </Card>
          <Card className="mb-4 text-center">
            <p className="section-label mb-1">NIVÅET DITT</p>
            <p className="num tabular" style={{ fontSize: "var(--text-num)", color: "var(--color-gold-strong)" }}>
              {oneDecimal(done.before)} → {oneDecimal(done.after)} mm
            </p>
            <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
              {Math.abs(move) < 0.05 ? "Uendret. Du kastet som nivået sier." : move < 0 ? "Du ble skarpere. Motstanderne blir litt sterkere." : "Du var litt unøyaktig i dag. Motstanderne blir litt svakere."} {levelLabel(done.after)}.
            </p>
          </Card>
          <Button block variant="primary" size="lg" onClick={onHub}>
            Tilbake til rommet
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner">
        <ScreenTop title="Trebling 20" onBack={onHub} backLabel="Avbryt" />
        <div className="mb-3" role="progressbar" aria-valuemin={0} aria-valuemax={DRILL_ROUNDS} aria-valuenow={rounds.length} aria-label="Runder kastet" style={{ height: "0.5rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)" }}>
          <div style={{ width: `${(rounds.length / DRILL_ROUNDS) * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: "var(--color-teal)", transition: "width var(--pull)" }} />
        </div>
        <ScoreKeypad
          onSubmit={submit}
          onUndo={() => setRounds((r) => r.slice(0, -1))}
          canUndo={rounds.length > 0}
          line={() => (
            <span style={{ color: "var(--color-text-2)" }}>
              Runde {rounds.length + 1} av {DRILL_ROUNDS} · tre piler mot trebling 20 · skriv summen
            </span>
          )}
        />
      </div>
    </div>
  );
}
