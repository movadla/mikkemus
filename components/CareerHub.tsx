"use client";

import { useEffect, useRef, useState } from "react";
import { DRILL_ROUNDS } from "@/lib/training";
import { GAMES, LADDER, ROOM_MAX, STAGES, buyStage, dollars, isUnlocked, nextStage, offerChallenge, stakeFor, startEvent, whyNot, whyNotBuy, type Career, type GameId, type Tier } from "@/lib/career";
import { cupColor } from "@/lib/botCup";
import { TROPHY } from "@/lib/scenePalette";
import { foilVars, frameOf } from "@/lib/materials";
import { rankOf, rankProgress, roomBadge } from "@/lib/careerGoals";
import { heroButton, heroFor } from "@/lib/careerHero";
import { careerSound, uiFeedback } from "@/lib/uiSound";
import { levelLabel, newSeed, oneDecimal } from "./careerFormat";
import { HomeIcon, LockIcon, RoadIcon, StarIcon } from "./careerIcons";
import { CareerHud } from "./CareerHud";
import { RankBadge, TrophyArt } from "./CareerTrophy";
import { CareerProfile } from "./CareerProfile";
import { markTipSeen, TipPointer, useTipSeen } from "./CareerTip";
import { ConfirmDialog } from "./ConfirmDialog";
import { BoltIcon, BullseyeIcon, CoinIcon, MoreIcon } from "./icons";
import { PlayButton } from "./PlayButton";
import { OverRoom } from "./RoomBackdrop";
import { EVENT_PICTURES } from "./eventPictures";
import { CoinFlight, RoomHero, buyMode, revealAt, type BuyMode, type CoinFlightPath } from "./RoomHero";
import { RoundButton } from "./RoundButton";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";

type View = "home" | "rooms" | "road" | "training" | "challenges";

const TITLE: Record<Exclude<View, "home">, string> = { rooms: "Rom", road: "Turneringer", training: "Trening", challenges: "Duell" };

/** Where the player is: the room is a place with a name and a step, so the picture behind everything reads as theirs. */
function PlaceChip({ room }: { room: number }) {
  return (
    <span className="place-chip">
      <HomeIcon className="w-4 h-4 shrink-0" />
      Garasjen din
      <em>
        · {STAGES[room].name} · {room + 1} av {ROOM_MAX + 1}
      </em>
    </span>
  );
}

/** What a step gave, as a sentence: Maling og veggpaneler. */
const listText = (items: string[]) => {
  const words = items.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1)));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} og ${words[words.length - 1]}` : words[0] ?? "";
};

/** The cups of the career on a glass shelf with light over it: the ones that are won in metal, the rest as dark silhouettes with a lock. */
function TrophyShelf({ career }: { career: Career }) {
  const slots = LADDER.map((t) => ({ tier: t, n: career.trophies.filter((x) => x.tier === t.id).length }));
  const have = slots.filter((s) => s.n > 0).length;
  return (
    <div className="shelf3d" role="img" aria-label={`Pokalhylle: ${have} av ${slots.length} pokaler`}>
      <span className="shelf3d-light" aria-hidden />
      <div className="shelf3d-items">
        {slots.map(({ tier, n }) => (
          <div key={tier.id} className="shelf3d-slot">
            {n > 0 ? (
              <TrophyArt kind={tier.id} bare />
            ) : (
              <>
                <span className="t3d-locked block">
                  <TrophyArt kind={tier.id} bare />
                </span>
                <LockIcon className="shelf3d-lock" />
              </>
            )}
            {n > 1 && <span className="shelf3d-count">×{n}</span>}
          </div>
        ))}
      </div>
      <div className="shelf3d-board" aria-hidden />
    </div>
  );
}

const ROOM_TITLE = { fontSize: "var(--text-num)", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.05, color: "var(--color-cream)", textAlign: "center" } as const;

/** The one goal on the home screen: the star the player is working towards, a bar, and the points. */
function GoalStrip({ career }: { career: Career }) {
  const g = rankProgress(career);
  if (!g) return null;
  return (
    <div className="goal-strip goal-strip-badge tabular" role="progressbar" aria-label={`Neste rang: ${g.name}, ${g.points} av ${g.need} poeng`} aria-valuemin={0} aria-valuemax={g.need} aria-valuenow={g.points}>
      <span className="inline-flex items-center gap-2 shrink-0" style={{ color: "var(--color-gold-strong)", fontWeight: 800 }}>
        <RankBadge rank={g.name} />
        {g.name}
      </span>
      <span className="flex-1" style={{ height: "0.4rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)", overflow: "hidden" }}>
        <span className="block" style={{ width: `${Math.max(3, g.progress * 100)}%`, height: "100%", borderRadius: "var(--radius-pill)", background: "var(--color-gold)", transition: "width var(--pull)" }} />
      </span>
      <span style={{ color: "var(--color-text-2)", fontWeight: 700 }}>
        {g.points}/{g.need}
      </span>
    </div>
  );
}

/** The home of a career, made as simple as it goes: the room behind it, one big button, four round ones. Everything else is behind one of them. */
export function Hub({ career, onBack, onPlay, onChallenge, onTrain, commit, onDelete }: { career: Career; onBack: () => void; onPlay: () => void; onChallenge: () => void; onTrain: () => void; commit: (c: Career) => void; onDelete: () => void }) {
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A room that has just changed: the step it came from (kept so it can be compared), the buy that is playing, and the way it is played.
  const [before, setBefore] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [bmode, setBmode] = useState<BuyMode>("wipe");
  const [compare, setCompare] = useState(false);
  const [coins, setCoins] = useState<CoinFlightPath | null>(null);
  // What the last step gave, shown on the home screen when the player gets back, with a ring where the board hangs.
  const [news, setNews] = useState<string | null>(null);
  // An event that is being started: its colour spreads from the button for a moment before the scene.
  const [launch, setLaunch] = useState<{ id: Tier["id"]; x: number; y: number } | null>(null);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(launchTimer.current), []);
  useEffect(() => {
    if (!news || view !== "home") return;
    const t = setTimeout(() => setNews(null), 5200);
    return () => clearTimeout(t);
  }, [news, view]);
  // The step of the road that is picked (the one that is going, or the one the main button leads to).
  const hero = heroFor(career);
  const [picked, setPicked] = useState<Tier["id"] | null>(null);
  const playTip = useTipSeen("play");
  const go = (v: View) => {
    uiFeedback("pick");
    setView(v);
  };
  /** Start an event: its colour spreads from the button that was pressed, and then the scene opens. Without motion it opens at once. */
  const enter = (tier: Tier["id"], from: HTMLElement) => {
    if (launch) return;
    const begin = () => {
      commit(startEvent(career, tier, newSeed()));
      onPlay();
    };
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return begin();
    const r = from.getBoundingClientRect();
    setLaunch({ id: tier, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    launchTimer.current = setTimeout(begin, 600);
  };
  const press = (e: React.MouseEvent<HTMLButtonElement>) => {
    uiFeedback("click");
    markTipSeen("play");
    if (hero.kind === "enter") enter(hero.tier.id, e.currentTarget);
    else if (hero.kind === "event") onPlay();
    else onChallenge();
  };
  const button = heroButton(hero);
  // Something beyond the pub is open and has not been entered: the road button says so.
  const roadDot = !career.active && !career.challenge && LADDER.some((t) => t.id !== "lu" && whyNot(career, t) === null);
  const buy = () => {
    const was = career.room;
    const bought = nextStage(career);
    if (!bought) return;
    uiFeedback("confirm");
    careerSound("unlock");
    // Coins fly from the button to the balance.
    const btn = document.querySelector(".room-buy .play-btn")?.getBoundingClientRect();
    const chip = document.querySelector('.room-buy [title="Saldo"]')?.getBoundingClientRect();
    if (btn && chip) {
      setCoins({ x0: btn.left + btn.width / 2, y0: btn.top + btn.height / 2, x1: chip.left + chip.width / 2, y1: chip.top + chip.height / 2 });
      setTimeout(() => setCoins(null), 1600);
    }
    commit(buyStage(career));
    setBefore(was);
    setBmode(buyMode(was + 1));
    setCompare(false);
    setPlaying(true);
    setNews(listText(bought.items));
    setTimeout(() => setPlaying(false), 3200);
  };
  const leaveRooms = () => {
    setView("home");
    setBefore(null);
    setCompare(false);
  };

  const menuButton = (
    <button type="button" onClick={() => setMenu(true)} aria-label="Meny" className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
      <MoreIcon className="w-5 h-5" />
    </button>
  );

  const sheets = (
    <>
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
              Profil
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
    </>
  );

  if (view === "home") {
    return (
      <OverRoom stage={career.room} clear>
        {news && <span className="room-news-ring" aria-hidden />}
        {launch && <span className="launch-iris" aria-hidden style={{ "--c": TROPHY[launch.id], "--ox": `${launch.x}px`, "--oy": `${launch.y}px` } as React.CSSProperties} />}
        <div className="animate-screen-push screen">
          {sheets}
          <div className="screen-inner career-home">
            <CareerHud career={career} end={menuButton} />
            <GoalStrip career={career} />
            <PlaceChip room={career.room} />
            {news && (
              <button type="button" className="room-news" onClick={() => setNews(null)} aria-label={`Nytt i rommet: ${news}`}>
                <StarIcon className="w-4 h-4" />
                Nytt i rommet: <b>{news}</b>
              </button>
            )}
            <div className="flex-1" />
            <div className="room-text rise-in" style={{ "--d": "0.1s" } as React.CSSProperties}>
              <p className="font-display" style={{ fontSize: "var(--text-num)", lineHeight: 1.05, color: "var(--color-cream)" }}>
                {career.player}
              </p>
              <p className="rank-line" style={{ color: "var(--color-gold-strong)", fontWeight: 700, fontSize: "var(--text-small)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <RankBadge rank={rankOf(career)} />
                {rankOf(career)}
              </p>
              <TrophyShelf career={career} />
            </div>
            <div className="relative rise-in" style={{ "--d": "0.2s" } as React.CSSProperties}>
              {!playTip && <TipPointer id="play" label="Trykk her" />}
              <PlayButton label={button.label} sub={button.sub} tone={hero.kind === "event" && hero.done ? "gold" : hero.kind === "challenge" && hero.done && hero.challenge.won ? "gold" : "teal"} onClick={press} />
            </div>
            <div className="round4 rise-in" style={{ "--d": "0.32s" } as React.CSSProperties}>
              <RoundButton icon={<HomeIcon />} label="Rom" badge={roomBadge(career)} onClick={() => go("rooms")} />
              <RoundButton icon={<BullseyeIcon />} label="Trening" onClick={() => go("training")} />
              <RoundButton icon={<BoltIcon />} label="Duell" onClick={() => go("challenges")} />
              <RoundButton icon={<RoadIcon />} label="Turneringer" badge={roadDot} onClick={() => go("road")} />
            </div>
          </div>
        </div>
      </OverRoom>
    );
  }

  const selected = LADDER.find((t) => t.id === (picked ?? (hero.kind === "challenge" ? "lu" : hero.tier.id))) ?? LADDER[0];
  const selWhy = career.active?.tier === selected.id ? null : whyNot(career, selected);
  const selState = career.active?.tier === selected.id ? "active" : !isUnlocked(career, selected) ? "locked" : selWhy ? "short" : "open";
  const next = nextStage(career);
  const buyWhy = whyNotBuy(career);

  if (view === "rooms") {
    return (
      <div className="room-buy" data-mode={bmode} data-playing={playing ? "" : undefined} style={{ "--rv": `${revealAt(bmode)}s` } as React.CSSProperties}>
        <RoomHero stage={career.room} before={before} playing={playing} compare={compare} mode={bmode} />
        {coins && <CoinFlight path={coins} />}
        <div className="room-over">
          <div className="animate-screen-push screen" style={{ paddingBottom: "1rem" }}>
            {sheets}
            <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
              <CareerHud career={career} onBack={leaveRooms} title={TITLE.rooms} />
              <div className="flex-1" />
              <div className="flex flex-col items-center gap-2">
                <PlaceChip room={career.room} />
                <div className="room-title-swap w-full">
                  {playing && before !== null && (
                    <p aria-hidden className="font-display room-text room-title-old" style={ROOM_TITLE}>
                      {STAGES[before].name}
                    </p>
                  )}
                  <p key={career.room} className={`font-display room-text ${playing ? "room-title-new" : ""}`} style={ROOM_TITLE}>
                    {STAGES[career.room].name}
                  </p>
                </div>
                <div className="pips10" role="img" aria-label={`Trinn ${career.room + 1} av ${ROOM_MAX + 1}`}>
                  {STAGES.map((s, i) => (
                    <i key={s.name} className={`${i <= career.room ? "on" : ""} ${playing && i === career.room ? "pip-new" : ""}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-3 mt-3">
                {before !== null && before !== career.room && !playing && (
                  <div className="flex justify-center">
                    <Button variant="ghost" onClick={() => setCompare((c) => !c)}>
                      {compare ? "Lukk sammenligningen" : "Før og etter"}
                    </Button>
                  </div>
                )}
                {next && (
                  <div className="room-title-swap">
                    {playing && (
                      <ul aria-hidden className="flex gap-2 justify-center flex-wrap">
                        {STAGES[career.room].items.map((item) => (
                          <li key={item} className="stage-chip stage-chip-old">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    <ul className="flex gap-2 justify-center flex-wrap" aria-label="Du får">
                      {next.items.map((item, i) => (
                        <li key={item} className={`stage-chip ${playing ? "stage-chip-new" : ""}`} style={{ "--i": `${(i * 0.12).toFixed(2)}s` } as React.CSSProperties}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <PlayButton label={next ? "KJØP" : "FERDIG"} sub={next ? (buyWhy ?? dollars(next.price)) : "Drømmerommet er på plass"} disabled={!!buyWhy} onClick={buy} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OverRoom stage={career.room} dim={58} blur={5}>
      {launch && <span className="launch-iris" aria-hidden style={{ "--c": TROPHY[launch.id], "--ox": `${launch.x}px`, "--oy": `${launch.y}px` } as React.CSSProperties} />}
      <div className="animate-screen-push screen" style={{ paddingBottom: "1rem" }}>
        {sheets}
        <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
          <CareerHud career={career} onBack={() => setView("home")} title={TITLE[view]} />

          {view === "road" && (
            <>
              <ul className="space-y-2" aria-label="Turneringer">
                {LADDER.map((tier) => {
                  const locked = !isUnlocked(career, tier);
                  const here = career.active?.tier === tier.id;
                  const qualified = !locked && !!tier.qualify;
                  const colour = cupColor(tier.kind);
                  const state = here ? "pågår" : locked ? "låst" : qualified ? "kvalifisert" : "åpen";
                  const pic = EVENT_PICTURES[tier.id]?.outside;
                  // One line under the name: what it takes. The stake and the number of players are on the opening and the draw.
                  const needs = tier.qualify?.replace(/^Krever /, "").replace("Regionmesterskapet", "Region").replace("Norgesmesterskapet", "NM");
                  const takes = needs ? needs.charAt(0).toUpperCase() + needs.slice(1) : "Åpen for alle";
                  return (
                    <li key={tier.id}>
                      <button type="button" onClick={() => setPicked(tier.id)} aria-pressed={selected.id === tier.id} className={`tourney-card tactile ${selected.id === tier.id ? "tourney-card-on" : ""} ${locked ? "tourney-card-locked" : ""} ${FOCUS_RING}`} style={{ "--cup": colour, "--pic": pic ? `url(${pic})` : "none", "--frame": locked ? "var(--frame-locked)" : frameOf(tier.id) } as React.CSSProperties}>
                        <span className="tourney-trophy" aria-hidden>
                          {locked ? (
                            <span className="t3d-locked block">
                              <TrophyArt kind={tier.id} bare />
                            </span>
                          ) : (
                            <TrophyArt kind={tier.id} bare />
                          )}
                        </span>
                        <span className="min-w-0 text-left">
                          {locked ? (
                            <b className="tourney-name" style={{ color: "var(--color-text-2)" }}>
                              {tier.name}
                            </b>
                          ) : (
                            <b className="tourney-name foil foil-soft" data-t={tier.name} style={foilVars(tier.id) as React.CSSProperties}>
                              {tier.name}
                            </b>
                          )}
                          <span className="tourney-takes">{takes}</span>
                        </span>
                        <span className="tabular text-right grid gap-1 justify-items-end" style={{ color: locked ? "var(--color-muted)" : "var(--color-gold-strong)", fontWeight: 800 }}>
                          {dollars(tier.prizes.winner ?? 0)}
                          <span className={`tourney-state tourney-state-${state}`}>{state}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto sticky-play">
                <PlayButton
                  label="SPILL"
                  sub={selState === "active" ? "Fortsett" : selState === "locked" ? selected.qualify : selState === "short" ? selWhy ?? undefined : `${selected.name} · ${selected.fee === 0 ? "gratis" : dollars(selected.fee)}`}
                  disabled={selState === "locked" || selState === "short"}
                  onClick={(e) => {
                    uiFeedback("click");
                    if (selState === "active") onPlay();
                    else enter(selected.id, e.currentTarget);
                  }}
                />
              </div>
            </>
          )}

          {view === "training" && (
            <>
              <div className="flex-1" />
              <div className="room-tile room-tile-wide" style={{ display: "grid", justifyItems: "center", gap: "0.15rem", padding: "1rem" }}>
                <span className="section-label">TREFFSIKKERHET</span>
                <b className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
                  {levelLabel(career.skillMed)}
                </b>
                <span className="tabular" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                  avvik {oneDecimal(career.skillMed)} mm{career.training[0] ? ` · sist snitt ${oneDecimal(career.training[0].average)}` : ""}
                </span>
              </div>
              <PlayButton label="START" sub={`${DRILL_ROUNDS} runder · trippel 20`} onClick={onTrain} />
            </>
          )}

          {view === "challenges" && (
            <>
              <div className="flex-1" />
              <ul className="space-y-2" aria-label="Duell">
                {(Object.keys(GAMES) as GameId[]).map((game) => {
                  const shut = !!career.active || !!career.challenge;
                  return (
                    <li key={game}>
                      <button
                        type="button"
                        disabled={shut}
                        className={`pick-row tactile ${FOCUS_RING}`}
                        onClick={() => {
                          uiFeedback("click");
                          commit(offerChallenge(career, game, newSeed()));
                          onChallenge();
                        }}
                      >
                        <b className="font-display flex-1 text-left" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
                          {GAMES[game].name}
                        </b>
                        <span className="inline-flex items-center gap-1.5 tabular" style={{ color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-title)" }}>
                          <CoinIcon className="w-5 h-5" />
                          {dollars(stakeFor(career, game))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </OverRoom>
  );
}
