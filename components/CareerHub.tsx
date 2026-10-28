"use client";

import { useState } from "react";
import { DRILL_ROUNDS } from "@/lib/training";
import {
  GAMES,
  LADDER,
  PLACE_LABEL,
  SLOTS,
  TIERS,
  arenaBonus,
  buyPlace,
  buyUpgrade,
  dollars,
  nextPlace,
  nextPrice,
  offerChallenge,
  startEvent,
  stakeFor,
  whyNot,
  whyNotBuy,
  whyNotMove,
  type Career,
  type GameId,
  type SlotId,
} from "@/lib/career";
import { goalsOf } from "@/lib/careerGoals";
import { heroFor } from "@/lib/careerHero";
import { levelLabel, newSeed, oneDecimal, signed, dartsName, homeName } from "./careerFormat";
import { CareerGoals } from "./CareerGoals";
import { CareerHero } from "./CareerHero";
import { CareerProfile } from "./CareerProfile";
import { CareerHud } from "./CareerHud";
import { CareerTip } from "./CareerTip";
import { CareerRoad } from "./CareerRoad";
import { CareerTabBar, type CareerTab } from "./CareerTabBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { HomeScene } from "./HomeScene";
import { MoreIcon } from "./icons";
import { uiFeedback } from "@/lib/uiSound";
import { ScreenTop } from "./ScreenTop";
import { TeamKit } from "./TeamKit";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";
import { teamKitsOf, useRoster } from "@/lib/storage";

const TITLE: Record<CareerTab, string> = { home: "Karriere", arena: "Hjemmearena", tournaments: "Turneringer", training: "Trening", challenges: "Utfordringer" };

/**
 * The home of a career: the room is the background, the money, points and titles are always at the top, and the place to go next is one tap away
 * in the bar along the bottom. The tournaments are the big thing here (the hero card, the road, the raised button); training, the arena and the
 * challenges are smaller on purpose. The rules for every button: the main one is at the bottom of what is shown and says what happens, the
 * others are smaller, and what costs something to undo sits behind the three dots.
 */
export function Hub({ career, onBack, onPlay, onChallenge, onTrain, commit, onDelete }: { career: Career; onBack: () => void; onPlay: () => void; onChallenge: () => void; onTrain: () => void; commit: (c: Career) => void; onDelete: () => void }) {
  const [tab, setTab] = useState<CareerTab>("home");
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The thing just bought flashes in the picture for a moment.
  const [pop, setPop] = useState<SlotId | null>(null);
  const roster = useRoster();
  const record = roster.find((r) => r.name === career.player);
  const hero = heroFor(career);
  const goals = goalsOf(career);
  // Something beyond the pub is open and has not been entered: the tournaments button says so.
  const somethingOpen = !career.active && !career.challenge && LADDER.some((t) => t.id !== "lu" && whyNot(career, t) === null);

  const press = () => {
    uiFeedback("click");
    if (hero.kind === "enter") {
      commit(startEvent(career, hero.tier.id, newSeed()));
      onPlay();
    } else if (hero.kind === "event") onPlay();
    else onChallenge();
  };

  return (
    <div className="animate-screen-push screen" style={{ paddingBottom: "7rem" }}>
      {menu && (
        <Sheet title="Karriere" onClose={() => setMenu(false)}>
          <div className="space-y-2">
            <Button
              block
              onClick={() => {
                setMenu(false);
                setProfile(true);
              }}
            >
              Profil og pokaler
            </Button>
            <Button block onClick={onBack}>
              Alle karrierer
            </Button>
            <Button
              block
              variant="ghost"
              onClick={() => {
                setMenu(false);
                setConfirmDelete(true);
              }}
            >
              <span style={{ color: "var(--color-red)" }}>Slett karrieren</span>
            </Button>
          </div>
        </Sheet>
      )}
      {profile && (
        <Sheet title="Profil" onClose={() => setProfile(false)}>
          <CareerProfile career={career} />
        </Sheet>
      )}
      {confirmDelete && (
        <ConfirmDialog
          message={`Slette karrieren til ${career.player}? Saldo, pokaler og alt du har kjøpt er borte.`}
          buttons={[
            { label: "Behold", onClick: () => setConfirmDelete(false), background: "var(--color-green)" },
            { label: "Slett karriere", onClick: onDelete, background: "var(--color-red)" },
          ]}
        />
      )}
      <div className="screen-inner">
        <ScreenTop
          title={TITLE[tab]}
          onBack={tab === "home" ? undefined : () => setTab("home")}
          backLabel="Hjem"
          right={
            <span className="inline-flex items-center gap-2">
              {record && tab === "home" ? <TeamKit kit={teamKitsOf(record).home} size={36} title="Skjorten din" /> : null}
              <button type="button" onClick={() => setMenu(true)} aria-label="Meny" className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
                <MoreIcon className="w-5 h-5" />
              </button>
            </span>
          }
          sub={<CareerHud career={career} />}
        />

        {tab === "home" && (
          <div key="home" className="animate-screen-enter space-y-4">
            <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} />
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              {career.player} · {homeName(career.profile.home)} · {dartsName(career.profile.darts)} dart
            </p>
            <CareerTip id="home">Velkommen til rommet ditt. Her er turneringen du kan spille nå. Den første er gratis, og pengene du vinner bruker du på rommet.</CareerTip>
            <CareerHero hero={hero} onPress={press} />
            <CareerGoals goals={goals} />
            {career.trophies.length > 0 && (
              <section aria-label="Pokaler">
                <p className="section-label mb-2">POKALER · {career.trophies.length}</p>
                <ul className="space-y-1">
                  {career.trophies.slice(0, 5).map((t) => (
                    <li key={t.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                      <span className="truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>
                        {TIERS[t.tier].trophy}
                      </span>
                      <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                        {t.at.slice(0, 10)} · {dollars(t.prize)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {career.history.length > 0 && (
              <section aria-label="Siste">
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
          </div>
        )}

        {tab === "tournaments" && (
          <div key="tournaments" className="animate-screen-enter space-y-4">
            <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} compact />
            <CareerTip id="road">Dette er veien fra puben til VM. De første er åpne, resten låser du opp ved å gjøre det bra i den forrige. Trykk på en for å se hva den betaler.</CareerTip>
            <CareerRoad
              career={career}
              focus={hero.kind === "challenge" ? "lu" : hero.tier.id}
              onEnter={(tier) => {
                commit(startEvent(career, tier.id, newSeed()));
                onPlay();
              }}
              onContinue={onPlay}
            />
          </div>
        )}

        {tab === "arena" && (
          <>
            <div className="mb-4">
              <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} pop={pop} />
            </div>
            <div className="mb-3">
              <CareerTip id="arena">Det du kjøper her gjør rommet bedre og motstanderne litt svakere. Du kaster fortsatt selv.</CareerTip>
            </div>
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
                    uiFeedback("confirm");
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
                              uiFeedback("confirm");
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

        {tab === "training" && (
          <>
            <div className="mb-4">
              <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} compact />
            </div>
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
                Start treningen
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

        {tab === "challenges" && (
          <>
            <div className="mb-4">
              <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} compact />
            </div>
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
                    {career.challenge?.game === game || career.active || career.challenge ? (
                      <Button block disabled>
                        {career.active ? "Turnering pågår" : career.challenge?.game === game ? "Utfordring pågår" : "Fullfør den andre utfordringen først"}
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
                        Spill {GAMES[game].name} · vinn {dollars(stakeFor(career, game))}
                      </Button>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <CareerTabBar current={tab} onPick={(t) => { uiFeedback("pick"); setTab(t); }} pulse={somethingOpen} />
    </div>
  );
}
