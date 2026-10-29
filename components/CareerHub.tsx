"use client";

import { useEffect, useRef, useState } from "react";
import { DRILLS, UNLOCK_ROOM, levelCap, type DrillId } from "@/lib/drills";
import { DrillList } from "./DrillList";
import { LADDER, ROOM_MAX, STAGES, buyStage, dollars, hubPicture, topStep, isUnlocked, nextStage, startEvent, whyNot, whyNotBuy, type Career, type Tier } from "@/lib/career";
import { cupColor } from "@/lib/botCup";
import { TROPHY } from "@/lib/scenePalette";
import { foilVars, frameOf } from "@/lib/materials";
import { rankOf, roomBadge } from "@/lib/careerGoals";
import { heroButton, heroFor } from "@/lib/careerHero";
import { careerSound, uiFeedback } from "@/lib/uiSound";
import { newSeed } from "./careerFormat";
import { HomeIcon, MailIcon, RoadIcon, StarIcon } from "./careerIcons";
import { CareerInbox } from "./CareerInbox";
import { CareerInvites } from "./CareerInvites";
import { SeasonScreen } from "./SeasonScreen";
import { RankUp, SeasonRecap } from "./CareerScreens";
import { CareerNews } from "./CareerNews";
import { Avatar } from "./ui/Avatar";
import { rivalOf, sponsorLogo } from "@/lib/careerLife";
import { inboxCount, isOpen, lifeOf, seasonOf, unseenNews, weekInSeason, WEEKS_PER_SEASON } from "@/lib/careerLife";
import { markNewsSeen } from "@/lib/careerWorld";
import { CareerHud } from "./CareerHud";
import { RankBadge, TrophyArt } from "./CareerTrophy";
import { CharacterFigure } from "./CharacterFigure";
import { RankingList } from "./RankingList";
import { GameChoice } from "./GameChoice";
import { gameOf } from "@/lib/careerGame";
import { CareerProfile, type ProfileTab } from "./CareerProfile";
import { markTipSeen, TipPointer, useTipSeen } from "./CareerTip";
import { ConfirmDialog } from "./ConfirmDialog";
import { MoreIcon, PersonIcon, TrophyIcon } from "./icons";
import { PlayButton } from "./PlayButton";
import { OverRoom } from "./RoomBackdrop";
import { EVENT_PICTURES } from "./eventPictures";
import { CoinFlight, RoomHero, buyMode, revealAt, type BuyMode, type CoinFlightPath } from "./RoomHero";
import { RoundButton } from "./RoundButton";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";

type View = "home" | "rooms" | "road" | "profile" | "rank" | "inbox" | "season";

const TITLE: Record<Exclude<View, "home">, string> = { rooms: "Trening", road: "Turneringer", profile: "Profil", rank: "Rangering", inbox: "Meldinger", season: "Sesongen" };

/** Where the career is in its season: ten ticks, the weeks that are played filled in. */
function SeasonStrip({ career, onOpen }: { career: Career; onOpen: () => void }) {
  const life = lifeOf(career);
  const week = weekInSeason(life.week);
  return (
    <button type="button" className={`season-strip tabular tactile ${FOCUS_RING}`} aria-label={`Sesongen: sesong ${seasonOf(life.week)}, uke ${week} av ${WEEKS_PER_SEASON}`} onClick={onOpen}>
      <span>
        Sesong {seasonOf(life.week)} · uke {week}
      </span>
      <span className="season-ticks" aria-hidden>
        {Array.from({ length: WEEKS_PER_SEASON }, (_, i) => (
          <i key={i} className={i < week - 1 ? "on" : i === week - 1 ? "now" : ""} />
        ))}
      </span>
    </button>
  );
}

/** Where the player is: the room is a place with a name and a step, so the picture behind everything reads as theirs. */
function PlaceChip({ room }: { room: number }) {
  return (
    <span className="place-chip">
      <HomeIcon className="w-4 h-4 shrink-0" />
      Garasjen din
      <em>· {STAGES[room].name}</em>
    </span>
  );
}

/** What a step gave, as a sentence: Maling og veggpaneler. */
const listText = (items: string[]) => {
  const words = items.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1)));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} og ${words[words.length - 1]}` : words[0] ?? "";
};

const ROOM_TITLE = { fontSize: "var(--text-num)", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.05, color: "var(--color-cream)", textAlign: "center" } as const;

/** The home of a career, made as simple as it goes: the room behind it, one big button, four round ones. Everything else is behind one of them. */
export function Hub({ career, onBack, onPlay, onChallenge, onTrain, commit, onDelete }: { career: Career; onBack: () => void; onPlay: () => void; onChallenge: () => void; onTrain: (id: DrillId) => void; commit: (c: Career) => void; onDelete: () => void }) {
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("oversikt");
  const [settings, setSettings] = useState(false);
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
  // The rank is remembered, so a new one gets its moment (a career from before it was kept starts at the rank it has).
  const rankNow = rankOf(career);
  const rankSeen = lifeOf(career).rankSeen;
  useEffect(() => {
    if (rankSeen === undefined) commit({ ...career, life: { ...lifeOf(career), rankSeen: rankNow } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only to fill in what is missing
  }, [rankSeen]);
  const playTip = useTipSeen("play");
  const go = (v: View) => {
    uiFeedback("pick");
    setView(v);
  };
  // The news are seen when the messages are closed, so the new ones stay marked while they are read.
  const leaveNews = () => {
    commit(markNewsSeen(career));
    setView("home");
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
  const invited = lifeOf(career).inbox.some((m) => m.offer.kind === "invite" && isOpen(m));
  const roadDot = invited || (!career.active && !career.challenge && LADDER.some((t) => t.id !== "lu" && whyNot(career, t) === null));
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

  // The cups won, as a chip: it opens the cabinet on the profile. Nothing is shown before there is a cup.
  const trophyChip =
    career.trophies.length > 0 ? (
      <button
        type="button"
        aria-label={`Pokalskapet, ${career.trophies.length} pokaler`}
        onClick={() => {
          setProfileTab("pokaler");
          go("profile");
        }}
        className={`trophy-chip tactile ${FOCUS_RING}`}
      >
        <TrophyIcon className="w-4 h-4" />
        <b>×{career.trophies.length}</b>
      </button>
    ) : null;

  const sheets = (
    <>
      {menu && (
        <Sheet title="Karriere" onClose={() => setMenu(false)}>
          <div className="space-y-2">
            <Button
              block
              onClick={() => {
                setMenu(false);
                setSettings(true);
              }}
            >
              Innstillinger
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
      {settings && (
        <Sheet title="Innstillinger" onClose={() => setSettings(false)}>
          <p className="section-label mb-2">SPILL</p>
          <GameChoice {...gameOf(career.profile)} onChange={(next) => commit({ ...career, profile: { ...career.profile, ...next } })} />
          <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            {career.active ? "Gjelder fra neste turnering: den som pågår spilles ferdig slik den ble startet." : "Gjelder fra neste turnering."}
          </p>
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

  // A season that has just ended is shown once, before anything else.
  const life = lifeOf(career);
  if (life.seasons[0] && life.seasons[0].season > (life.recapSeen ?? 0)) {
    return <SeasonRecap career={career} onDone={() => commit({ ...career, life: { ...life, recapSeen: life.seasons[0].season } })} />;
  }

  if (rankSeen !== undefined && rankSeen !== rankNow) {
    return <RankUp career={career} onDone={() => commit({ ...career, life: { ...lifeOf(career), rankSeen: rankNow } })} />;
  }

  if (view === "home") {
    return (
      <OverRoom stage={career.room} src={hubPicture(topStep(career))} focus="50% 35%" clear>
        {news && <span className="room-news-ring" aria-hidden />}
        <span className="char-home" aria-hidden>
          <CharacterFigure id={career.profile.character} pose={hero.kind === "event" && hero.done ? "jubel" : "noytral"} glow patch={lifeOf(career).sponsor ? sponsorLogo(lifeOf(career).sponsor!.name) : undefined} />
        </span>
        {launch && <span className="launch-iris" aria-hidden style={{ "--c": TROPHY[launch.id], "--ox": `${launch.x}px`, "--oy": `${launch.y}px` } as React.CSSProperties} />}
        <div className="animate-screen-push screen">
          {sheets}
          <div className="screen-inner career-home">
            <CareerHud career={career} end={<span className="inline-flex items-center gap-2">{trophyChip}{menuButton}</span>} />
            <SeasonStrip career={career} onOpen={() => go("season")} />
            {career.played >= 1 && (
              <button
                type="button"
                className={`rival-chip tactile ${FOCUS_RING}`}
                aria-label={`Rival: ${rivalOf(career).name}${career.rivals?.[rivalOf(career).name] ? `, ${career.rivals[rivalOf(career).name].w} mot ${career.rivals[rivalOf(career).name].l}` : ""}`}
                onClick={() => {
                  setProfileTab("oversikt");
                  go("profile");
                }}
              >
                <Avatar name={rivalOf(career).name} bot px={28} />
                <span>
                  <small>RIVAL</small>
                  <b>{rivalOf(career).name}</b>
                </span>
                {career.rivals?.[rivalOf(career).name] && (
                  <span className="tabular rival-score">
                    {career.rivals[rivalOf(career).name].w}–{career.rivals[rivalOf(career).name].l}
                  </span>
                )}
              </button>
            )}
            {news && (
              <button type="button" className="room-news" onClick={() => setNews(null)} aria-label={`Nytt i rommet: ${news}`}>
                <StarIcon className="w-4 h-4" />
                Nytt i rommet: <b>{news}</b>
              </button>
            )}
            <div className="flex-1" />
            <div className="room-text char-home-text rise-in" style={{ "--d": "0.1s" } as React.CSSProperties}>
              <p className="font-display" style={{ fontSize: "var(--text-num)", lineHeight: 1.05, color: "var(--color-cream)" }}>
                {career.player}
              </p>
              <p className="rank-line" style={{ color: "var(--color-gold-strong)", fontWeight: 700, fontSize: "var(--text-small)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <RankBadge rank={rankOf(career)} />
                {rankOf(career)}
              </p>
            </div>
            <div className="relative rise-in" style={{ "--d": "0.2s" } as React.CSSProperties}>
              {!playTip && <TipPointer id="play" label="Trykk her" />}
              <PlayButton label={button.label} sub={button.sub} tone={hero.kind === "event" && hero.done ? "gold" : hero.kind === "challenge" && hero.done && hero.challenge.won ? "gold" : "teal"} onClick={press} />
            </div>
            <div className="round4 rise-in" style={{ "--d": "0.32s" } as React.CSSProperties}>
              <RoundButton icon={<HomeIcon />} label="Trening" badge={roomBadge(career)} onClick={() => go("rooms")} />
              <RoundButton
                icon={<PersonIcon />}
                label="Profil"
                onClick={() => {
                  setProfileTab("oversikt");
                  go("profile");
                }}
              />
              <RoundButton icon={<RoadIcon />} label="Turneringer" badge={roadDot} onClick={() => go("road")} />
              <RoundButton icon={<MailIcon />} label="Meldinger" badge={inboxCount(lifeOf(career)) > 0 || unseenNews(lifeOf(career)) > 0} onClick={() => go("inbox")} />
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
              <div className="flex-1" style={{ minHeight: "28dvh" }} />
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
                {next && !compare && (
                  <ul className="flex gap-2 justify-center flex-wrap" aria-label="Låser opp">
                    <li className="stage-chip stage-chip-unlock">Nivå opp til {levelCap(career.room + 1)}</li>
                    {DRILLS.filter((d) => UNLOCK_ROOM[d.id] === career.room + 1).map((d) => (
                      <li key={d.id} className="stage-chip stage-chip-unlock">
                        Åpner {d.name}
                      </li>
                    ))}
                  </ul>
                )}
                {!compare && (
                  <DrillList career={career} onTrain={onTrain} today={new Date().toISOString().slice(0, 10)} />
                )}
                <PlayButton label={next ? "KJØP" : "FERDIG"} sub={next ? (buyWhy ? `${dollars(next.price)} · ${buyWhy}` : dollars(next.price)) : "Drømmerommet er på plass"} disabled={!!buyWhy} onClick={buy} />
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
          <CareerHud career={career} onBack={view === "inbox" ? leaveNews : () => setView("home")} title={TITLE[view]} />

          {view === "rank" && <RankingList career={career} />}
          {view === "inbox" && <CareerInbox career={career} commit={commit} onChallenge={onChallenge} onRoad={() => setView("road")} />}
          {view === "inbox" && <CareerNews career={career} />}
          {view === "season" && <SeasonScreen career={career} />}
          {view === "profile" && <CareerProfile key={profileTab} career={career} tab={profileTab} onRank={() => go("rank")} />}

          {view === "road" && (
            <>
              <CareerInvites career={career} commit={commit} onPlay={onPlay} />
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
        </div>
      </div>
    </OverRoom>
  );
}
