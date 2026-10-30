"use client";

import { useEffect, useRef, useState } from "react";
import {
  DARTS,
  START_LEVELS,
  careerId,
  dollars,
  eventTier,
  finishEvent,
  sideOf,
  newCareer,
  setTournament,
  type Career,
  type DartsId,
  type HomeId,
} from "@/lib/career";
import { botMed, leaveAbandoned, leaveEvent } from "@/lib/careerWorld";
import { rivalOf } from "@/lib/careerLife";
import { deleteCareer, loadCareers, mergeCareers, readLocalCareers, saveCareer } from "@/lib/careerStorage";
import { ensurePlayer, useRoster } from "@/lib/storage";
import { gameName, gameOf, type CareerGame } from "@/lib/careerGame";
import { GameChoice } from "./GameChoice";
import { InfoDot } from "./ui/InfoDot";
import type { TrainTarget } from "./TrainingPanel";
import { sameName } from "@/lib/people";
import { TextField } from "./ui/TextField";
import { applyTheme } from "@/lib/theme";
import { levelOfMed } from "@/lib/botLevels";
import { rankLevel, rankOf } from "@/lib/careerGoals";
import { hubPicture, tierFor, topStep } from "@/lib/career";
import { lifeOf, seasonOf, weekInSeason } from "@/lib/careerLife";
import { CoinIcon } from "./icons";
import { StarIcon } from "./careerIcons";
import { Hub } from "./CareerHub";
import { ChallengePlay, Result, TrainingPlay } from "./CareerScreens";
import { EventIntro } from "./EventIntro";
import { OpponentPortrait, TeamPortrait } from "./OpponentCard";


import type { Participant } from "@/lib/tournament";
import { rankField } from "@/lib/fieldRank";
import { picturesFor } from "./eventPictures";
import { OverRoom } from "./RoomBackdrop";
import { CharacterFace, CharacterFigure } from "./CharacterFigure";
import { CHARACTERS, DEFAULT_CHARACTER, characterOf } from "@/lib/characters";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";
import { TournamentApp } from "./TournamentApp";
import { Avatar, CareerFaceContext, TeamsContext } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { SkeletonRows } from "./ui/Skeleton";
import { FOCUS_RING } from "./ui/focus";


/**
 * Karriere: play events against bots for dollars and ranking points (CAREER_PLAN.md). One career per person. An event is the app's own
 * cup, played with the Mikke Mus game, so the draw, the bracket and the champion are the ones of the tournaments. The career is saved after
 * every result, so an event can be left and picked up again, on this phone or another.
 */
/** The career is a night in an arena whatever the rest of the app is set to: a dark curtain lifts as it opens, so the change of light looks meant. */
export function CareerApp(props: { onExitToHome: () => void }) {
  return (
    <>
      <CareerAppInner {...props} />
      <span className="career-curtain" aria-hidden />
    </>
  );
}

function CareerAppInner({ onExitToHome }: { onExitToHome: () => void }) {
  // A game of evenings keeps to its night look whatever the rest of the app is set to, and gives the page back when it is left.
  useEffect(() => {
    applyTheme("dark");
    return () => applyTheme();
  }, []);
  const [careers, setCareers] = // What is on the device is there at once (the career is only ever opened by a tap, so this never runs on the server).
  useState<Career[] | null>(() => (typeof window === "undefined" ? null : readLocalCareers()));
  const [id, setId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [screen, setScreen] = useState<"hub" | "play" | "challenge" | "training">("hub");
  const [drill, setDrill] = useState<TrainTarget>("t20");

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
                <button type="button" onClick={() => setId(c.id)} className={`slot tactile ${FOCUS_RING}`}>
                  <span className="slot-scene" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the hall the career is at, from public/career */}
                    <img src={hubPicture(topStep(c))} alt="" draggable={false} />
                    <span className="slot-char">
                      <CharacterFigure id={c.profile.character} />
                    </span>
                  </span>
                  <span className="slot-body">
                    <span className="block truncate font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1.1 }}>
                      {c.player}
                    </span>
                    <span className="flex items-center gap-3 tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>
                        <CoinIcon className="w-4 h-4" />
                        {dollars(c.money)}
                      </span>
                      <span className="inline-flex items-center gap-1" style={{ color: "var(--color-teal)", fontWeight: 700 }}>
                        <StarIcon className="w-4 h-4" />
                        {rankLevel(c)}
                      </span>
                      <span>{gameName(gameOf(c.profile).game)}</span>
                    </span>
                    <span className="block" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                      {rankOf(c)} · sesong {seasonOf(lifeOf(c).week)}, uke {weekInSeason(lifeOf(c).week)}
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
    return <TrainingPlay career={career} commit={commit} drill={drill} onHub={() => setScreen("hub")} />;
  }
  if (screen === "challenge" && career.challenge) {
    return <ChallengePlay career={career} commit={commit} onHub={() => setScreen("hub")} />;
  }
  return <Hub career={career} onBack={() => setId(null)} onExit={onExitToHome} onPlay={() => setScreen("play")} onChallenge={() => setScreen("challenge")} onTrain={(id) => {
    setDrill(id);
    setScreen("training");
  }} commit={commit} onDelete={() => remove(career)} />;
}

/** The three steps of a start: who, what they look like, and the first tournament (which is the pub's, and free). */
function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Hvem er du", "Karakter", "Spill og piler"];
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

/** The story a first career opens with: three pictures, one line each, and a way past them. Seen once per device. */
const STORY = [
  { src: "/career/start-1.jpg", line: "Det begynte ved et kjøkkenbord, med én pil." },
  { src: "/career/start-2.jpg", line: "En kveld tok du bagen og gikk ut døren." },
  { src: "/career/start-3.jpg", line: "Nede i gaten lyste Ly. Første turnering er gratis." },
] as const;
const STORY_KEY = "mikke-mus-career-story";

function StoryIntro({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STORY.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));
  return (
    <OverRoom stage={0} src={STORY[i].src} dim={20}>
      <div className="animate-screen-push" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "0.75rem", minHeight: "100dvh", padding: "1rem 1rem 3rem" }}>
        <p aria-live="polite" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title)", lineHeight: 1.25, color: "var(--color-cream)", textWrap: "balance" }}>
          {STORY[i].line}
        </p>
        <Button block variant="primary" size="lg" onClick={next}>
          {last ? "Start" : "Neste"}
        </Button>
        {!last && (
          <Button block variant="ghost" onClick={onDone}>
            Hopp over
          </Button>
        )}
      </div>
    </OverRoom>
  );
}

/** Two steps: who and how good, then the look and the start (the shirt, the darts, the place). */
type NewCareerProps = { taken: string[]; onBack: () => void; onCreate: (player: string, level: string, profile: { home: HomeId; darts: DartsId; character: string; game: CareerGame; doubleOut: boolean }) => void };

/** The setup happens where the career begins: the pub Ly, dimmed behind the steps. */
function NewCareer(props: NewCareerProps) {
  return (
    <OverRoom stage={0} src="/career/hub-lu.jpg" dim={66} blur={2}>
      <NewCareerSteps {...props} />
    </OverRoom>
  );
}

function NewCareerSteps({ taken, onBack, onCreate }: NewCareerProps) {
  const roster = useRoster();
  const people = roster.filter((r) => r.kind !== "team" && !taken.includes(careerId(r.name)));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [story, setStory] = useState(() => {
    try {
      return !localStorage.getItem(STORY_KEY);
    } catch {
      return false;
    }
  });
  const [player, setPlayer] = useState<string | null>(null);
  const [level, setLevel] = useState("dyktig");
  const [darts, setDarts] = useState<DartsId>("steel");
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  // A swipe over the figure (or an arrow) moves to the next character, round the ring.
  const swipeFrom = useRef<number | null>(null);
  const stepCharacter = (d: number) => {
    const i = CHARACTERS.findIndex((c) => c.id === character);
    setCharacter(CHARACTERS[(i + d + CHARACTERS.length) % CHARACTERS.length].id);
  };
  const [gameSettings, setGameSettings] = useState<{ game: CareerGame; doubleOut: boolean }>({ game: "mm", doubleOut: true });
  // The game and the darts start as they are most likely wanted; changing them is one tap away, not three cards in the way.
  const [changing, setChanging] = useState(false);
  const [dartInfo, setDartInfo] = useState<DartsId | null>(null);
  // A new player typed in here: the career is for someone, and that someone may not be in the list yet. With nobody in the list the field is there at once.
  const [adding, setAdding] = useState(people.length === 0);
  // Whether Neste has been pressed without a player: only then does the screen say one is missing.
  const [tried, setTried] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    const known = roster.find((r) => r.kind !== "team" && sameName(r.name, name));
    if (known && taken.includes(careerId(known.name))) {
      setNameError(`${known.name} har allerede en karriere`);
      return;
    }
    const record = known ?? ensurePlayer(name);
    setPlayer(record.name);
    setAdding(false);
    setNameInput("");
    setNameError("");
  };
  const record = roster.find((r) => r.name === player);

  if (story) {
    return (
      <StoryIntro
        onDone={() => {
          try {
            localStorage.setItem(STORY_KEY, "1");
          } catch {}
          setStory(false);
        }}
      />
    );
  }

  if (step === 3 && record) {
    return (
      <div className="animate-screen-push screen has-sticky-action career-skin wizard">
        <div className="screen-inner">
          <ScreenTop title="Spill og piler" onBack={() => setStep(2)} sub={<span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{record.name}</span>} />
          <Steps step={3} />
          {changing ? (
            <>
            <p className="section-label mb-2">SPILL</p>
            <div className="mb-5">
              <GameChoice {...gameSettings} onChange={setGameSettings} />
            </div>
            <p className="section-label mb-2">PILER</p>
            <div className="dart-pick mb-5" role="radiogroup" aria-label="Piler">
              {DARTS.map((d) => (
                <div key={d.id} className="dart-card-wrap">
                  <button type="button" role="radio" aria-checked={darts === d.id} onClick={() => setDarts(d.id)} className={`dart-card tactile ${FOCUS_RING}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.picture} alt="" className="dart-card-img" draggable={false} />
                    <span className="level-name">{d.name}</span>
                  </button>
                  <InfoDot label={`Om ${d.name}`} open={dartInfo === d.id} onClick={() => setDartInfo(dartInfo === d.id ? null : d.id)} className="dart-info" />
                </div>
              ))}
            </div>
            {dartInfo && <p className="info-line mb-3">{DARTS.find((d) => d.id === dartInfo)?.about}</p>}
            </>
          ) : (
            <div className="card-plain mb-3" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.8rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div className="min-w-0 flex-1">
                <p className="section-label">DU SPILLER</p>
                <p style={{ color: "var(--color-cream)", fontWeight: 700 }}>
                  {gameName(gameSettings.game)} · {DARTS.find((d) => d.id === darts)?.name}
                </p>
              </div>
              <Button onClick={() => setChanging(true)}>Endre</Button>
            </div>
          )}
          <div className="mb-3 rise-in" style={{ padding: "0.8rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-gold)" }}>
            <p className="section-label" style={{ color: "var(--color-gold-strong)" }}>
              FØRSTE TURNERING
            </p>
            <p className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1.1 }}>
              Ly-cupen
            </p>
            <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>Fredagskveld på puben · Gratis</p>
          </div>
          <StickyAction onClick={() => onCreate(record.name, level, { home: "garage", darts, character, ...gameSettings })} ready reason={null}>
            Start karrieren
          </StickyAction>
        </div>
      </div>
    );
  }

  if (step === 2 && record) {
    return (
      <div className="animate-screen-push screen has-sticky-action career-skin wizard">
        <div className="screen-inner">
          <ScreenTop title="Karakter" onBack={() => setStep(1)} sub={<span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{record.name}</span>} />
          <Steps step={2} />
          <p className="section-label mb-2">KARAKTER</p>
          <div className="char-pick mb-5" role="radiogroup" aria-label="Karakter" style={{ "--tint": characterOf(character).tint } as React.CSSProperties}>
            <div
              className="char-pick-stage"
              onPointerDown={(e) => (swipeFrom.current = e.clientX)}
              onPointerUp={(e) => {
                if (swipeFrom.current === null) return;
                const dx = e.clientX - swipeFrom.current;
                swipeFrom.current = null;
                if (Math.abs(dx) > 40) stepCharacter(dx < 0 ? 1 : -1);
              }}
            >
              <button type="button" aria-label="Forrige karakter" className={`char-arrow char-arrow-l tactile ${FOCUS_RING}`} onClick={() => stepCharacter(-1)}>
                ‹
              </button>
              <CharacterFigure key={character} id={character} glow />
              <button type="button" aria-label="Neste karakter" className={`char-arrow char-arrow-r tactile ${FOCUS_RING}`} onClick={() => stepCharacter(1)}>
                ›
              </button>
            </div>
            <div className="char-pick-row">
              {CHARACTERS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={character === c.id} aria-label={c.name} onClick={() => setCharacter(c.id)} className={`char-pick-item tactile ${FOCUS_RING}`} style={{ "--tint": c.tint } as React.CSSProperties}>
                  <CharacterFace id={c.id} px={56} />
                </button>
              ))}
            </div>
            <p className="char-pick-name">{characterOf(character).name}</p>
          </div>
          <StickyAction onClick={() => setStep(3)} ready reason={null}>
            Neste
          </StickyAction>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-screen-push screen has-sticky-action career-skin wizard">
      <div className="screen-inner">
        <ScreenTop title="Ny karriere" onBack={onBack} />
        <p className="section-label mb-2" style={{ color: "var(--color-gold-strong)" }}>
          DIN FØRSTE KVELD PÅ LY
        </p>
        <Steps step={1} />
        <p className="section-label mb-2">HVEM SPILLER</p>
        <div className="player-grid mb-3" role="radiogroup" aria-label="Spiller">
          {people.map((p) => (
            <button key={p.name} type="button" role="radio" aria-checked={player === p.name} onClick={() => setPlayer(p.name)} className={`player-tile tactile ${FOCUS_RING}`}>
              <Avatar name={p.name} photo={p.photo} size="s" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          <button type="button" onClick={() => setAdding(true)} aria-expanded={adding} className={`player-tile player-tile-add tactile ${FOCUS_RING}`}>
            <span aria-hidden className="player-tile-plus">
              +
            </span>
            <span className="truncate">Ny spiller</span>
          </button>
        </div>
        {adding && (
          <div className="flex gap-2 mb-4">
            <div className="flex-1 min-w-0">
              <TextField
                autoFocus
                hideLabel
                value={nameInput}
                onChange={(v) => {
                  setNameInput(v);
                  setNameError("");
                }}
                onEnter={addPlayer}
                placeholder="Spillernavn"
                label="Spillernavn"
                maxLength={24}
                error={nameError}
              />
            </div>
            <Button variant="primary" onClick={addPlayer} disabled={!nameInput.trim()}>
              Legg til
            </Button>
          </div>
        )}
        <p className="section-label mb-2 mt-4">HVOR GOD ER DU</p>
        <div className="level-list mb-2" role="radiogroup" aria-label="Treffsikkerhet">
          {START_LEVELS.map((l, i) => (
            <button key={l.key} type="button" role="radio" aria-checked={level === l.key} onClick={() => setLevel(l.key)} className={`level-row tactile ${FOCUS_RING}`}>
              <span className="level-name">{l.name}</span>
              <span className="level-meter" aria-hidden>
                {START_LEVELS.map((_, j) => (
                  <i key={j} className={j <= i ? "on" : ""} style={{ "--h": `${0.55 + j * 0.3}rem` } as React.CSSProperties} />
                ))}
              </span>
            </button>
          ))}
        </div>
        <p className="level-about mb-6" aria-live="polite">
          {START_LEVELS.find((l) => l.key === level)?.about}
        </p>
        <StickyAction onClick={() => setStep(2)} ready={!!player} reason={tried ? "Velg en spiller" : null} onBlocked={() => setTried(true)}>
          Neste
        </StickyAction>
      </div>
    </div>
  );
}

/**
 * Who is in the field, before the draw, as a ranking by strength: the picture of the favourite, the next ones in a list under it, and the player's own
 * place (with dots over it when it is further down), so it is clear what the player is up against and where they stand.
 */
function FieldPreview({ career, field }: { career: Career; field: Participant[] }) {
  const own = { name: career.player, med: career.skillMed };
  const isMine = (p: Participant) => (p.members ? p.members.some((m) => !m.isBot) : p.name === career.player);
  if (field.filter((p) => !isMine(p)).length === 0) return null;
  const ranked = rankField(field, own);
  const at = ranked.findIndex(isMine);
  const label = (p: Participant) => p.name;
  const face = (p: Participant) => (isMine(p) ? <CharacterFace id={career.profile.character} px={34} /> : p.members ? <TeamPortrait members={p.members.map((m) => m.name)} label={p.name} /> : <OpponentPortrait name={p.name} />);
  // The first three, and the player's own place after dots when it is further down.
  const rows = ranked.slice(0, 3).map((p, i) => ({ n: i + 1, p }));
  const own3 = at > 2 ? { n: at + 1, p: ranked[at] } : null;
  const row = ({ n, p }: { n: number; p: Participant }) => (
    <li key={p.name} className={isMine(p) ? "me" : ""}>
      <span>{n}</span>
      <i className="ev-rank-face">{face(p)}</i>
      <b>{label(p)}</b>
    </li>
  );
  return (
    <div className="ev-field" role="group" aria-label="Rangering">
      <p className="ev-rank-title">RANGERING</p>
      <ol className="ev-rank">
        {rows.map(row)}
        {own3 && (
          <>
            <li className="gap" aria-hidden>
              <span>…</span>
            </li>
            {row(own3)}
          </>
        )}
      </ol>
    </div>
  );
}

function Play({ career, commit, onHub }: { career: Career; commit: (c: Career) => void; onHub: () => void }) {
  const a = career.active!;
  // A cup of teams: the player's side is the team, and each team is drawn with the faces of its two.
  const team = a.invite?.team;
  const side = sideOf(a, career.player);
  const teams = Object.fromEntries(a.entrants.filter((p) => p.members).map((p) => [p.name, p.members!.map((m) => m.name)]));
  // The scene before the draw is only for an event that has just been entered, not one that is picked up again.
  const [intro, setIntro] = useState(!a.tournament && !a.result);
  if (a.result) {
    return (
      <Result
        career={career}
        a={a}
        onDone={() => {
          commit(leaveEvent(career));
          onHub();
        }}
      />
    );
  }
  if (intro) {
    // The step with the fee this player pays (the travel takes some off).
    const tier = tierFor(career, eventTier(a));
    return (
      <EventIntro
        tier={tier}
        player={career.player}
        character={career.profile.character}
        onDone={() => setIntro(false)}
        extra={<FieldPreview career={career} field={a.entrants} />}
        plain
        music
        {...(team
          ? {
              plates: [["Lag", String(tier.size)], ["Innskudd", tier.fee === 0 ? "Gratis" : dollars(tier.fee)], ["Til vinneren", dollars(tier.prizes.winner ?? 0)]] as [string, string][],
            }
          : {})}
      />
    );
  }
  const tournament = (
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
        me: { name: side, med: team ? (career.skillMed + botMed(career, team.mine.partner)) / 2 : career.skillMed, points: career.points, character: career.profile.character, ...(team ? { members: [career.player, team.mine.partner] } : { rival: rivalOf(career), rivals: career.rivals }), settings: a.cup.countdown ? { game: String(a.cup.countdown.start) as CareerGame, doubleOut: a.cup.countdown.doubleOut } : gameOf(career.profile) },
        prizes: eventTier(a).prizes,
        onAbandon: () => {
          commit(leaveAbandoned(career));
          onHub();
        },
      }}
    />
  );
  // An event with a picture is played inside it: the bar of Ly, the hall of the world championship, behind the draw and the matches.
  const inside = picturesFor({ id: a.tier, key: a.invite?.key });
  return (
    <CareerFaceContext.Provider value={{ name: career.player, character: career.profile.character }}>
      <TeamsContext.Provider value={teams}>
        {inside ? (
          <OverRoom stage={career.room} src={inside.inside} focus={inside.insideFocus} clear>
            {tournament}
          </OverRoom>
        ) : (
          tournament
        )}
      </TeamsContext.Provider>
    </CareerFaceContext.Provider>
  );
}

