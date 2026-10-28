"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DARTS,
  HOMES,
  PLACE_LABEL,
  START_LEVELS,
  TIERS,
  abandonEvent,
  careerId,
  closeEvent,
  dollars,
  entryCost,
  finishEvent,
  newCareer,
  setTournament,
  startEvent,
  type ActiveEvent,
  type Career,
  type DartsId,
  type HomeId,
} from "@/lib/career";
import { deleteCareer, loadCareers, saveCareer } from "@/lib/careerStorage";
import { setKits, teamKitsOf, useRoster } from "@/lib/storage";
import { ConfirmDialog } from "./ConfirmDialog";
import { KitEditor } from "./KitSettings";
import { PubScene } from "./PubScene";
import { ScreenTop } from "./ScreenTop";
import { TeamKit } from "./TeamKit";
import { TournamentApp } from "./TournamentApp";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CountUp } from "./ui/CountUp";
import { SkeletonRows } from "./ui/Skeleton";
import { FOCUS_RING } from "./ui/focus";

const signed = (n: number) => (n > 0 ? `+${dollars(n)}` : dollars(n));
const homeName = (id: HomeId) => HOMES.find((h) => h.id === id)?.name ?? "";
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
  const [screen, setScreen] = useState<"hub" | "play">("hub");
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
  return <Hub career={career} onBack={() => setId(null)} onPlay={() => setScreen("play")} commit={commit} onDelete={() => remove(career)} />;
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

function Hub({ career, onBack, onPlay, commit, onDelete }: { career: Career; onBack: () => void; onPlay: () => void; commit: (c: Career) => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const roster = useRoster();
  const record = roster.find((r) => r.name === career.player);
  const tier = TIERS.lu;
  const active = career.active;
  const cost = entryCost(career, tier);
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
          title="Karriere"
          onBack={onBack}
          backLabel="Alle karrierer"
          right={record ? <TeamKit kit={teamKitsOf(record).home} size={40} title="Skjorten din" /> : undefined}
          sub={
            <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              {career.player} · {homeName(career.profile.home)} · {dartsName(career.profile.darts)} dart
            </span>
          }
        />
        <div className="mb-4">
          <PubScene />
        </div>
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
        <Card className="mb-4">
          <p className="section-label mb-1">{active ? "PÅGÅR" : "NESTE TURNERING"}</p>
          <h2 className="font-display mb-1" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
            {tier.name}
          </h2>
          <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            {tier.venue} · {tier.size} spillere · ca. {tier.minutes} min
          </p>
          {active ? (
            <Button block variant="primary" size="lg" onClick={onPlay}>
              {active.result ? "Se resultatet" : "Fortsett"}
            </Button>
          ) : (
            <>
              <p className="mb-3 tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                Inngang {dollars(tier.fee)} · vinneren får {dollars(tier.prizes.winner)}
                {cost < tier.fee ? " · du slipper inn på kreditt" : ""}
              </p>
              <Button
                block
                variant="primary"
                size="lg"
                onClick={() => {
                  commit(startEvent(career, "lu", Math.floor(Math.random() * 1_000_000_000)));
                  onPlay();
                }}
              >
                Meld deg på
              </Button>
            </>
          )}
        </Card>
        {career.history.length > 0 && (
          <section className="mb-6" aria-label="Siste turneringer">
            <p className="section-label mb-2">SISTE</p>
            <ul className="space-y-1">
              {career.history.slice(0, 3).map((h) => (
                <li key={h.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                  <span className="truncate">
                    {h.event} · {PLACE_LABEL[h.place]}
                  </span>
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
      </div>
    </div>
  );
}

function Play({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const a = career.active!;
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

function Result({ career, a, onDone }: { career: Career; a: ActiveEvent; onDone: () => void }) {
  const r = a.result!;
  const tier = TIERS[a.tier];
  const won = r.place === "winner";
  const roster = useRoster();
  return (
    <div className="animate-screen-enter screen cup-lamp relative overflow-hidden" style={won ? ({ "--cup": "var(--color-gold)" } as React.CSSProperties) : undefined}>
      <div className="screen-inner relative z-10">
        <div className="flex flex-col items-center text-center mb-5 mt-6">
          <Avatar name={career.player} photo={roster.find((x) => x.name === career.player)?.photo} size="xl" state={won ? "winner" : "idle"} />
          <p className="section-label mt-4">{tier.name.toUpperCase()}</p>
          <h1 className="font-display" style={{ color: won ? "var(--color-gold)" : "var(--color-cream)", fontSize: "clamp(2rem, 10vw, 3rem)", lineHeight: 1.05 }}>
            {PLACE_LABEL[r.place]}
          </h1>
        </div>
        <ul className="space-y-2 mb-6" aria-label="Oppgjør">
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
        <Button block variant="primary" size="lg" onClick={onDone}>
          Til Lü
        </Button>
      </div>
    </div>
  );
}
