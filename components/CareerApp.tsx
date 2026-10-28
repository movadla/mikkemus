"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DARTS,
  START_LEVELS,
  TIERS,
  abandonEvent,
  careerId,
  closeEvent,
  dollars,
  finishEvent,
  newCareer,
  setTournament,
  type Career,
  type DartsId,
  type HomeId,
} from "@/lib/career";
import { deleteCareer, loadCareers, mergeCareers, readLocalCareers, saveCareer } from "@/lib/careerStorage";
import { setKits, teamKitsOf, useRoster } from "@/lib/storage";
import { applyTheme } from "@/lib/theme";
import { levelOfMed } from "@/lib/botLevels";
import { rankLevel } from "@/lib/careerGoals";
import { CoinIcon } from "./icons";
import { StarIcon } from "./careerIcons";
import { Hub } from "./CareerHub";
import { ChallengePlay, Result, TrainingPlay } from "./CareerScreens";
import { EventIntro } from "./EventIntro";
import { KitEditor } from "./KitSettings";
import { ScreenTop } from "./ScreenTop";
import { TournamentApp } from "./TournamentApp";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
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
  const [careers, setCareers] = // What is on the device is there at once (the career is only ever opened by a tap, so this never runs on the server).
  useState<Career[] | null>(() => (typeof window === "undefined" ? null : readLocalCareers()));
  const [id, setId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [screen, setScreen] = useState<"hub" | "play" | "challenge" | "training">("hub");
  const photos = useMemo(() => new Map(roster.map((r) => [r.name, r.photo])), [roster]);

  useEffect(() => {
    let live = true;
    // What the database has is merged in when it answers (or not at all, with no network).
    void loadCareers().then((list) => live && setCareers((cur) => mergeCareers(cur ?? [], list)));
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
      <div className="animate-screen-push screen career-skin">
        <div className="screen-inner">
          <ScreenTop title="Karriere" onBack={onExitToHome} />
          <ul className="space-y-2 mb-4" aria-label="Karrierer">
            {careers.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setId(c.id)} className={`tactile w-full flex items-center gap-3 text-left ${FOCUS_RING}`} style={{ padding: "0.6rem 0.75rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", minHeight: "var(--control-lg)" }}>
                  <Avatar name={c.player} photo={photos.get(c.player)} size="m" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold">{c.player}</span>
                    <span className="flex items-center gap-3 tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>
                        <CoinIcon className="w-4 h-4" />
                        {dollars(c.money)}
                      </span>
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--color-teal)", fontWeight: 700 }}>
                        <StarIcon className="w-4 h-4" />
                        {rankLevel(c)}
                      </span>
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
  const [darts, setDarts] = useState<DartsId>("middels");
  const record = roster.find((r) => r.name === player);

  if (step === 2 && record) {
    const kits = teamKitsOf(record);
    return (
      <div className="animate-screen-push screen has-sticky-action career-skin">
        <div className="screen-inner">
          <ScreenTop title="Utseende" onBack={() => setStep(1)} sub={<span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{record.name}</span>} />
          <Steps step={2} />
          <KitEditor label="SKJORTE" kit={kits.home} onChange={(kit) => setKits(record.name, { ...kits, home: kit })} name={record.name} />
          <p className="section-label mb-2">PILER</p>
          <div className="space-y-2 mb-5" role="radiogroup" aria-label="Piler">
            {DARTS.map((d) => (
              <Choice key={d.id} selected={darts === d.id} onPick={() => setDarts(d.id)} title={d.name} about={d.about} />
            ))}
          </div>
          <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
            Neste er din første turnering: Ly-cupen på puben. Den er gratis.
          </p>
          <Button block variant="primary" size="lg" onClick={() => onCreate(record.name, level, { home: "garage", darts })}>
            Start karrieren
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-screen-push screen has-sticky-action career-skin">
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
        <div className="space-y-2 mb-6" role="radiogroup" aria-label="Treffsikkerhet">
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

