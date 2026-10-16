"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { preloadRoster } from "@/lib/storage";
import { loadActiveTournamentId } from "@/lib/tournamentStorage";
import { useScolia } from "@/lib/useScolia";
import { BullDuelApp } from "./BullDuelApp";
import { HeroMascot } from "./HeroMascot";
import { BullseyeIcon, DartIcon, TrophyIcon, TvIcon } from "./icons";
import { MikkeMusApp } from "./MikkeMusApp";
import { RulesIntro } from "./RulesIntro";
import { SettingsScreen } from "./SettingsScreen";
import { ScoliaDot, summarizeScolia } from "./ScoliaStatusBadge";
import { TournamentApp } from "./TournamentApp";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const shortcut = "tactile rounded-lg text-sm flex items-center justify-center gap-2";
const shortcutStyle = { minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" } as const;

type Mode = "home" | "single" | "tournament" | "bullduel" | "settings";

const TOURNAMENTS_OFFERED = false;

/** The very first thing rendered — chooses between a one-off "Singel game" (today's app,
 *  unchanged) and "Tournament" mode. Replaces the old direct `<MikkeMusApp />` in app/page.tsx. */
export function AppRoot() {
  const [mode, setMode] = useState<Mode>("home");
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  // The rules introduction, on request from the home screen. The first-time showing is MikkeMusApp's.
  const [showRules, setShowRules] = useState(false);
  // Only connected while the home screen itself is showing — MikkeMusApp/TournamentApp own their
  // own connection once a mode is picked, so this never runs two connections at once.
  const scolia = useScolia(mode === "home", {});

  // Re-read external state (localStorage) every time the home screen itself comes back into
  // view, not just on first mount — otherwise cancelling or finishing a tournament wouldn't
  // update this button until a hard refresh, since returning here is just a mode change, not a
  // remount. Same "you might not need an effect" exception already used by MikkeMusApp's/
  // TournamentApp's own resume-on-load effects, not a render-loop.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode === "home") setHasActiveTournament(!!loadActiveTournamentId());
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The players are fetched while the home screen is up, not when the setup screen first asks.
  useEffect(() => {
    preloadRoster();
  }, []);

  if (showRules) return <RulesIntro onDone={() => setShowRules(false)} />;
  if (mode === "settings") return <SettingsScreen onBack={() => setMode("home")} />;
  if (mode === "single") return <MikkeMusApp onExitToHome={() => setMode("home")} />;
  if (mode === "tournament") return <TournamentApp onExitToHome={() => setMode("home")} />;
  if (mode === "bullduel") return <BullDuelApp onExitToHome={() => setMode("home")} />;

  return (
    <div className="animate-screen-enter screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
      {/* The board's status as a dot in the corner — the words are one tap away. */}
      <div className="fixed top-2 right-2 z-40">
        <ScoliaDot summary={summarizeScolia(scolia.state)} />
      </div>
      <div className="screen-inner">
        {/* The mascot replaces the emoji that was the one cartoon element on an otherwise
            considered screen — see HeroMascot. */}
        <HeroMascot />
        <h1 className="text-center mb-8 font-display" style={{ color: "var(--color-cream)", fontSize: "2.5rem", letterSpacing: "0.02em" }}>
          Mikke Mus
        </h1>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`glossy w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-green)", color: "var(--color-cream)" } as React.CSSProperties}
          >
            <DartIcon className="w-5 h-5" />
            Enkeltkamp
          </button>
          {/* Tournaments are off the home screen for now (2026-10-15, on request) — the code is
              all still here, and a tournament already under way can still be picked up. */}
          {TOURNAMENTS_OFFERED || hasActiveTournament ? (
            <button
              type="button"
              onClick={() => setMode("tournament")}
              className={`glossy w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 ${FOCUS_RING}`}
              style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
            >
              <TrophyIcon className="w-5 h-5" />
              {hasActiveTournament ? "Fortsett turnering" : "Turnering"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMode("bullduel")}
            className={`glossy w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-gold)", color: "var(--color-bg)" } as React.CSSProperties}
          >
            <BullseyeIcon className="w-5 h-5" />
            Bull-duell
          </button>
        </div>
        {/* The four places that are not a game, as four quiet buttons of the same size. They were
            underlined links on 20 px that wrapped onto two lines. */}
        <div className="grid grid-cols-2 gap-2 mt-8">
          <button type="button" onClick={() => setShowRules(true)} className={`${shortcut} ${FOCUS_RING}`} style={shortcutStyle}>
            Regler
          </button>
          <Link href="/spillere" className={`${shortcut} ${FOCUS_RING}`} style={shortcutStyle}>
            Spillere
          </Link>
          <Link href="/storskjerm" className={`${shortcut} ${FOCUS_RING}`} style={shortcutStyle}>
            <TvIcon className="w-4 h-4" />
            Storskjerm
          </Link>
          <button type="button" onClick={() => setMode("settings")} className={`${shortcut} ${FOCUS_RING}`} style={shortcutStyle}>
            Innstillinger
          </button>
        </div>
      </div>
    </div>
  );
}
