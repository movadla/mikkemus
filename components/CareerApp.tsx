"use client";

import { useEffect, useMemo, useState } from "react";
import { cupColor } from "@/lib/botCup";
import {
  DARTS,
  GAMES,
  HOMES,
  PLACES,
  SLOTS,
  buyPlace,
  nextPlace,
  whyNotMove,
  arenaBonus,
  arenaSteps,
  buyUpgrade,
  nextPrice,
  whyNotBuy,
  type SlotId,
  LADDER,
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
  offerChallenge,
  setTournament,
  settleChallenge,
  stakeFor,
  startEvent,
  whyNot,
  type ActiveEvent,
  type Career,
  type Challenge,
  type DartsId,
  type GameId,
  type HomeId,
  type Tier,
} from "@/lib/career";
import { DRILL_ROUNDS, sessionFrom, trainCareer } from "@/lib/training";
import { newGame as newCountdown, winnerOf as countdownWinner } from "@/lib/countdown";
import { newGame as newHighstriker, winnerOf as highstrikerWinner } from "@/lib/highstriker";
import { newGame as newLava, stateOf as lavaState } from "@/lib/lava";
import { DEFAULT_LIVES } from "@/lib/lava";
import { deleteCareer, loadCareers, saveCareer } from "@/lib/careerStorage";
import { setKits, teamKitsOf, useRoster } from "@/lib/storage";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { ConfirmDialog } from "./ConfirmDialog";
import { Trophy } from "./Trophy";
import { CountdownGameScreen } from "./CountdownApp";
import { EventIntro } from "./EventIntro";
import { ScoreKeypad } from "./ScoreKeypad";
import { HighstrikerGameScreen } from "./HighstrikerApp";
import { HomeScene } from "./HomeScene";
import { LavaGameScreen } from "./LavaApp";
import { KitEditor } from "./KitSettings";
import { ScreenTop } from "./ScreenTop";
import { TeamKit } from "./TeamKit";
import { TournamentApp } from "./TournamentApp";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CountUp } from "./ui/CountUp";
import { CupEmblem } from "./ui/CupEmblem";
import { SkeletonRows } from "./ui/Skeleton";
import { FOCUS_RING } from "./ui/focus";

const newSeed = () => Math.floor(Math.random() * 1_000_000_000);
const signed = (n: number) => (n > 0 ? `+${dollars(n)}` : dollars(n));
const homeName = (id: HomeId) => HOMES.find((h) => h.id === id)?.name ?? PLACES.find((p) => p.id === id)?.name ?? "";
const dartsName = (id: DartsId) => DARTS.find((d) => d.id === id)?.name ?? "";

/**
 * Karriere: play events against bots for dollars and ranking points (CAREER_PLAN.md). One career per person. An event is the app's own
 * cup, played with the Mikke Mus game, so the draw, the bracket and the champion are the ones of the tournaments. The career is saved after
 * every result, so an event can be left and picked up again, on this phone or another.
 */
export function CareerApp({ onExitToHome }: { onExitToHome: () => void }) {
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

type View = "home" | "tournaments" | "challenges" | "arena" | "training";

/** The name of the start level a MED is nearest to, for telling the player where they stand. */
const levelLabel = (med: number) => [...START_LEVELS].sort((a, b) => Math.abs(a.med - med) - Math.abs(b.med - med))[0].name;
const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");

/** A row of the status: the money, the points, the titles. */
function Status({ career }: { career: Career }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4 text-center" role="group" aria-label="Status">
      {[
        ["Saldo", <CountUp key="m" value={career.money} format={dollars} />],
        ["Rankingpoeng", <CountUp key="p" value={career.points} />],
        ["Titler", String(career.titles)],
      ].map(([label, value]) => (
        <div key={String(label)} style={{ padding: "0.5rem 0.25rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <span className="num block" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
            {value}
          </span>
          <span style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** One of the three things to do at home: a big button with a line under it. */
function Door({ title, about, onClick, disabled }: { title: string; about: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`tactile w-full text-left ${FOCUS_RING}`} style={{ padding: "0.8rem 1rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", minHeight: "var(--control-lg)", opacity: disabled ? 0.55 : 1 }}>
      <span className="block font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
        {title}
      </span>
      <span className="block" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
        {about}
      </span>
    </button>
  );
}

function Hub({ career, onBack, onPlay, onChallenge, onTrain, commit, onDelete }: { career: Career; onBack: () => void; onPlay: () => void; onChallenge: () => void; onTrain: () => void; commit: (c: Career) => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<View>("home");
  // The thing just bought flashes in the picture for a moment.
  const [pop, setPop] = useState<SlotId | null>(null);
  const roster = useRoster();
  const record = roster.find((r) => r.name === career.player);
  const active = career.active;
  const challenge = career.challenge;

  const title = view === "training" ? "Trening" : view === "tournaments" ? "Turneringer" : view === "challenges" ? "Utfordringer" : view === "arena" ? "Hjemmearena" : "Karriere";
  return (
    <div className="animate-screen-push screen">
      {confirmDelete && (
        <ConfirmDialog
          message={`Slette karrieren til ${career.player}?`}
          buttons={[
            { label: "Behold", onClick: () => setConfirmDelete(false), background: "var(--color-green)" },
            { label: "Slett karriere", onClick: onDelete, background: "var(--color-red)" },
          ]}
        />
      )}
      <div className="screen-inner">
        <ScreenTop
          title={title}
          onBack={view === "home" ? onBack : () => setView("home")}
          backLabel={view === "home" ? "Alle karrierer" : "Hjem"}
          right={record ? <TeamKit kit={teamKitsOf(record).home} size={40} title="Skjorten din" /> : undefined}
          sub={
            <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              {career.player} · {homeName(career.profile.home)} · {dartsName(career.profile.darts)} dart
            </span>
          }
        />
        <div className="mb-4">
          <HomeScene home={career.profile.home} arena={career.arena} pop={pop} compact={view !== "home" && view !== "arena"} />
        </div>
        <Status career={career} />

        {view === "home" && (
          <>
            {(active || challenge) && (
              <Card className="mb-4">
                <p className="section-label mb-1">PÅGÅR</p>
                <h2 className="font-display mb-3" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                  {active ? TIERS[active.tier].name : `${GAMES[challenge!.game].name} mot ${challenge!.opponent.name}`}
                </h2>
                <Button block variant="primary" size="lg" onClick={active ? onPlay : onChallenge}>
                  {(active ? active.result : challenge!.won !== null) ? "Se resultatet" : "Fortsett"}
                </Button>
              </Card>
            )}
            <div className="space-y-2 mb-4" aria-label="Hva vil du gjøre">
              <Door title="Trening" about="Kast 15 runder og la nivået ditt følge kastingen" onClick={() => setView("training")} />
              <Door title="Hjemmearena" about={arenaSteps(career) === 0 ? "Bygg opp rommet: lys, brett, pynt og publikum" : `${arenaSteps(career)} av 18 trinn kjøpt`} onClick={() => setView("arena")} />
              <Door title="Turneringer" about={`${LADDER.length} å velge mellom, fra Lü til VM`} onClick={() => setView("tournaments")} />
              <Door title="Utfordringer" about="501, Lava og Highstriker om penger" onClick={() => setView("challenges")} />
            </div>
            {career.history.length > 0 && (
              <section className="mb-6" aria-label="Siste">
                <p className="section-label mb-2">SISTE</p>
                <ul className="space-y-1">
                  {career.history.slice(0, 3).map((h) => (
                    <li key={h.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                      <span className="truncate">{h.place ? `${h.event} · ${PLACE_LABEL[h.place]}` : `${h.event} · ${h.won ? "vant" : "tapt"}`}</span>
                      <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                        {signed(h.prize - h.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="mt-6 text-center">
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                Slett karrieren
              </Button>
            </div>
          </>
        )}

        {view === "tournaments" && (
          <ul className="space-y-3 mb-6" aria-label="Turneringer">
            {LADDER.map((tier) => (
              <TournamentCard
                key={tier.id}
                career={career}
                tier={tier}
                onEnter={() => {
                  commit(startEvent(career, tier.id, newSeed()));
                  onPlay();
                }}
                onContinue={onPlay}
              />
            ))}
          </ul>
        )}

        {view === "training" && (
          <>
            <Card className="mb-4">
              <p className="section-label mb-1">DITT NIVÅ</p>
              <p className="num" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
                {levelLabel(career.skillMed)}
              </p>
              <p className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                MED {oneDecimal(career.skillMed)} mm · motstanderne settes ut fra dette
              </p>
            </Card>
            <Card className="mb-4">
              <h2 className="font-display mb-1" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                Trebling 20
              </h2>
              <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
                Kast tre piler mot trebling 20, {DRILL_ROUNDS} ganger, og skriv inn summen av hver runde. Det tar ca. 8 minutter. Resultatet flytter nivået ditt litt, så motstanderne passer til hvordan du faktisk kaster. Penger kan ikke gjøre kastet bedre, bare rommet.
              </p>
              <Button block variant="primary" size="lg" onClick={onTrain}>
                Start økten
              </Button>
            </Card>
            {career.training.length > 0 && (
              <section className="mb-6" aria-label="Siste økter">
                <p className="section-label mb-2">SISTE ØKTER</p>
                <ul className="space-y-1">
                  {career.training.slice(0, 5).map((t) => (
                    <li key={t.at} className="flex items-baseline justify-between gap-3 tabular" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                      <span>snitt {oneDecimal(t.average)} per runde</span>
                      <span style={{ color: "var(--color-muted)" }}>
                        {oneDecimal(t.before)} → {oneDecimal(t.after)} mm
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {view === "arena" && (
          <>
            <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
              {arenaBonus(career) === 1 ? "Et bedre rom gjør motstanderne litt svakere. Det er fortsatt du som kaster." : `Motstanderne er ${((arenaBonus(career) - 1) * 100).toFixed(1).replace(".", ",")} % svakere på grunn av rommet.`}
            </p>
            {nextPlace(career) && (
              <Card className="mb-4">
                <p className="section-label mb-1">NYTT STED</p>
                <h2 className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                  {nextPlace(career)!.name}
                </h2>
                <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  {nextPlace(career)!.about}. Alt du har kjøpt flytter med, og stedet i seg selv gjør motstanderne {(nextPlace(career)!.bonus * 100).toFixed(0)} % svakere.
                </p>
                <Button
                  block
                  variant="primary"
                  disabled={!!whyNotMove(career)}
                  onClick={() => {
                    commit(buyPlace(career));
                    setPop("wall");
                    setTimeout(() => setPop(null), 1500);
                  }}
                >
                  Kjøp for {dollars(nextPlace(career)!.price)}
                </Button>
                {whyNotMove(career) && (
                  <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                    {whyNotMove(career)}
                  </p>
                )}
              </Card>
            )}
            <ul className="space-y-3 mb-6" aria-label="Hjemmearena">
              {SLOTS.map((slot) => {
                const step = career.arena[slot.id];
                const price = nextPrice(career, slot.id);
                const why = whyNotBuy(career, slot.id);
                return (
                  <li key={slot.id}>
                    <Card>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <h2 className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                          {slot.name}
                        </h2>
                        <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                          {step} av 3
                        </span>
                      </div>
                      <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>{slot.steps[step]}</p>
                      {price === null ? (
                        <p className="mt-2" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-small)" }}>
                          Fullt utbygd
                        </p>
                      ) : (
                        <>
                          <p className="mt-2 mb-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                            Neste: {slot.steps[step + 1]}
                          </p>
                          <Button
                            block
                            variant="primary"
                            disabled={!!why}
                            onClick={() => {
                              commit(buyUpgrade(career, slot.id));
                              setPop(slot.id);
                              setTimeout(() => setPop(null), 1500);
                            }}
                          >
                            Kjøp for {dollars(price)}
                          </Button>
                          {why && (
                            <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                              {why}
                            </p>
                          )}
                        </>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {view === "challenges" && (
          <ul className="space-y-3 mb-6" aria-label="Utfordringer">
            {(Object.keys(GAMES) as GameId[]).map((game) => (
              <li key={game}>
                <Card>
                  <h2 className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                    {GAMES[game].name}
                  </h2>
                  <p className="mb-2" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                    {GAMES[game].about} · ca. {GAMES[game].minutes} min
                  </p>
                  <p className="mb-3 tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                    Vinn {dollars(stakeFor(career, game))} · ingen inngang
                  </p>
                  {challenge?.game === game || active || challenge ? (
                    <Button block disabled>
                      {active ? "Turnering pågår" : challenge?.game === game ? "Utfordring pågår" : "Fullfør den andre utfordringen først"}
                    </Button>
                  ) : (
                    <Button
                      block
                      variant="primary"
                      onClick={() => {
                        commit(offerChallenge(career, game, newSeed()));
                        onChallenge();
                      }}
                    >
                      Utfordre
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A step of the ladder: what it is, what it costs and pays, and whether the player can sign up. */
function TournamentCard({ career, tier, onEnter, onContinue }: { career: Career; tier: Tier; onEnter: () => void; onContinue: () => void }) {
  const mine = career.active?.tier === tier.id;
  const why = mine ? null : whyNot(career, tier);
  const colour = cupColor(tier.kind);
  return (
    <li>
      <Card>
        <div className="flex items-center gap-3 mb-2">
          <span style={{ color: colour }}>
            <CupEmblem kind={tier.kind} className="w-8 h-8" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display truncate" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
              {tier.name}
            </h2>
            <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
              {tier.venue} · {tier.size} spillere · ca. {tier.minutes} min
            </p>
          </div>
        </div>
        <p className="mb-3 tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          Inngang {tier.fee === 0 ? "gratis" : dollars(tier.fee)} · vinneren får {dollars(tier.prizes.winner ?? 0)}
          {tier.qualify && career.qualified.includes(tier.id) ? " · du er kvalifisert" : ""}
        </p>
        {mine ? (
          <Button block variant="primary" onClick={onContinue}>
            {career.active?.result ? "Se resultatet" : "Fortsett"}
          </Button>
        ) : why ? (
          <>
            <Button block disabled>
              Meld deg på
            </Button>
            <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              {why}
            </p>
          </>
        ) : (
          <Button block variant="primary" onClick={onEnter}>
            Meld deg på
          </Button>
        )}
      </Card>
    </li>
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
            Spill
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
          Hjem
        </Button>
      </div>
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
  const fx = fxFlags(useFxLevel());
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={{ "--cup": won ? "var(--color-gold)" : cupColor(tier.kind) } as React.CSSProperties}>
      <div className="screen-inner relative z-10">
        {won ? (
          // The ceremony: the trophy rises over the player, the player in their own shirt, and then the name of the cup and what it paid.
          <div className="flex flex-col items-center text-center mb-5 mt-2">
            <Trophy cannons={fx.confetti} />
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
        {opened && (
          <p className="mb-4 text-center" style={{ color: cupColor(opened.kind), fontWeight: 600 }}>
            Du er kvalifisert til {opened.name}
          </p>
        )}
        <Button block variant="primary" size="lg" onClick={onDone}>
          Hjem
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
            Ferdig
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
