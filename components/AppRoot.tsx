"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { clearActiveMatch, loadActiveMatch } from "@/lib/activeMatch";
import { getPlanSession, setPlanSession, whoOf, type PlanGame, type PlanLink, type PlanSession, type PlannedMatch } from "@/lib/nightPlan";
import { addPlanned, changePlanned } from "@/lib/nightScoreStorage";
import { useNavSpace } from "@/lib/navSpace";
import { finishSpotifyLogin } from "@/lib/spotify";
import { preloadRoster, useRoster, useRosterLoaded } from "@/lib/storage";
import { loadActiveTournamentId } from "@/lib/tournamentStorage";
import { useScolia } from "@/lib/useScolia";
import dynamic from "next/dynamic";
import { HeroMascot } from "./HeroMascot";
import { ArrowLeftIcon, BoltIcon, BullseyeIcon, DartIcon, DoubleIcon, FlameIcon, HeartIcon, KeypadIcon, TrophyIcon } from "./icons";
import { RulesIntro } from "./RulesIntro";
import { NightStripe } from "./NightStripe";
import { ScoliaDot, summarizeScolia } from "./ScoliaStatusBadge";
import { SkeletonRows } from "./ui/Skeleton";
import { Welcome, hasBeenWelcomed, markWelcomed } from "./Welcome";
import { BottomNav } from "./ui/BottomNav";
import { Wordmark } from "./ui/BrandMark";
import { Button } from "./ui/Button";
import { FOCUS_RING } from "./ui/focus";

// The three ways into a game are loaded when one is chosen, not with the front page: the board alone is most of the app
// (three thousand lines), and the front page is the first thing every visit draws.
const loading = () => (
  <div className="screen">
    <div className="screen-inner">
      <SkeletonRows count={4} />
    </div>
  </div>
);
const MikkeMusApp = dynamic(() => import("./MikkeMusApp").then((m) => m.MikkeMusApp), { loading });
const TournamentApp = dynamic(() => import("./TournamentApp").then((m) => m.TournamentApp), { loading });
const BullDuelApp = dynamic(() => import("./BullDuelApp").then((m) => m.BullDuelApp), { loading });
const LavaApp = dynamic(() => import("./LavaApp").then((m) => m.LavaApp), { loading });
const HighstrikerApp = dynamic(() => import("./HighstrikerApp").then((m) => m.HighstrikerApp), { loading });
const KillerApp = dynamic(() => import("./KillerApp").then((m) => m.KillerApp), { loading });
const HalvItApp = dynamic(() => import("./HalvItApp").then((m) => m.HalvItApp), { loading });
const CountdownApp = dynamic(() => import("./CountdownApp").then((m) => m.CountdownApp), { loading });
const CareerApp = dynamic(() => import("./CareerApp").then((m) => m.CareerApp), { loading });

type Mode = "home" | "new" | "single" | "tournament" | "bullduel" | "countdown" | "highstriker" | "lava" | "halvit" | "killer" | "career";

const TOURNAMENTS_OFFERED = true;

/** The way into each game of the plan. */
const MODE_OF: Record<PlanGame, Mode> = { enkeltkamp: "single", countdown: "countdown", highstriker: "highstriker", lava: "lava", halvit: "halvit", killer: "killer" };
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** A way in to a kind of game: its icon above its name, or beside it when it has the whole row to itself. */
function Tile({ icon, label, onClick, wide = false, big = false, sub }: { icon: React.ReactNode; label: string; onClick: () => void; wide?: boolean; /** The first and biggest choice of a list. */ big?: boolean; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tactile flex items-center justify-center ${wide || big ? "flex-row gap-3 w-full" : "flex-col gap-2"} ${FOCUS_RING}`}
      style={{ minHeight: big ? "8.5rem" : wide ? "4.25rem" : "5.5rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: big ? "1px solid var(--color-teal)" : "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: big ? "var(--text-title)" : "var(--text-body)", fontWeight: 600 }}
    >
      <span style={{ color: "var(--color-teal)" }}>{icon}</span>
      <span className="flex flex-col items-start text-left">
        {label}
        {sub && <small style={{ color: "var(--color-muted)", fontSize: "var(--text-small)", fontWeight: 400 }}>{sub}</small>}
      </span>
    </button>
  );
}

/** What "Nytt spill" opens: Mikke Mus as the big first choice, and the other games under it. */
function NewGame({ onBack, onPick, onTurnering }: { onBack: () => void; onPick: (m: Mode) => void; onTurnering: () => void }) {
  useNavSpace(true);
  return (
    <div className="animate-screen-enter screen">
      <div className="screen-inner wide">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Tilbake"
            className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`}
            style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="font-display" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
            Nytt spill
          </h1>
        </div>
        <div className="grid gap-2 mb-6">
          <Tile
            big
            // The mascot of the app, as on the front page.
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/mikke.webp" alt="" draggable={false} width={420} height={747} style={{ height: "6.5rem", width: "auto", objectFit: "contain" }} />
            }
            label="Mikke Mus"
            sub="Enkeltkamp"
            onClick={() => onPick("single")}
          />
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Andre spill">
            <Tile icon={<BullseyeIcon className="w-6 h-6" />} label="Bull-duell" onClick={() => onPick("bullduel")} />
            <Tile icon={<KeypadIcon className="w-6 h-6" />} label="301 / 501" onClick={() => onPick("countdown")} />
            <Tile icon={<HeartIcon className="w-6 h-6" />} label="Highstriker" onClick={() => onPick("highstriker")} />
            <Tile icon={<FlameIcon className="w-6 h-6" />} label="Lava" onClick={() => onPick("lava")} />
            <Tile icon={<DoubleIcon className="w-6 h-6" />} label="Halv It" onClick={() => onPick("halvit")} />
            <Tile icon={<BoltIcon className="w-6 h-6" />} label="Killer" onClick={() => onPick("killer")} />
          </div>
        </div>
      </div>
      <BottomNav current="spill" onTurnering={onTurnering} />
    </div>
  );
}

/** The very first thing rendered: the front page, and the way into a kind of game. What is already under way comes first. */
export function AppRoot() {
  const { limited } = useAccess();
  const roster = useRoster();
  const [mode, setMode] = useState<Mode>("home");
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  const [matchUnderway, setMatchUnderway] = useState<string[] | null>(null);
  // The rules introduction, on request (the address ?m=regler, from Mer). The first-time showing is MikkeMusApp's.
  const [showRules, setShowRules] = useState(false);
  // A game opened from the plan of the evening (Kveldsplan): to put a match in the plan, to change one, or to play the next.
  const [plan, setPlan] = useState<PlanSession | null>(null);
  const router = useRouter();
  const [welcomed, setWelcomed] = useState(true);
  const loaded = useRosterLoaded();
  // Only connected while the home screen itself is showing — MikkeMusApp/TournamentApp own their
  // own connection once a mode is picked, so this never runs two connections at once.
  const scolia = useScolia(mode === "home" && !showRules, {});
  useNavSpace(mode === "home" && !showRules);

  // Re-read external state (localStorage) every time the home screen itself comes back into
  // view, not just on first mount — otherwise cancelling or finishing a tournament wouldn't
  // update the card until a hard refresh, since returning here is just a mode change, not a
  // remount. Same "you might not need an effect" exception already used by MikkeMusApp's/
  // TournamentApp's own resume-on-load effects, not a render-loop.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "home") return;
    setHasActiveTournament(!!loadActiveTournamentId());
    const active = loadActiveMatch();
    setMatchUnderway(active && active.screen === "game" ? active.players : null);
  }, [mode]);

  // Another page (the bottom bar, Mer) asking for a place on this one: /?m=turnering or /?m=regler.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (!m) return;
    window.history.replaceState({}, "", "/");
    if (m === "turnering") setMode("tournament");
    if (m === "regler") setShowRules(true);
  }, []);

  // Sent here by the plan: /?plan, with what the plan asked for kept in the plan session. Any other way here ends the session, so that a match
  // played later is not counted as the planned one.
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).has("plan");
    const session = asked ? getPlanSession() : null;
    if (!session) {
      setPlanSession(null);
      return;
    }
    // The address is left as it is: this runs twice in development, and the second time must still find what the plan asked for.
    if (session.kind === "play" && session.game === "enkeltkamp") clearActiveMatch();
    setPlan(session);
    setMode(MODE_OF[session.game]);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The first time on this device: the welcome, unless there are people in the app already.
  /* eslint-disable react-hooks/set-state-in-effect -- reads this device's storage once, after the first paint */
  useEffect(() => {
    setWelcomed(hasBeenWelcomed());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The players are fetched while the home screen is up, not when the setup screen first asks.
  useEffect(() => {
    preloadRoster();
  }, []);

  // Back from Spotify's login with a code in the address: trade it for tokens now, before any menu is open to do it.
  useEffect(() => {
    void finishSpotifyLogin();
  }, []);

  if (!welcomed && loaded && roster.length === 0 && mode === "home") {
    return (
      <Welcome
        onDone={() => {
          markWelcomed();
          setWelcomed(true);
        }}
      />
    );
  }
  if (showRules) return <RulesIntro onDone={() => setShowRules(false)} />;
  // Out of a game: to the plan when it was opened from there, otherwise to the front page.
  const leave = () => {
    if (plan) {
      setPlanSession(null);
      setPlan(null);
      router.push("/kveld");
      return;
    }
    setMode("home");
  };
  const link: PlanLink | undefined = plan
    ? {
        setup: plan.setup,
        planning: plan.kind !== "play",
        autostart: plan.kind === "play",
        onPlan: (setup, label) => {
          const item: PlannedMatch = { id: plan.plannedId ?? newId(), game: plan.game, setup, who: whoOf(setup), label };
          if (plan.kind === "edit") changePlanned(plan.eveningId, item.id, { setup, who: item.who, label });
          else addPlanned(plan.eveningId, item);
          leave();
        },
      }
    : undefined;
  if (mode === "new") return <NewGame onBack={() => setMode("home")} onPick={setMode} onTurnering={() => setMode("tournament")} />;
  if (mode === "single") return <MikkeMusApp onExitToHome={leave} plan={link} />;
  if (mode === "tournament") return <TournamentApp onExitToHome={() => setMode("home")} />;
  if (mode === "bullduel") return <BullDuelApp onExitToHome={() => setMode("home")} />;
  if (mode === "lava") return <LavaApp onExitToHome={leave} plan={link} />;
  if (mode === "killer") return <KillerApp onExitToHome={leave} plan={link} />;
  if (mode === "halvit") return <HalvItApp onExitToHome={leave} plan={link} />;
  if (mode === "highstriker") return <HighstrikerApp onExitToHome={leave} plan={link} />;
  if (mode === "countdown") return <CountdownApp onExitToHome={leave} plan={link} />;
  if (mode === "career" && !limited) return <CareerApp onExitToHome={() => setMode("home")} />;

  // Tournaments and the other games are open to the limited code too; Karriere is for the full code only.
  const tournamentsOn = TOURNAMENTS_OFFERED || hasActiveTournament;
  const resume = matchUnderway ? { title: matchUnderway.join(" mot "), label: "Kamp pågår", go: () => setMode("single") } : tournamentsOn && hasActiveTournament ? { title: "Turnering", label: "Pågår", go: () => setMode("tournament") } : null;

  return (
    <div className="animate-screen-enter screen">
      {/* The board's status as a dot in the corner — the words are one tap away. */}
      <div className="fixed top-2 right-2 z-40">
        <ScoliaDot summary={summarizeScolia(scolia.state)} />
      </div>
      <div className="screen-inner wide">
        <h1 className="mb-4">
          <Wordmark size="num" />
        </h1>

        <div className="wide-columns">
        {resume && (
          <section
            className="mb-4 text-center p-4"
            style={{ borderRadius: "var(--radius-l)", background: "var(--color-panel)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}
          >
            <p className="section-label mb-1">{resume.label.toUpperCase()}</p>
            <p className="font-display mb-4" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
              {resume.title}
            </p>
            <Button variant="primary" size="lg" block onClick={resume.go}>
              Fortsett
            </Button>
          </section>
        )}
        <section
          className="mb-4 text-center p-4"
          style={{ borderRadius: "var(--radius-l)", background: "var(--color-panel)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}
        >
          <HeroMascot small />
          <Button variant="primary" size="lg" block icon={<DartIcon className="w-5 h-5" />} onClick={() => setMode("new")}>
            Nytt spill
          </Button>
        </section>

        {/* The front page is three ways in: a new game, a tournament and (with the full code) the career. */}
        <div className="grid gap-2 mb-6">
          <Tile wide icon={<TrophyIcon className="w-6 h-6" />} label="Turnering" onClick={() => setMode("tournament")} />
          {!limited && <Tile wide icon={<TrophyIcon className="w-6 h-6" />} label="Karriere" onClick={() => setMode("career")} />}
        </div>

        {/* The plan of the evening stays at the foot, for the full code. */}
        {!limited && (
          <NightStripe
            onNext={(eveningId, p) => {
              const session: PlanSession = { kind: "play", eveningId, game: p.game, plannedId: p.id, setup: p.setup };
              setPlanSession(session);
              if (p.game === "enkeltkamp") clearActiveMatch();
              setPlan(session);
              setMode(MODE_OF[p.game]);
            }}
          />
        )}
        </div>

      </div>
      <BottomNav current="spill" onTurnering={tournamentsOn ? () => setMode("tournament") : undefined} />
    </div>
  );
}
