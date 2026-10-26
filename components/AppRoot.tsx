"use client";

import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { loadActiveMatch } from "@/lib/activeMatch";
import { useNavSpace } from "@/lib/navSpace";
import { finishSpotifyLogin } from "@/lib/spotify";
import { preloadRoster, useRoster, useRosterLoaded } from "@/lib/storage";
import { loadActiveTournamentId } from "@/lib/tournamentStorage";
import { useScolia } from "@/lib/useScolia";
import dynamic from "next/dynamic";
import { HeroMascot } from "./HeroMascot";
import { BullseyeIcon, DartIcon, TrophyIcon } from "./icons";
import { RulesIntro } from "./RulesIntro";
import { ScoliaDot, summarizeScolia } from "./ScoliaStatusBadge";
import { SkeletonRows } from "./ui/Skeleton";
import { TonightCard } from "./TonightCard";
import { Welcome, hasBeenWelcomed, markWelcomed } from "./Welcome";
import { BottomNav } from "./ui/BottomNav";
import { Wordmark } from "./ui/BrandMark";
import { Button } from "./ui/Button";
import { FOCUS_RING } from "./ui/focus";

// The three ways into a game are loaded when one is chosen, not with the front page: the board alone is most of the app
// (three thousand lines), and the front page is the first thing every visit draws.
const loading = () => (
  <div className="screen" style={{ background: "var(--color-bg)" }}>
    <div className="screen-inner">
      <SkeletonRows count={4} />
    </div>
  </div>
);
const MikkeMusApp = dynamic(() => import("./MikkeMusApp").then((m) => m.MikkeMusApp), { loading });
const TournamentApp = dynamic(() => import("./TournamentApp").then((m) => m.TournamentApp), { loading });
const BullDuelApp = dynamic(() => import("./BullDuelApp").then((m) => m.BullDuelApp), { loading });

type Mode = "home" | "single" | "tournament" | "bullduel";

const TOURNAMENTS_OFFERED = true;

/** A way in to a kind of game: its icon above its name, or beside it when it has the whole row to itself. */
function Tile({ icon, label, onClick, wide = false }: { icon: React.ReactNode; label: string; onClick: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tactile flex items-center justify-center ${wide ? "flex-row gap-3" : "flex-col gap-2"} ${FOCUS_RING}`}
      style={{ minHeight: "5.5rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600 }}
    >
      <span style={{ color: "var(--color-teal)" }}>{icon}</span>
      {label}
    </button>
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
  if (mode === "single") return <MikkeMusApp onExitToHome={() => setMode("home")} />;
  if (mode === "tournament") return <TournamentApp onExitToHome={() => setMode("home")} />;
  if (mode === "bullduel") return <BullDuelApp onExitToHome={() => setMode("home")} />;

  const tournamentsOn = !limited && (TOURNAMENTS_OFFERED || hasActiveTournament);
  const resume = matchUnderway ? { title: matchUnderway.join(" mot "), label: "Kamp pågår", go: () => setMode("single") } : tournamentsOn && hasActiveTournament ? { title: "Turnering", label: "Pågår", go: () => setMode("tournament") } : null;

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      {/* The board's status as a dot in the corner — the words are one tap away. */}
      <div className="fixed top-2 right-2 z-40">
        <ScoliaDot summary={summarizeScolia(scolia.state)} />
      </div>
      <div className="screen-inner wide">
        <h1 className="mb-4">
          <Wordmark size="num" />
        </h1>

        <div className="wide-columns">
        <section
          className="mb-6 text-center p-4"
          style={{ borderRadius: "var(--radius-l)", background: "var(--color-panel)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}
        >
          {resume ? (
            <>
              <p className="section-label mb-1">{resume.label.toUpperCase()}</p>
              <p className="font-display mb-4" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
                {resume.title}
              </p>
              <Button variant="primary" size="lg" block onClick={resume.go}>
                Fortsett
              </Button>
            </>
          ) : (
            <>
              <HeroMascot small />
              <Button variant="primary" size="lg" block icon={<DartIcon className="w-5 h-5" />} onClick={() => setMode("single")}>
                Ny kamp
              </Button>
            </>
          )}
        </section>

        {/* The hero is already Enkeltkamp when nothing is under way, so its tile is only there when the hero is something else. */}
        {/* One tile has the whole row, as it should look; two or three share it. */}
        {(() => {
          const tiles = (resume ? 1 : 0) + (tournamentsOn ? 1 : 0) + 1;
          return (
            <div className={`grid gap-2 mb-6 ${tiles === 1 ? "grid-cols-1" : tiles === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {resume && <Tile icon={<DartIcon className="w-6 h-6" />} label="Enkeltkamp" onClick={() => setMode("single")} />}
              {tournamentsOn && <Tile icon={<TrophyIcon className="w-6 h-6" />} label="Turnering" onClick={() => setMode("tournament")} />}
              <Tile wide={tiles === 1} icon={<BullseyeIcon className="w-6 h-6" />} label="Bull-duell" onClick={() => setMode("bullduel")} />
            </div>
          );
        })()}

        </div>

        <TonightCard />
      </div>
      <BottomNav current="spill" onTurnering={tournamentsOn ? () => setMode("tournament") : undefined} />
    </div>
  );
}
